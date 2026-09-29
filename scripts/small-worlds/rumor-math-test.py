#!/usr/bin/env python3
"""Play the mathematical walkthrough through real browser controls."""
import json, os, subprocess
from pathlib import Path

SESSION=os.environ.get('SW_SESSION','sw-rumor-math-checks')
BASE=os.environ.get('SW_BASE','http://127.0.0.1:8784')
OUT=Path(os.environ.get('SW_OUTPUT','/tmp/sw-rumor-math/controls'))
OUT.mkdir(parents=True,exist_ok=True)

def run(*args):
    p=subprocess.run(['agent-browser','--session',SESSION,'--args','--mute-audio','--json',*map(str,args)],capture_output=True,text=True,timeout=40)
    if p.returncode: raise RuntimeError(p.stdout+p.stderr)
    result=json.loads(p.stdout)
    if not result['success']: raise RuntimeError(result)
    return result.get('data',{})

def ev(js): return run('eval',js).get('result')
def text(selector): return ev(f'document.querySelector({json.dumps(selector)}).innerText')
def click(action,value=None):
    sel=f'[data-do="{action}"]'+(f'[data-value="{value}"]' if value is not None else '')
    run('scrollintoview',sel);run('click',sel)
def shot(name,selector='.rumor-math'):
    run('scrollintoview',selector);run('screenshot',str(OUT/(name+'.png')))
def audit():
    assert ev('document.documentElement.scrollWidth===document.documentElement.clientWidth')
    ids=ev('[...document.querySelectorAll("[id]")].map(e=>e.id)')
    assert len(ids)==len(set(ids))
    a=run('a11y','--tags','wcag2a,wcag2aa')
    assert a['counts']['violations']==0,a.get('violations')
    return a['counts']

try:
    run('open',BASE+'/everyone-says/');run('set','viewport',1440,1000)
    click('restart');click('confirm-reset')
    assert not ev('!!document.querySelector(".rumor-math")'),'Do not reveal an answer before prediction.'
    click('choose','blue');click('math')
    assert '1/3 = 33.3% red' in text('.belief')
    assert ev('document.activeElement.id')=='btn-math'
    shot('private-clue')
    click('next');assert not ev('!!document.querySelector(".rumor-math")')
    click('choose','red');click('math')
    assert '2/3 = 66.7% red' in text('.belief')
    assert '80% red' in text('.math-aside')
    shot('private-versus-public')
    click('next')
    for _ in range(3): click('step')
    click('math')
    assert ev('document.querySelector(".person-proof").dataset.mathPerson')=='2'
    assert '8/9' in text('.branch-table') and '2/3' in text('.branch-table')
    assert '1/1 = 1' in text('.math-insight')
    assert '4 : 1 × 1 = 4 : 1' in text('.public-update')
    assert 'Actual private clue' not in text('.person-proof')
    shot('both-clues-same-choice','.person-proof')
    click('math-person',1)
    assert 'Tie → own clue' in text('.branch-table')
    assert '2 : 1 × 2 = 4 : 1' in text('.public-update')
    click('math-proof');assert ev('document.getElementById("btn-math-proof").getAttribute("aria-expanded")')=='true'
    click('math-person',2);assert not ev('document.getElementById("math-proof").hidden')
    assert '4/5 = 80%' in text('#math-proof')
    assert 'six blue' not in text('#math-proof')
    for _ in range(5): click('step')
    assert '4/5 = 80% red' in text('.belief')
    desktop=audit()
    click('next');click('math')
    assert '1/17 = 5.9% red' in text('.rumor-math')
    click('share','1');click('math-person',2)
    assert '4 : 1 × 1/2 = 2 : 1' in text('.public-update')
    assert 'clue itself is shared' in text('.math-insight')
    click('math-proof');assert '4/(4 + 64)' in text('#math-proof')
    shot('sharing-changes-the-evidence','.person-proof')
    run('reload');assert not ev('document.getElementById("math-working").hidden')
    assert not ev('document.getElementById("math-proof").hidden')
    click('next');click('order','blue');click('math')
    assert '1/5 = 20% red' in text('.belief')
    assert '1/17 = 5.9% red' in text('.rumor-math')
    click('math-person',2);assert '1 : 4 × 1 = 1 : 4' in text('.public-update')
    click('lab');click('math');click('signal',0)
    assert 'ledger will grow' in text('#math-working')
    click('step');assert '1/3 = 33.3% red' in text('.belief')
    run('select','#control-share','1');click('play')
    run('wait','--fn','SmallWorlds.getState().lab.tick === 8')
    assert '1/65 = 1.5% red' in text('.belief')
    click('math-person',2);click('math-proof')
    assert '2/(2 + 128)' in text('#math-proof')
    run('set','viewport',390,844)
    mobile=audit();shot('phone-decision','.person-proof');shot('phone-proof','#math-proof')
    click('restart-chapter')
    assert not ev('SmallWorlds.getState().lab.mathOpen')
    assert '4/5 = 80% red' in text('.belief')
    (OUT/'results.json').write_text(json.dumps({'desktop':desktop,'mobile':mobile,'checks':['prediction before explanation','private versus public beliefs','both counterfactual clues','own-clue ties','uninformative-choice multiplier','shared-clue multiplier','exact likelihoods','reordering','sandbox edits','zero decisions','persisted disclosures','reset','keyboard focus','unique IDs','responsive overflow']},indent=2))
    print('PASS mathematical walkthrough, controls, persistence, desktop/mobile, and accessibility',flush=True)
except Exception:
    try: run('screenshot','--full',str(OUT/'failure.png'))
    except Exception: pass
    raise
