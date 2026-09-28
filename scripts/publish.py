#!/usr/bin/env python3
"""Publish reviewed commits using only Felix's personal GitHub identity."""
import fcntl
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def run(*args, capture=False):
    return subprocess.run(args, cwd=ROOT, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout

with (ROOT / '.git' / 'publication.lock').open('w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    origin = run('git', 'remote', 'get-url', 'origin', capture=True).strip()
    if origin != 'https://github.com/felixchenyijun/explainers.git':
        raise SystemExit(f'Refusing unexpected origin: {origin}')
    branch = run('git', 'branch', '--show-current', capture=True).strip()
    if branch != 'main':
        raise SystemExit('Publish from main after integrating other tasks; never force-push.')
    if run('git', 'status', '--porcelain', capture=True).strip():
        raise SystemExit('Commit reviewed changes before publishing; working tree is not clean.')
    allowed = {'AGENTS.md', 'README.md', 'catalog.json', '.gitignore', '.gitattributes'}
    tracked = run('git', 'ls-files', capture=True).splitlines()
    unexpected = [p for p in tracked if p not in allowed and not p.startswith(('docs/', 'scripts/'))]
    if unexpected:
        raise SystemExit(f'Unreviewed paths outside publication tree: {unexpected}')
    run(str(ROOT / 'scripts' / 'gh-personal'), 'api', 'user', '--jq', '.login')
    run('python3', 'scripts/check-site.py')
    run('git', 'push', 'origin', 'main')
    print('Pushed. Verify the Pages deployment and live links before announcing completion.')
