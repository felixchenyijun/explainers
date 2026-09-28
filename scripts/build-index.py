#!/usr/bin/env python3
"""Build the self-contained catalog from reviewed explainer metadata."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
items = json.loads((ROOT / 'catalog.json').read_text())
esc = html.escape
rows = []
for n, item in enumerate(items, 1):
    secondary = item.get('secondary')
    extra = f'<a class="secondary" href="{esc(secondary["href"])}">{esc(secondary["label"])} ↗</a>' if secondary else ''
    note = f'<span class="note">{esc(item["note"])}</span>' if item.get('note') else ''
    rows.append(f'''<li data-search="{esc(' '.join(str(item.get(k, '')) for k in ('title','category','description')).lower())}">
      <span class="number" aria-hidden="true">{n:02}</span>
      <div class="entry"><div class="category">{esc(item['category'])}</div>
      <h2><a href="{esc(item['slug'])}/">{esc(item['title'])}<span aria-hidden="true"> ↗</span></a></h2>
      <p>{esc(item['description'])}</p>{note}{extra}</div>
      <span class="format">{esc(item['format'])}</span></li>''')

page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="description" content="Interactive explainers by Felix Chen: AI, computing, mathematics and biology. Open a system, change a parameter, follow an idea.">
<title>Explainers · Felix Chen</title>
<style>
:root{color-scheme:dark;--bg:#101318;--fg:#e8edf1;--muted:#a2acb6;--line:#2d353e;--accent:#9cd9c0;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1060px;margin:auto;padding:46px 32px 64px}.topline{display:flex;align-items:center;justify-content:space-between;gap:20px;font:12px var(--mono);letter-spacing:.04em;color:var(--muted)}a{color:inherit;text-underline-offset:4px}a:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:5px}.topline a{text-decoration:none}.topline a:hover{text-decoration:underline}h1{margin:34px 0 9px;font-size:36px;letter-spacing:-.04em;font-weight:640;line-height:1.15}.intro{max-width:660px;color:var(--muted);margin:0 0 29px;font-size:17px}.tools{display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid var(--line);padding-bottom:18px}.search{display:flex;align-items:center;gap:12px;flex:1;max-width:440px}.search label{font-size:13px;color:var(--muted)}input{min-width:0;width:100%;border:1px solid #46515f;border-radius:5px;background:#181e26;color:var(--fg);padding:10px 12px;font:14px inherit}input::placeholder{color:#95a1ac}.count{font:12px var(--mono);color:var(--muted);white-space:nowrap}ol{list-style:none;margin:0;padding:0}li{display:grid;grid-template-columns:34px 1fr 175px;gap:18px;padding:25px 0 27px;border-bottom:1px solid var(--line)}li[hidden]{display:none}.number{padding-top:3px;color:#7e8a96;font:12px var(--mono)}.category{color:var(--accent);font:11px var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}h2{font-size:23px;font-weight:570;letter-spacing:-.023em;line-height:1.3;margin:0 0 7px}h2 a{text-decoration:none}h2 a span{font-size:17px;color:#6d7b87;display:inline-block;transition:transform .15s}h2 a:hover{color:var(--accent)}h2 a:hover span{transform:translate(2px,-2px);color:var(--accent)}.entry p{max-width:650px;margin:0;color:var(--muted);font-size:14px;line-height:1.6}.format{font:11px/1.5 var(--mono);color:#94a0ad;padding-top:23px;text-align:right}.note,.secondary{display:block;margin-top:9px;font-size:12px;color:#96a2ae}.secondary{color:var(--accent);width:fit-content}#empty{padding:35px 0;color:var(--muted)}footer{display:flex;justify-content:space-between;gap:20px;margin-top:26px;color:#8895a2;font-size:12px}footer p{margin:0;max-width:670px}footer a{white-space:nowrap}
@media(max-width:640px){main{padding:24px 20px 40px}h1{font-size:31px;margin-top:30px}.intro{font-size:15px}.topline{font-size:11px}.tools{gap:14px}.search{gap:8px}.search label{font-size:12px}input{font-size:13px;padding:9px;max-width:100%}.count{font-size:10px}li{grid-template-columns:24px 1fr;gap:12px;padding:22px 0}.format{grid-column:2;text-align:left;padding:0;margin-top:-5px}h2{font-size:21px}.entry p{font-size:14px}footer{flex-direction:column;gap:12px}.number{font-size:11px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><main>
<div class="topline"><span>FELIX CHEN / FIELD NOTES</span><a href="https://github.com/felixchenyijun/explainers">GitHub ↗</a></div>
<h1>Explainers</h1><p class="intro">Open a system, change a parameter, follow an idea. Interactive explanations of AI, computing, mathematics and biology.</p>
<div class="tools"><div class="search"><label for="search">Find</label><input id="search" type="search" placeholder="A topic, mechanism or question" autocomplete="off"></div><span id="count" class="count" aria-live="polite">__COUNT__ explainers</span></div>
<ol id="entries">__ROWS__</ol><p id="empty" hidden>No matches. Try “inference”, “proof” or “memory”.</p>
<footer><p>These are educational models and visual explanations. Research dates, assumptions and source links live inside each explainer.</p><a href="https://github.com/felixchenyijun/explainers">View the source</a></footer>
</main><script>
const search=document.querySelector('#search'),rows=[...document.querySelectorAll('#entries li')],count=document.querySelector('#count'),empty=document.querySelector('#empty');
search.addEventListener('input',()=>{const terms=search.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);let n=0;for(const row of rows){const match=terms.every(term=>row.dataset.search.includes(term));row.hidden=!match;n+=match?1:0}count.textContent=n+' explainer'+(n===1?'':'s');empty.hidden=n!==0});
</script></body></html>'''
page = page.replace('__COUNT__', str(len(items))).replace('__ROWS__', '\n'.join(rows))
(ROOT / 'docs' / 'index.html').write_text(page)
print(f'Built docs/index.html with {len(items)} explainers.')
