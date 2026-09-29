#!/usr/bin/env python3
"""Serialize a reviewed studio page into the personal collection and publish it.

Usage: python3 scripts/publish-explainer.py /absolute/job/ready.json [--dry-run]
Reviewed corrections require --replace-sha256 <current-published-page-sha256>.
The job owns source/evidence; this is the only studio writer of catalog/index.
Browser/editorial review is a human/agent responsibility, not inferred by this tool.
"""
import argparse
import fcntl
import hashlib
import json
import re
import subprocess
import time
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://github.com/felixchenyijun/explainers.git'
PERSONAL = 'felixchenyijun'
CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"


def run(root, *args):
    return subprocess.check_output(args, cwd=root, text=True).strip()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_job(manifest):
    manifest = Path(manifest).resolve(strict=True)
    job = json.loads(manifest.read_text())
    slug = job.get('slug', '')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or len(slug) > 70:
        raise ValueError('Slug must be a short lowercase hyphenated route.')
    entry = {}
    for key in ('slug', 'title', 'category', 'description', 'format', 'note'):
        value = job.get(key)
        if key == 'note' and value is None:
            continue
        if not isinstance(value, str) or not value.strip() or len(value) > 1500:
            raise ValueError(f'Invalid catalog field: {key}')
        entry[key] = value
    source = Path(job['source'])
    if not source.is_absolute() or not source.resolve().is_relative_to(manifest.parent):
        raise ValueError('Source must be an absolute path inside this job directory.')
    body = source.read_bytes()
    if not 500 <= len(body) < 50 * 1024 * 1024:
        raise ValueError('Source must be a complete HTML page smaller than 50 MB.')
    digest = sha(body)
    if digest != job.get('source_sha256'):
        raise ValueError('Source changed after review: SHA-256 does not match.')
    if CSP not in body.decode('utf-8'):
        raise ValueError('The exact self-contained artifact CSP is required.')
    for field in ('desktop', 'mobile', 'recording', 'checks'):
        path = Path(job.get('review', {}).get(field, ''))
        if not path.is_absolute() or not path.resolve().is_relative_to(manifest.parent):
            raise ValueError(f'Review {field} must be inside this job directory.')
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f'Missing inspected review artifact: {field}')
    checks = json.loads(Path(job['review']['checks']).read_text())
    if checks.get('source_sha256') != digest:
        raise ValueError('Verification must identify the exact source_sha256.')
    return job, entry, body


@contextmanager
def integration_lock(root, timeout=45):
    gitdir = Path(run(root, 'git', 'rev-parse', '--absolute-git-dir'))
    with (gitdir / 'studio-integration.lock').open('a') as lock:
        start = time.monotonic()
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() - start >= timeout:
                    raise RuntimeError('Another studio publication owns the lock; retry later.')
                time.sleep(.25)
        yield


def clean(root):
    if run(root, 'git', 'status', '--porcelain'):
        raise RuntimeError('Uncommitted work exists; preserve it and retry after its owner finishes.')


def publish(manifest, root=ROOT, dry_run=False, replace_sha256=None):
    if replace_sha256 is not None and not re.fullmatch(r'[0-9a-f]{64}', replace_sha256):
        raise ValueError('Replacement guard must be a full lowercase SHA-256.')
    root = Path(root).resolve()
    job, entry, body = load_job(manifest)
    slug = entry['slug']
    with integration_lock(root):
        if run(root, 'git', 'remote', 'get-url', 'origin') != ORIGIN:
            raise RuntimeError('Refusing any repository except felixchenyijun/explainers.')
        if run(root, 'git', 'branch', '--show-current') != 'main':
            raise RuntimeError('Use the canonical main checkout for integration.')
        clean(root)
        login = run(root, str(root / 'scripts/gh-personal'), 'api', 'user', '--jq', '.login')
        if login != PERSONAL:
            raise RuntimeError(f'Refusing authenticated account: {login}')
        if not dry_run:
            run(root, 'git', 'fetch', 'origin', 'main')
            # Fast-forward only; never overwrite other work or rewrite history.
            run(root, 'git', 'merge', '--ff-only', 'origin/main')
            clean(root)
        catalog = root / 'catalog.json'
        index = root / 'docs/index.html'
        destination = root / 'docs' / slug
        target = destination / 'index.html'
        if destination.is_symlink() or target.is_symlink():
            raise RuntimeError('Refusing a symlink at the destination.')
        items = json.loads(catalog.read_text())
        existing = [item for item in items if item['slug'] == slug]
        updating = False
        if destination.exists() or existing:
            same = existing == [entry] and target.is_file() and target.read_bytes() == body
            if same:
                if not dry_run:
                    # An identical retry is safe even after a guarded update committed.
                    run(root, 'python3', 'scripts/publish.py')
                return result(root, slug, sha(body), dry_run, reused=True)
            if replace_sha256 is None:
                raise RuntimeError('Route already exists with different content; a reviewed correction requires --replace-sha256.')
            if len(existing) != 1 or not target.is_file():
                raise RuntimeError('A replacement requires one catalog entry and an existing page.')
            if sha(target.read_bytes()) != replace_sha256:
                raise RuntimeError('Published page changed since review; replacement SHA-256 does not match.')
            updating = True
        elif replace_sha256 is not None:
            raise RuntimeError('A replacement requires an existing route; it cannot create one.')
        if dry_run:
            return {'dry_run': True, 'slug': slug, 'bytes': len(body), 'account': login,
                    'source_sha256': sha(body), 'updating': updating,
                    'note': 'No shared files changed; editorial/browser review remains required.'}
        before = {catalog: catalog.read_bytes(), index: index.read_bytes()}
        if updating:
            before[target] = target.read_bytes()
        written = {}
        paths = [f'docs/{slug}/index.html', 'catalog.json', 'docs/index.html']
        staged = False
        committed = False
        start_head = run(root, 'git', 'rev-parse', 'HEAD')
        try:
            destination.mkdir(exist_ok=updating)
            target.write_bytes(body)
            written[target] = body
            if updating:
                items = [entry if item['slug'] == slug else item for item in items]
            else:
                items.insert(0, entry)
            catalog.write_text(json.dumps(items, indent=2, ensure_ascii=False) + '\n')
            written[catalog] = catalog.read_bytes()
            run(root, 'python3', 'scripts/build-index.py')
            written[index] = index.read_bytes()
            run(root, 'python3', 'scripts/check-site.py')
            # Another task must not sneak a catalog edit into this commit.
            if any(path.read_bytes() != data for path, data in written.items()):
                raise RuntimeError('Shared files changed concurrently; refusing to stage.')
            allowed = {p.replace('\\', '/') for p in paths}
            tracked_changes = set(run(root, 'git', 'diff', '--name-only').splitlines())
            if not tracked_changes.issubset(allowed):
                raise RuntimeError('Unrelated edits appeared during integration; preserving them.')
            if run(root, 'git', 'diff', '--cached', '--name-only'):
                raise RuntimeError('Another task staged files during integration; preserving them.')
            expected_staged = tracked_changes | (set() if updating else {paths[0]})
            run(root, 'git', 'add', '--', *paths)
            staged = True
            if set(run(root, 'git', 'diff', '--cached', '--name-only').splitlines()) != expected_staged:
                raise RuntimeError('Unexpected staged paths; refusing to commit.')
            run(root, 'git', '-c', 'user.name=Felix Chen', '-c',
                'user.email=41398105+felixchenyijun@users.noreply.github.com',
                'commit', '-m', f'{"Update" if updating else "Publish"} {entry["title"]}')
            committed = True
        except BaseException:
            # Roll back only our uncommitted, unchanged bytes. Never reset a branch.
            if not committed and run(root, 'git', 'rev-parse', 'HEAD') == start_head:
                if staged:
                    run(root, 'git', 'restore', '--staged', '--', *paths)
                for path, data in before.items():
                    if path in written and path.read_bytes() == written[path]:
                        path.write_bytes(data)
                if not updating and target.is_file() and not target.is_symlink() and target.read_bytes() == body:
                    target.unlink()
                    try:
                        destination.rmdir()
                    except OSError:
                        pass
            raise
        # Keep the commit if push fails so a retry is safe and doesn't duplicate work.
        run(root, 'python3', 'scripts/publish.py')
        return result(root, slug, sha(body), False)


def result(root, slug, digest, dry_run, reused=False):
    return {'dry_run': dry_run, 'reused': reused, 'slug': slug,
            'commit': run(root, 'git', 'log', '-1', '--format=%H', '--', f'docs/{slug}/index.html'),
            'source_sha256': digest,
            'url': f'https://felixchenyijun.github.io/explainers/{slug}/',
            'live_verified': False,
            'next': 'Verify Pages deployment, live bytes and browser interactions; capture final-commit evidence.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--replace-sha256', help='Expected current page SHA-256 for an independently reviewed correction.')
    args = parser.parse_args()
    print(json.dumps(publish(args.manifest, dry_run=args.dry_run, replace_sha256=args.replace_sha256), indent=2))
