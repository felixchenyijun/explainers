/* Play the real notes and game controls; never inject progress or fake content. */
const {chromium}=require(process.env.SW_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const BASE=process.env.SW_BASE||'http://127.0.0.1:8793';
const OUT=process.env.SW_OUTPUT||'/tmp/sw-nutshell/notes-check';
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
 const reports=[];
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:width===390?844:1100}});
   const page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==new URL(BASE).origin){external.push(route.request().url());return route.abort();}
    return route.continue();
   });
   const click=async(a,v)=>page.locator(`[data-do="${a}"]${v===undefined?'':`[data-value="${v}"]`}`).first().click();
   const note=key=>page.locator(`.sw-notes > p > a[href="#${key}"]`);
   const opened=async n=>{await page.waitForFunction(n=>document.querySelectorAll('.nutshell-bubble').length===n,n);await page.waitForTimeout(340);};
   const audit=async name=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');
    assert.equal(await page.locator('.nutshell-bubble').evaluateAll(es=>es.some(e=>/Uh oh|not available/.test(e.textContent))),false,name+' failed note');
    const ids=await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id));assert.equal(new Set(ids).size,ids.length);
    if(process.env.SW_AXE){await page.addScriptTag({path:process.env.SW_AXE});const r=await page.evaluate(()=>axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa']}}));assert.deepEqual(r.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],name);}
    assert.deepEqual(errors,[],name);assert.deepEqual(external,[],name);
    reports.push({width,name});console.log('PASS',width,name);
   };
   const shot=async name=>page.screenshot({path:`${OUT}/${name}-${width}.png`});

   await page.goto(BASE+'/small-worlds/');
   assert.equal(await page.evaluate(()=>Nutshell.version),'v1.0.8');
   const sandbox=page.locator('.collection-notes > p > a');await sandbox.focus();await sandbox.press('Enter');await opened(1);
   assert.equal(await sandbox.getAttribute('aria-expanded'),'true');
   assert.match(await page.locator('.nutshell-bubble').innerText(),/change the rules/);
   const nested=page.locator('.nutshell-bubble a.nutshell-expandable');await nested.focus();await nested.press('Space');await opened(2);
   assert.match(await page.locator('.nutshell-bubble').last().innerText(),/explicit rules/);
   await shot('nested');await audit('collection / keyboard / nested model');
   await nested.press('Escape');await opened(1);assert.equal(await nested.getAttribute('aria-expanded'),'false');
   await nested.press('Enter');await opened(2);await page.getByRole('button',{name:'Close all explanations',exact:true}).click();await opened(0);
   assert.equal(await sandbox.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement?.id),await sandbox.getAttribute('id'));
   assert.equal(new URL(page.url()).hash,'');await audit('close all / focus returned / no navigation');

   await page.goto(BASE+'/everyone-says/');await note('independentclues').click();await opened(1);
   assert.match(await page.locator('.nutshell-bubble').innerText(),/conditional on the jar/);
   await page.locator('.nutshell-bubble a.nutshell-expandable').click();await opened(2);
   assert.match(await page.locator('.nutshell-bubble').last().innerText(),/Five articles/);
   await shot('independent');await audit('clues / nested real-life evidence / repaired anchor');
   await click('choose','blue');assert.equal(await page.locator('.nutshell-bubble').count(),2);
   await click('next');await opened(0);await note('odds').click();await opened(1);
   assert.match(await page.locator('.nutshell-bubble').innerText(),/3 out of 4/);
   await page.locator('.nutshell-bubble-overflow-close').click();await click('choose','red');await click('next');await page.waitForTimeout(350);
   await audit('same-chapter note persistence / next-chapter cleanup');
   await click('play');await page.waitForFunction(()=>SmallWorlds.getState().chapters[2].tick===8);
   await click('confidence','80');await note('informationcascade').click();await opened(1);
   assert.match(await page.locator('.nutshell-bubble').innerText(),/true belief or a false one/);
   await click('motion');assert.equal(await page.locator('.nutshell-bubble').count(),1);
   assert.equal(await page.locator('.nutshell-bubble').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
   await click('restart-chapter');await opened(0);await audit('reduced-motion switch / chapter reset');
   await click('motion');await page.locator('#mode').click();
   await click('play');await page.waitForFunction(()=>SmallWorlds.getState().lab.tick>0&&SmallWorlds.getState().lab.tick<8);
   await note('odds').click();await opened(1);const tick=await page.evaluate(()=>SmallWorlds.getState().lab.tick);
   await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>SmallWorlds.getState().lab.tick),tick);
   assert.equal(await page.evaluate(()=>isRunning()),false);
   await click('step');assert.equal(await page.locator('.nutshell-bubble').count(),1);
   await audit('opening a note pauses live playback / stepping preserves it');
   await click('restart');await click('confirm-reset');await opened(0);
   assert.equal(await page.evaluate(()=>SmallWorlds.getState().chapter),0);await page.reload();await audit('whole-story reset / reload');

   await page.goto(BASE+'/average-that-lied/');await click('choose','more');await click('next');await click('inspect','easy');await click('inspect','hard');
   await note('simpsonsparadox').click();await opened(1);assert.match(await page.locator('.nutshell-bubble').innerText(),/lead in every group/);
   await click('next');await note('weightedaverage').click();await opened(1);
   assert.match(await page.locator('.nutshell-bubble').innerText(),/66%/);
   await page.locator('.nutshell-bubble a.nutshell-expandable').click();await opened(2);
   assert.match(await page.locator('.nutshell-bubble').last().innerText(),/75%/);
   await page.locator('.nutshell-bubble .nutshell-bubble a.nutshell-expandable').click();await opened(3);
   assert.match(await page.locator('.nutshell-bubble').last().innerText(),/16.7%/);
   await page.locator('.sw-notes').scrollIntoViewIfNeeded();await shot('weights');await audit('weighted average / common mix / percentage points');
   await click('swap',10);await click('swap',10);assert.equal(await page.locator('.nutshell-bubble').count(),3);
   assert.equal(await page.locator('[data-shop=a] .repair-score b').innerText(),'72%');
   await click('next');await opened(0);await click('common',20);await click('common',80);await click('next');
   await click('causal-answer','group');await click('case','after');await click('causal-answer','total');
   await note('confounder').click();await note('mediator').click();await opened(2);
   assert.match(await page.locator('.nutshell-bubble').first().innerText(),/shared cause/);
   assert.match(await page.locator('.nutshell-bubble').last().innerText(),/total/);
   await audit('confounder and mediator remain distinct');
   await page.getByRole('button',{name:'Close all explanations',exact:true}).click();await opened(0);
   await click('next');await click('choose','down');await note('percentagepoints').click();await opened(1);await click('next');await opened(0);
   assert.equal(await page.evaluate(()=>SmallWorlds.getState().completed),true);
   await page.locator('#mode').click();await note('weightedaverage').click();await opened(1);
   await click('restart-chapter');await opened(0);await audit('game completion / sandbox reset');
   await context.close();
  }
  const calm=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}}),p=await calm.newPage();
  await p.goto(BASE+'/small-worlds/');await p.locator('.collection-notes > p > a').click();await p.waitForTimeout(350);
  assert.equal(await p.locator('.nutshell-bubble').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await calm.close();
  fs.writeFileSync(OUT+'/results.json',JSON.stringify({reports,errors:[],externalRequests:[],reducedMotion:true},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
