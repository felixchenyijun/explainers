#!/usr/bin/env python3
"""Validate publication paths, local links, dependencies and concrete leak markers."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'docs'
errors = []
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.ids=set(); self.assets=[]; self.csp=False
    def handle_starttag(self, tag, pairs):
        attrs=dict(pairs)
        if 'id' in attrs: self.ids.add(attrs['id'])
        if tag=='meta' and attrs.get('http-equiv','').lower()=='content-security-policy': self.csp=True
        if tag=='a' and attrs.get('href'): self.links.append(attrs['href'])
        for key in ('src','poster'):
            if attrs.get(key): self.assets.append(attrs[key])
        if tag=='link' and attrs.get('rel')=='stylesheet': self.assets.append(attrs.get('href',''))

for entry in json.loads((ROOT / 'catalog.json').read_text()):
    if not (SITE / entry['slug'] / 'index.html').is_file(): errors.append('Missing entry: '+entry['slug'])
for path in SITE.rglob('*'):
    if path.is_symlink(): errors.append(f'Symlink in public tree: {path.relative_to(SITE)}')
    if not path.is_file(): continue
    if path.stat().st_size >= 100*1024*1024: errors.append(f'File exceeds GitHub limit: {path.name}')
    if path.suffix not in ('.html','.js','.json','.md','.txt'): continue
    body=path.read_text()
    private=re.search(r'(?:ziphq\.(?:com|net)|felix-chen-zip|/Users/|/tmp/html-artifacts|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})',body)
    if private: errors.append(f'Private marker in {path.relative_to(SITE)}: {private.group(0)[:45]}')
    if path.suffix!='.html': continue
    page=Page(); page.feed(body)
    if not page.csp: errors.append(f'Missing CSP: {path.relative_to(SITE)}')
    for src in page.assets:
        if not src or src.startswith('data:'): continue
        url=urlsplit(src)
        if url.scheme or url.netloc:
            errors.append(f'External runtime asset: {path.relative_to(SITE)} → {src[:90]}')
        else:
            target=(path.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(SITE.resolve()) or not target.is_file():
                errors.append(f'Missing local asset: {path.relative_to(SITE)} → {src[:90]}')
    for href in page.links:
        url=urlsplit(href)
        if url.scheme or url.netloc: continue
        if not url.path:
            if url.fragment and unquote(url.fragment) not in page.ids:
                # Some explainers route with JS-created anchors; list rather than reject those.
                pass
            continue
        target=(path.parent / unquote(url.path)).resolve()
        if not target.is_relative_to(SITE.resolve()): errors.append(f'Link leaves public tree: {href}')
        elif not target.exists(): errors.append(f'Broken local link: {path.relative_to(SITE)} → {href}')
        elif target.is_dir() and not (target/'index.html').exists(): errors.append(f'Missing directory index: {href}')

if errors:
    raise SystemExit('\n'.join(errors))
pages=list(SITE.rglob('*.html'))
size=sum(p.stat().st_size for p in SITE.rglob('*') if p.is_file())
print(f'Publication checks passed: {len(pages)} HTML pages, {size/1024/1024:.1f} MiB; local links and runtime assets resolve.')
