#!/usr/bin/env python3
"""Exercise the actual browser controls. Requires agent-browser and a local server."""
import subprocess,json,sys,os
from pathlib import Path
SESSION=os.environ.get('SW_SESSION','small-worlds-flow')
BASE=os.environ.get('SW_BASE','http://127.0.0.1:8765')
OUT=Path(os.environ.get('SW_OUTPUT','/tmp/small-worlds-work/playtest'));OUT.mkdir(parents=True,exist_ok=True)
WIDTH=int(os.environ.get('SW_WIDTH','1440'))
reports=[]
def run(*args):
 p=subprocess.run(['agent-browser','--session',SESSION,'--json',*map(str,args)],capture_output=True,text=True,timeout=40)
 if p.returncode:raise RuntimeError(p.stderr+p.stdout)
 r=json.loads(p.stdout)
 if not r.get('success'):raise RuntimeError(r)
 return r.get('data',{})
def evaluate(js):return run('eval',js).get('result')
def click(action,value=None):
 if os.environ.get('SW_ALTERNATE') and action=='choose':
  value={'three':'more','bin':'rug','resolved':'speed','top':'bottom','faster':'slower','65':'85','helps':'hurts','depends':'always','no':'yes','little':'lot','smooth':'line','slack':'average','B':'A','A':'C','C':'B','blue':'red','trace':'count','lower':'trust','yes':'no'}.get(value,value)
 selector=f'[data-do="{action}"]'+(f'[data-value="{value}"]' if value is not None else '')
 run('scrollintoview',selector);run('click',selector)
def change(key,value):
 key='control-'+key
 # Real form interaction: selects via the browser, sliders via keyboard.
 tag=evaluate(f'document.getElementById({json.dumps(key)}).tagName')
 if tag=='SELECT':run('select','#'+key,str(value));return
 run('scrollintoview','#'+key);run('focus','#'+key);run('press','Home')
 cfg=evaluate(f'(()=>{{const e=document.getElementById({json.dumps(key)});return {{min:+e.min,step:+e.step}}}})()')
 n=round((float(value)-cfg['min'])/cfg['step'])
 for _ in range(n):run('press','ArrowRight')
 run('press','Tab')
def check(slug,chapter):
 state=evaluate('SmallWorlds.getState()')
 assert state['chapter']==chapter,(slug,state['chapter'],chapter)
 m=evaluate('({title:document.querySelector("h1").innerText,feedback:document.querySelector(".feedback")?.innerText||"",overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,next:!!document.querySelector("[data-do=next]")})')
 assert not m['overflow'],(slug,chapter,'horizontal overflow')
 ids=evaluate('[...document.querySelectorAll("[id]")].map(e=>e.id)')
 assert len(ids)==len(set(ids)),(slug,chapter,'duplicate IDs')
 if chapter<6:assert m['next'],(slug,chapter,'missing next',m)
 reports.append({'game':slug,'chapter':chapter,**m})
 print(slug,chapter+1,m['title'],flush=True)
def next_(slug,c):check(slug,c);click('next')
def shot(slug):run('scroll','up',5000);run('screenshot',str(OUT/(slug+f'-{WIDTH}.png')))
def start(slug):
 run('open',BASE+'/'+slug+'/');run('set','viewport',WIDTH,1000 if WIDTH>650 else 844)
 click('restart');click('confirm-reset')
 if not evaluate('SmallWorlds.getState().calm'):run('click','#motion')
def finish(slug):
 check(slug,6);assert evaluate('SmallWorlds.getState().completed')
 click('lab');assert evaluate('SmallWorlds.getState().sandbox')
 assert not evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth')
 click('lab');assert evaluate('SmallWorlds.getState().chapter')==6
 run('reload');assert evaluate('SmallWorlds.getState().completed')
def flow(slug):
 start(slug)
 if slug=='good-robot':
  click('choose','three');click('play');next_(slug,0)
  click('play');next_(slug,1)
  click('choose','bin');click('play');next_(slug,2)
  click('play');next_(slug,3)
  click('play');assert 'broken' in evaluate('document.querySelector(".feedback").innerText');click('protect');click('play');shot(slug);next_(slug,4)
  click('choose','resolved');next_(slug,5)
 elif slug=='shortcut-city':
  click('choose','top');next_(slug,0)
  click('choose','faster');assert '80 minutes' in evaluate('document.querySelector(".feedback").innerText');next_(slug,1)
  click('choose','65');next_(slug,2)
  click('mode','closed');shot(slug);next_(slug,3)
  click('choose','helps');next_(slug,4)
  click('choose','depends');next_(slug,5)
 elif slug=='little-cafe':
  click('choose','no');click('play');next_(slug,0)
  click('play');next_(slug,1)
  click('choose','little');click('play');next_(slug,2)
  click('staff','2');click('play');shot(slug);next_(slug,3)
  click('choose','smooth');click('play');next_(slug,4)
  click('choose','slack');next_(slug,5)
 elif slug=='who-won':
  for c,v in enumerate(['B','A','C','B','no','B']):
   click('choose',v)
   if c==3:shot(slug)
   next_(slug,c)
 elif slug=='last-fish':
  for v in ['6','4','2']:click('catch',v)
  next_(slug,0);click('choose','yes');click('play');next_(slug,1)
  click('play');next_(slug,2)
  click('play');click('monitor','1');click('play');shot(slug);next_(slug,3)
  click('play');change('quota',1);click('play');next_(slug,4)
  click('choose','lower');next_(slug,5)
 elif slug=='everyone-says':
  click('choose','blue');next_(slug,0)
  click('choose','blue');next_(slug,1)
  click('play');click('confidence','80');click('probe','1');next_(slug,2)
  click('ask-choices');click('share','1');shot(slug);next_(slug,3)
  click('order','blue');click('communication','clues');click('order','red');next_(slug,4)
  click('trace-sources');click('source-answer','tie');click('source-case','1');click('source-answer','red');next_(slug,5)
 elif slug=='average-that-lied':
  click('choose','sol');next_(slug,0)
  click('inspect','easy');click('inspect','hard');next_(slug,1)
  click('swap','10');click('swap','10');shot(slug);next_(slug,2)
  click('common','20');click('common','80');next_(slug,3)
  click('causal-answer','group');click('case','after');click('causal-answer','total');next_(slug,4)
  click('choose','down');next_(slug,5)
 finish(slug)
if __name__=='__main__':
 slugs=sys.argv[1:] or ['good-robot','shortcut-city','little-cafe','who-won','last-fish','everyone-says','average-that-lied']
 try:
  for slug in slugs:flow(slug)
  (OUT/f'flows-{WIDTH}.json').write_text(json.dumps(reports,indent=2))
  print(f'Passed {len(reports)} scenes at {WIDTH}px, including completion, sandbox, persistence, and overflow checks.')
 except Exception:
  try:run('screenshot','--full',str(OUT/'failure.png'))
  except:pass
  raise
