#!/usr/bin/env python3
"""Exercise causal café motion, opt-in audio, and calm mode via real controls."""
import subprocess,json,time,os
from pathlib import Path
SESSION=os.environ.get('SW_SESSION','sw-feel-controls')
BASE=os.environ.get('SW_BASE','http://127.0.0.1:8765')
OUT=Path(os.environ.get('SW_OUTPUT','/tmp/small-worlds-personality/controls'));OUT.mkdir(parents=True,exist_ok=True)
def run(*args):
 p=subprocess.run(['agent-browser','--session',SESSION,'--args','--mute-audio','--json',*map(str,args)],capture_output=True,text=True,timeout=40)
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 r=json.loads(p.stdout)
 if not r['success']:raise RuntimeError(r)
 return r.get('data',{})
def ev(js):return run('eval',js).get('result')
def click(action,value=None):
 sel=f'[data-do="{action}"]'+(f'[data-value="{value}"]' if value is not None else '')
 run('scrollintoview',sel);run('click',sel)
def clock():return ev('({...document.querySelector("[data-cafe-clock]").dataset})')
def check_balance():
 c=clock();busy=ev('[...document.querySelectorAll("[data-service-lane]")].filter(e=>Number(e.dataset.remaining)>0).length')
 assert int(c['arrived'])==int(c['waiting'])+int(c['served'])+busy,c
 return c
run('open',BASE+'/little-cafe/');run('set','viewport',1440,1000)
click('restart');click('confirm-reset')
if ev('Sound.enabled'):click('sound')
assert ev('Sound.ctx===null||Sound.nodes.size===0')
click('choose','no');click('step');c=check_balance();assert float(c['cafeClock'])==5 and c['arrived']=='1' and c['waiting']=='0' and c['served']=='0'
assert ev('!!document.querySelector("[data-actor=customer-0]")')
click('step');c=check_balance();assert float(c['cafeClock'])==9 and c['served']=='1' and c['waiting']=='0'
assert '1 min' in ev('document.querySelector(".arrival-clocks").innerText')
click('step');assert float(check_balance()['cafeClock'])==10
print('PASS individual arrivals, four-minute service, and the one-minute recovery gap',flush=True)
click('play');run('wait','--fn','SmallWorlds.getState().chapters[0].minute > 11');click('pause')
paused=clock()['cafeClock'];time.sleep(.4);assert clock()['cafeClock']==paused
assert ev('document.activeElement.id')=='btn-playback'
click('speed','10');click('play');run('wait','--fn',f'Number(document.querySelector("[data-cafe-clock]").dataset.cafeClock) > {float(paused)+3}');click('pause');check_balance()
print('PASS live clock, speed change, pause, and keyboard focus',flush=True)
click('finish-day');c=check_balance();assert c['arrived']=='48'
counts=ev(r'[...document.querySelectorAll(".arrival-graphs rect title")].map(e=>Number(e.textContent.match(/: (\d+) arrivals/)[1]))')
assert len(counts)==24 and sum(counts)==48 and set(counts)=={2},counts
click('next')
for _ in range(30):
 click('step');c=check_balance()
 if int(c['waiting'])>=2:break
assert int(c['waiting'])>=2
run('scroll','up',5000);run('screenshot',str(OUT/'cafe-burst.png'))
assert len(set(ev('[...document.querySelectorAll("[data-actor]")].map(e=>e.dataset.actor)')))==ev('document.querySelectorAll("[data-actor]").length')
print('PASS uneven arrivals build an actual queue; graph bins conserve the customers',flush=True)
click('sound');assert ev('Sound.enabled && Sound.ctx.state==="running"')
ev('window.checkAnalyser=Sound.ctx.createAnalyser();Sound.bus.connect(checkAnalyser);window.samples=[];window.sampleTimer=setInterval(()=>{const v=new Float32Array(checkAnalyser.fftSize);checkAnalyser.getFloatTimeDomainData(v);samples.push(Math.max(...v.map(Math.abs)));},10)')
click('step');time.sleep(.3)
assert ev('Math.max(...samples)')>.001
click('sound');ev('samples=[]');time.sleep(.25)
assert ev('Sound.nodes.size')==0
# The analyser retains one short FFT window after an oscillator stops.
assert ev('Math.max(...samples.slice(-10))')<.00001
click('sound');run('reload');assert ev('Sound.enabled') and ev('document.getElementById("sound").getAttribute("aria-pressed")')=='true'
assert ev('Sound.ctx===null'),'Reload must not create an autoplay audio context.'
click('sound');run('reload');assert not ev('Sound.enabled')
print('PASS real audio output, immediate mute, persisted preference, and no autoplay',flush=True)
click('motion');assert ev('SmallWorlds.getState().calm')
assert ev('document.getAnimations().filter(a=>a.playState==="running").length')==0
click('play');assert float(clock()['cafeClock'])==240
print('PASS motion-off mode has no running animations and reaches the same result',flush=True)
run('set','media','light','reduced-motion');click('restart');click('confirm-reset')
assert ev('SmallWorlds.getState().calm')
assert ev('document.getAnimations().filter(a=>a.playState==="running").length')==0
for width in [1440,390]:
 run('set','viewport',width,1000 if width>650 else 844)
 assert ev('document.documentElement.scrollWidth===document.documentElement.clientWidth')
audit=run('a11y','--tags','wcag2a,wcag2aa');assert audit.get('counts',{}).get('violations',0)==0,audit.get('violations')
(OUT/'results.json').write_text(json.dumps({'passed':['customer identity','exact service and recovery gap','clock and pause','speed','queue conservation','arrival graph counts','real audio','mute','audio preference persistence','no autoplay','motion off','OS reduced motion','desktop and mobile overflow']},indent=2))
print('PASS operating-system reduced motion and both viewport widths',flush=True)
