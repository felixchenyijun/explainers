#!/usr/bin/env python3
import importlib.util,json,os
from pathlib import Path
spec=importlib.util.spec_from_file_location('playtest',Path(__file__).with_name('playtest.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
run,ev,click,change=p.run,p.evaluate,p.click,p.change
reports=[]
def begin(slug):p.start(slug);click('lab')
def assert_text(s):assert s in ev('document.getElementById("app").innerText'),s
def finish(slug):
 before=ev('SmallWorlds.getState()');click('restart-chapter')
 assert ev('JSON.stringify(SmallWorlds.getState().lab)===JSON.stringify(G.initialLab)'),(slug,'sandbox reset')
 assert ev('SmallWorlds.getState().chapters')==before['chapters'],(slug,'story progress changed')
 for width in [390,1440]:
  run('set','viewport',width,900)
  assert not ev('document.documentElement.scrollWidth>innerWidth'),(slug,width)
 a=run('a11y','--tags','wcag2a,wcag2aa')
 reports.append({'game':slug,'a11y':a.get('counts'), 'violations':a.get('violations',[])})
 assert a.get('counts',{}).get('violations',0)==0,(slug,a.get('violations'))
 assert not ev('performance.getEntriesByType("resource").filter(e=>/^https?:/.test(e.name)&&!e.name.startsWith(location.origin)).length'), 'external runtime request'
 print('PASS sandbox + accessibility + widths:',slug,flush=True)
begin('good-robot');change('deposit',0);change('disposed',2);change('broken',-10);click('play');assert_text('This contract passed this room.');assert_text('vase safe');finish('good-robot')
begin('shortcut-city');change('n',2000);assert_text('40 minutes — faster');change('n',10000);assert_text('95 minutes — unchanged');change('mode','planned');change('share',50);assert_text('assigned routes');finish('shortcut-city')
begin('little-cafe');change('rate',30);click('play');assert_text('Demand meets or exceeds capacity.');change('rate',14);change('variable',0);click('play');assert_text('0 minutes of average waiting.');finish('little-cafe')
begin('who-won');change('preset','majority');change('rule','borda');assert_text('Buns wins.');change('preset','cycle');assert_text('There is no candidate who strictly beats both others');
for k in ['n0','n1','n2']:change(k,0)
assert_text('No voters, no winner.');finish('who-won')
begin('last-fish');change('quota',3);change('monitor',1);change('defector',1);click('play');assert_text('fish remain.');change('shock',1);click('play');assert_text('The lake emptied.');change('quota',1);click('play');assert_text('fish remain.');finish('last-fish')
begin('everyone-says');change('share',1);click('play');assert_text('16:1 blue');click('signal','0');click('play');assert_text('64:1 blue');finish('everyone-says')
(p.OUT/'sandbox-results.json').write_text(json.dumps(reports,indent=2))
print('Six sandboxes passed control, counterexample, accessibility, and responsive checks.')
