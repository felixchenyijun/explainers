"""Exercise publication with real temporary Git repositories, never GitHub.

The tiny HTML/media fixtures here test integration mechanics only, not UX proof.
"""
import concurrent.futures
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('publisher', HERE / 'publish-explainer.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PublicationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / 'checkout'
        self.root.mkdir()
        self.remote = self.base / 'remote.git'
        self.git('init', '-q', '--bare', str(self.remote))
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.name', 'Publisher fixture')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('remote', 'add', 'origin', str(self.remote))
        (self.root / 'scripts').mkdir()
        (self.root / 'docs').mkdir()
        (self.root / 'catalog.json').write_text('[]\n')
        for name in ('build-index.py', 'check-site.py', 'publish.py'):
            shutil.copyfile(HERE / name, self.root / 'scripts' / name)
        # publish.py also checks origin; its test-only copy points at this local bare repo.
        p = self.root / 'scripts/publish.py'
        p.write_text(p.read_text().replace(publisher.ORIGIN, str(self.remote)))
        self.auth = self.root / 'scripts/gh-personal'
        self.auth.write_text('#!/bin/sh\nprintf "%s\\n" felixchenyijun\n')
        self.auth.chmod(0o755)
        subprocess.run(['python3', 'scripts/build-index.py'], cwd=self.root, check=True,
                       stdout=subprocess.DEVNULL)
        self.git('add', '.')
        self.git('commit', '-qm', 'Fixture baseline')
        self.git('push', '-q', 'origin', 'main')
        actual_run = publisher.run

        def isolated_run(root, *args):
            if args == ('git', 'remote', 'get-url', 'origin'):
                return publisher.ORIGIN
            return actual_run(root, *args)

        self.patcher = patch.object(publisher, 'run', side_effect=isolated_run)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True,
                                       stderr=subprocess.PIPE).strip()

    def job(self, slug='one', content='Reviewed integration fixture'):
        folder = self.base / ('job-' + slug)
        folder.mkdir(exist_ok=True)
        source = folder / 'index.html'
        source.write_text('<!doctype html><html lang="en"><head><meta charset="utf-8">'
                          '<meta http-equiv="Content-Security-Policy" content="' + publisher.CSP + '">'
                          '<title>Fixture</title></head><body><h1>' + content + '</h1>'
                          '<p>' + ('Integration fixture. ' * 20) + '</p></body></html>')
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        review = {}
        for field in ('desktop', 'mobile', 'recording'):
            path = folder / (field + '.fixture')
            path.write_text('Inert integration-test fixture; not evidence.')
            review[field] = str(path)
        checks = folder / 'checks.json'
        checks.write_text(json.dumps({'source_sha256': digest, 'fixture': True}))
        review['checks'] = str(checks)
        data = dict(slug=slug, title='Fixture ' + slug, category='Test',
                    description='Publisher integration test.', format='Fixture',
                    source=str(source), source_sha256=digest, review=review)
        manifest = folder / 'ready.json'
        manifest.write_text(json.dumps(data))
        return manifest

    def test_dry_run_changes_nothing(self):
        head = self.git('rev-parse', 'HEAD')
        answer = publisher.publish(self.job(), root=self.root, dry_run=True)
        self.assertTrue(answer['dry_run'])
        self.assertEqual(head, self.git('rev-parse', 'HEAD'))
        self.assertEqual('', self.git('status', '--porcelain'))

    def test_parallel_pages_are_both_preserved_and_replay_is_idempotent(self):
        jobs = [self.job('one'), self.job('two')]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda p: publisher.publish(p, root=self.root), jobs))
        self.assertTrue(all(not r['live_verified'] for r in results))
        self.assertEqual({'one', 'two'}, {x['slug'] for x in json.loads((self.root / 'catalog.json').read_text())})
        self.assertEqual('', self.git('status', '--porcelain'))
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.git('rev-parse', 'origin/main'))
        head = self.git('rev-parse', 'HEAD')
        self.assertTrue(publisher.publish(jobs[0], root=self.root)['reused'])
        self.assertEqual(head, self.git('rev-parse', 'HEAD'))

    def test_unrelated_dirty_work_is_preserved(self):
        private = self.root / 'unrelated.txt'
        private.write_text('Keep this work.')
        with self.assertRaisesRegex(RuntimeError, 'Uncommitted work'):
            publisher.publish(self.job(), root=self.root)
        self.assertEqual('Keep this work.', private.read_text())
        self.assertEqual('[]\n', (self.root / 'catalog.json').read_text())

    def test_stale_hash_and_conflicting_route_are_rejected(self):
        path = self.job()
        publisher.publish(path, root=self.root)
        head = self.git('rev-parse', 'HEAD')
        source = path.parent / 'index.html'
        source.write_text(source.read_text() + '<!-- changed -->')
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            publisher.publish(path, root=self.root)
        changed = self.job(content='Conflicting replacement')
        with self.assertRaisesRegex(RuntimeError, 'Route already exists'):
            publisher.publish(changed, root=self.root)
        self.assertEqual(head, self.git('rev-parse', 'HEAD'))

    def test_failed_site_validation_rolls_back_only_own_uncommitted_files(self):
        manifest = self.job(content='External asset fixture <img src="https://example.invalid/fixture.png">')
        before = (self.root / 'docs/index.html').read_bytes()
        with self.assertRaises(subprocess.CalledProcessError):
            publisher.publish(manifest, root=self.root)
        self.assertEqual(before, (self.root / 'docs/index.html').read_bytes())
        self.assertEqual('[]\n', (self.root / 'catalog.json').read_text())
        self.assertFalse((self.root / 'docs/one').exists())
        self.assertEqual('', self.git('status', '--porcelain'))

    def test_wrong_account_and_route_traversal_are_rejected(self):
        manifest = self.job()
        data = json.loads(manifest.read_text())
        data['slug'] = '../escape'
        manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'Slug'):
            publisher.publish(manifest, root=self.root)
        self.auth.write_text('#!/bin/sh\nprintf "%s\\n" wrong-account\n')
        self.git('add', 'scripts/gh-personal')
        self.git('commit', '-qm', 'Change fixture account')
        with self.assertRaisesRegex(RuntimeError, 'authenticated account'):
            publisher.publish(self.job('safe'), root=self.root)

    def test_guarded_correction_preserves_catalog_position_and_other_page(self):
        publisher.publish(self.job(), root=self.root)
        target = self.root / 'docs/one/index.html'
        old = target.read_bytes()
        old_hash = publisher.sha(old)
        publisher.publish(self.job('two'), root=self.root)
        catalog = (self.root / 'catalog.json').read_bytes()
        other = (self.root / 'docs/two/index.html').read_bytes()
        manifest = self.job(content='Independently reviewed correction')
        head = self.git('rev-parse', 'HEAD')
        preview = publisher.publish(manifest, root=self.root, dry_run=True, replace_sha256=old_hash)
        self.assertTrue(preview['updating'])
        self.assertEqual(head, self.git('rev-parse', 'HEAD'))
        self.assertEqual(old, target.read_bytes())
        with self.assertRaisesRegex(RuntimeError, 'replacement SHA-256'):
            publisher.publish(manifest, root=self.root, replace_sha256='0'*64)
        self.assertEqual(old, target.read_bytes())
        publisher.publish(manifest, root=self.root, replace_sha256=old_hash)
        self.assertEqual((manifest.parent / 'index.html').read_bytes(), target.read_bytes())
        self.assertEqual(catalog, (self.root / 'catalog.json').read_bytes())
        self.assertEqual(other, (self.root / 'docs/two/index.html').read_bytes())
        self.assertEqual('docs/one/index.html', self.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'))
        head = self.git('rev-parse', 'HEAD')
        self.assertTrue(publisher.publish(manifest, root=self.root, replace_sha256=old_hash)['reused'])
        self.assertEqual(head, self.git('rev-parse', 'HEAD'))
        self.assertEqual(head, self.git('rev-parse', 'origin/main'))
        self.assertEqual('', self.git('status', '--porcelain'))

    def test_failed_correction_restores_the_previous_page(self):
        publisher.publish(self.job(), root=self.root)
        paths = ['docs/one/index.html', 'catalog.json', 'docs/index.html']
        before = {p:(self.root / p).read_bytes() for p in paths}
        head = self.git('rev-parse', 'HEAD')
        manifest = self.job(content='Invalid correction <img src="https://example.invalid/image.png">')
        with self.assertRaises(subprocess.CalledProcessError):
            publisher.publish(manifest, root=self.root, replace_sha256=publisher.sha(before[paths[0]]))
        self.assertEqual(before, {p:(self.root / p).read_bytes() for p in paths})
        self.assertEqual(head, self.git('rev-parse', 'HEAD'))
        self.assertEqual('', self.git('status', '--porcelain'))

    def test_replacement_requires_existing_route_and_valid_hash(self):
        manifest = self.job()
        with self.assertRaisesRegex(ValueError, 'full lowercase SHA-256'):
            publisher.publish(manifest, root=self.root, replace_sha256='short')
        with self.assertRaisesRegex(RuntimeError, 'existing route'):
            publisher.publish(manifest, root=self.root, replace_sha256='0'*64)
        self.assertFalse((self.root / 'docs/one').exists())
        self.assertEqual('', self.git('status', '--porcelain'))


if __name__ == '__main__':
    unittest.main()
