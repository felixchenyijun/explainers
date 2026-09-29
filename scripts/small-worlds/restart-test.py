#!/usr/bin/env python3
"""Verify visible, keyboard-accessible, isolated story resets in all seven games."""
import json, os, subprocess, time
from pathlib import Path
SESSION=os.environ.get('SW_SESSION','sw-restart-dialog')
BASE=os.environ.get('SW_BASE','http://127.0.0.1:8784')
OUT=Path(os.environ.get('SW_OUTPUT','/tmp/sw-rumor-math/restart'));OUT.mkdir(parents=True,exist_ok=True)
SLUGS=['good-robot','shortcut-city','little-cafe','who-won','last-fish','everyone-says','average-that-lied']
def run(*args):
    p=subprocess.run(['agent-browser','--session',SESSION,'--args','--mute-audio','--json',*map(str,args)],capture_output=True,text=True,timeout=40)
    if p.returncode:raise RuntimeError(p.stdout+p.stderr)
    r=json.loads(p.stdout)
    if not r['success']:raise RuntimeError(r)
    return r.get('data',{})
def ev(js):return run('eval',js).get('result')
def click(a):
    sel=f'[data-do="{a}"]';run('scrollintoview',sel);run('click',sel)
reports=[]
try:
    for width in [1440,390]:
        for slug in SLUGS:
            run('open',BASE+'/'+slug+'/');run('set','viewport',width,1000 if width>650 else 844)
            # Give this story a real decision to clear.
            sel=ev('document.querySelector("[data-do=choose], [data-do=catch]")?.id')
            if sel:run('click','#'+sel)
            if not ev('SmallWorlds.getState().calm'):click('motion')
            if not ev('Sound.enabled'):click('sound')
            before=ev('SmallWorlds.getState()')
            stored=ev('Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith("small-worlds-v1-")))')
            click('restart')
            assert ev('(()=>{const d=document.getElementById("reset-confirm"),r=d.getBoundingClientRect();return d.open&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&d.contains(document.activeElement)})()')
            assert not ev('isRunning()')
            if slug in ['everyone-says','little-cafe']:
                run('screenshot',str(OUT/(slug+f'-{width}-confirmation.png')))
            audit=run('a11y','--tags','wcag2a,wcag2aa');assert audit['counts']['violations']==0
            run('press','Tab');assert ev('document.getElementById("reset-confirm").contains(document.activeElement)')
            click('cancel-reset');assert not ev('document.getElementById("reset-confirm").open')
            assert ev('SmallWorlds.getState()')==before
            click('restart');run('press','Escape')
            assert not ev('document.getElementById("reset-confirm").open')
            assert ev('SmallWorlds.getState()')==before
            click('restart');click('confirm-reset')
            state=ev('SmallWorlds.getState()')
            assert state['chapter']==0 and state['unlocked']==0 and not state['completed'] and not state['sandbox']
            assert all(not v for v in state['chapters'].values())
            assert state['calm']==before['calm'] and ev('Sound.enabled')
            assert ev('document.activeElement.id')=='scene-title'
            assert ev('scrollY')==0
            after=ev('Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith("small-worlds-v1-")))')
            for key,value in stored.items():
                if key!='small-worlds-v1-'+slug:assert after[key]==value
            run('reload');assert ev('SmallWorlds.getState().unlocked')==0
            reports.append({'game':slug,'width':width,'dialogVisible':True,'cancelAndEscapePreserveState':True,'resetPersists':True,'otherStoriesPreserved':True,'preferencesPreserved':True,'a11yViolations':0})
            print('PASS',slug,width,flush=True)
    (OUT/'results.json').write_text(json.dumps(reports,indent=2))
except Exception:
    try:run('screenshot','--full',str(OUT/'failure.png'))
    except Exception:pass
    raise
