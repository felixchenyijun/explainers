/* Real controls only. Supply Playwright and axe-core from the local QA runtime. */
const {chromium}=require(process.env.SW_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE=process.env.SW_BASE||'http://127.0.0.1:8786',OUT=process.env.SW_OUTPUT||'/tmp/sw-parallels/qa';
const axe=process.env.SW_AXE||require.resolve('axe-core/axe.min.js');
fs.mkdirSync(OUT,{recursive:true});
const reports=[],errors=[];
let page,width;
const state=()=>page.evaluate(()=>SmallWorlds.getState());
const click=async(a,v)=>{if(a==='lab')return page.locator('#mode').click();await page.locator(`[data-do="${a}"]${v===undefined?'':`[data-value="${v}"]`}`).click()};
const has=async(s)=>assert.ok((await page.locator('#app').innerText()).includes(s),s);
async function change(k,v){const el=page.locator('#control-'+k);if(await el.evaluate(e=>e.tagName)==='SELECT')return el.selectOption(String(v));await el.focus();await el.press('Home');const {min,step}=await el.evaluate(e=>({min:+e.min,step:+e.step}));for(let i=0;i<Math.round((v-min)/step);i++)await el.press('ArrowRight');await el.press('Tab');}
async function shot(name,selector){if(selector)await page.locator(selector).first().scrollIntoViewIfNeeded();else await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(OUT,name+'-'+width+'.png')})}
async function check(label,audit=true){
 const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,ids:[...document.querySelectorAll('[id]')].map(e=>e.id)}));
 assert.equal(dimensions.scroll,dimensions.client,label+' overflow');assert.equal(dimensions.ids.length,new Set(dimensions.ids).size,label+' duplicate IDs');
 let violations=[];
 if(audit){if(!await page.evaluate(()=>!!window.axe))await page.addScriptTag({path:axe});violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})).violations);}
 if(violations.length){fs.writeFileSync(path.join(OUT,'a11y-failure.json'),JSON.stringify(violations,null,2));await shot('failure');}
 assert.deepEqual(violations.map(v=>v.id),[],label+' accessibility');reports.push({width,label,violations:violations.length});
 console.log('PASS',width,label);
}
async function next(c){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth));assert.equal((await state()).chapter,c);assert.ok(await page.locator('[data-do=next]').isVisible());await click('next')}
async function start(slug){await page.goto(BASE+'/'+slug+'/');await click('restart');await click('confirm-reset');if(!(await state()).calm)await click('motion');}
async function finish(slug){assert.ok((await state()).completed,slug);await click('lab');assert.ok((await state()).sandbox);await click('lab');assert.equal((await state()).chapter,6);await page.reload();assert.ok((await state()).completed);await check(slug+' completion / sandbox return / persisted progress',false)}
async function simpson(){
 await start('average-that-lied');await has('66%');await has('74%');await shot('simpson-opening');await check('Simpson initial prediction');
 for(const [who,count] of [['a',66],['b',74]])assert.equal(await page.locator(`[data-shop=${who}] .repair-ticket.fixed`).count(),count);
 await click('choose',width===390?'mira':'sol');await next(0);
 await click('inspect','easy');assert.equal(await page.locator('[data-do=next]').count(),0);await click('inspect','hard');await has('18 of 20 fixed');await has('48 of 80 fixed');await shot('simpson-groups');await check('both groups revealed');await next(1);
 await click('swap','10');assert.equal(await page.locator('[data-do=next]').count(),0);await click('swap','10');await has('72 of 100');await has('68');await shot('simpson-flipped');await check('mix exchange reverses ranking');await page.reload();assert.equal((await state()).chapters[2].mix,40);await click('mix-reset');assert.equal(await page.locator('[data-shop=a] .repair-score b').innerText(),'66%');await change('mix',80);await has('84 of 100');await next(2);
 await click('common',20);assert.equal(await page.locator('[data-do=next]').count(),0);await click('common',80);await has('84%');await has('74%');await page.locator('.simpson-proof summary').click();await has('10 percentage points');await shot('simpson-common');await check('common weights and exact proof');await next(3);
 await click('causal-answer',width===390?'total':'group');await has('removes that particular mismatch');await click('case','after');await click('causal-answer',width===390?'group':'total');await has('same practice time can remove');await shot('simpson-causal');await check('causal question and alternate answers');await next(4);
 assert.ok((await page.locator('h1').innerText()).includes('month-end'));assert.ok(!(await page.locator('.overall-row').innerText()).includes('58%'));await click('choose',width===390?'up':'down');await has('72% → 58%');await shot('simpson-transfer');await check('new transfer challenge');await next(5);await finish('average-that-lied');
 await click('lab');await has('A reversal');await change('matched',1);await has('No reversal');await change('mixA',90);await has('87 fixed out of 100');await change('aEasy',0);await change('aHard',100);await has('Each shop leads');await click('restart-chapter');assert.equal((await state()).lab.matched,0);await has('A reversal');await shot('simpson-sandbox');await check('sandbox matching / rates / reset');
 await click('lab');const before=await state();await click('restart');assert.ok(await page.locator('#reset-confirm').evaluate(d=>d.open&&d.getBoundingClientRect().bottom<=innerHeight));await page.keyboard.press('Escape');assert.deepEqual(await state(),before);await click('restart');await click('confirm-reset');assert.equal((await state()).chapter,0);assert.equal((await state()).unlocked,0);await page.reload();assert.equal((await state()).chapter,0);await check('new game restart persists',false);
}
async function traffic(){
 await start('shortcut-city');await click('choose','top');await next(0);await click('choose','faster');await next(1);await click('choose','65');await has('85 minutes');
 await click('adoption',0);await has('25 minutes');assert.ok((await page.locator('.feedback').innerText()).includes('saves you 25 minutes'));assert.ok(!(await page.locator('.feedback').innerText()).includes('85 minutes'));assert.equal(await page.locator('.driver-options').innerText(),'Your outer route\n20 + 45 = 65 min\nYour shortcut route\n20 + 0 + 20 = 40 min');await shot('driver-first','.driver-experiment');await check('first driver individually saves 25 minutes');
 await change('adoption',2000);await has('15 minutes');await click('adoption',4000);await has('5 minutes');await has('40 + 45 = 85 min');await shot('driver-final','.driver-experiment');await check('final driver individually saves 5 minutes');await next(2);
 await click('mode','planned');await has('drivers assigned an outer route');await next(3);await click('choose','helps');await next(4);await click('choose','depends');await next(5);await finish('shortcut-city');
}
async function rumor(){
 await start('everyone-says');await click('choose','blue');await next(0);await click('choose','blue');await next(1);await click('play');await click('confidence','80');await click('probe',1);await next(2);await click('share',1);await next(3);await click('order','blue');await click('communication','clues');await click('order','red');await next(4);await click('trace-sources');await click('source-answer','tie');await click('source-case',1);await click('source-answer','red');await next(5);
 for(const [key,correct,wrong] of [['news','trace','count'],['shopping','test','opposite'],['meeting','private','leader']]){
  await click('life-case',key);await click('life-answer',width===390?wrong:correct);await shot('everyday-'+key,'.life-application');await check('everyday '+key+' practical feedback');
  await click('life-retry');assert.equal(await page.locator('[data-do=life-answer]').count(),3);await click('life-answer',correct);
 }
 await has('3 of 3 situations explored');const st=await state();await page.reload();assert.deepEqual((await state()).chapters[6].lifeAnswers,st.chapters[6].lifeAnswers);await finish('everyone-says');await click('restart-chapter');assert.equal((await state()).chapters[6].lifeAnswers,undefined);await check('everyday chapter reset',false);
}
async function existing(slug){
 await start(slug);
 if(slug==='good-robot'){
  await click('choose','three');await click('play');await next(0);await click('play');await next(1);await click('choose','bin');await click('play');await next(2);await click('play');await next(3);await click('play');await has('broken');await click('protect');await click('play');await next(4);await click('choose','resolved');await next(5);
 }else if(slug==='little-cafe'){
  await click('choose','no');await click('play');await next(0);await click('play');await next(1);await click('choose','little');await click('play');await next(2);await click('staff','2');await click('play');await next(3);await click('choose','smooth');await click('play');await next(4);await click('choose','slack');await next(5);
 }else if(slug==='who-won'){
  for(const [c,v] of ['B','A','C','B','no','B'].entries()){await click('choose',v);await next(c)}
 }else{
  for(const v of ['6','4','2'])await click('catch',v);await next(0);await click('choose','yes');await click('play');await next(1);await click('play');await next(2);await click('play');await click('monitor','1');await click('play');await next(3);await click('play');await change('quota',1);await click('play');await next(4);await click('choose','lower');await next(5);
 }
 await finish(slug);
}
async function collection(){
 const expected=['little-cafe','shortcut-city','everyone-says','good-robot','who-won','last-fish','average-that-lied'];
 await page.goto(BASE+'/small-worlds/');assert.deepEqual(await page.locator('.game-link').evaluateAll(es=>es.map(e=>e.getAttribute('href').split('/')[1])),expected);await shot('collection');await check('collection order');
 await page.goto(BASE+'/');assert.deepEqual((await page.locator('#entries li[data-category="Playable stories"] h2 a').evaluateAll(es=>es.map(e=>e.getAttribute('href').split('/')[0]))).slice(1),expected);await check('directory order',false);
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
 try{
 for(width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width>650?1000:844},deviceScaleFactor:1});page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await collection();await simpson();await traffic();await rumor();if(width===1440)for(const slug of ['little-cafe','good-robot','who-won','last-fish'])await existing(slug);assert.deepEqual(errors,[]);await context.close();
 }
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({reports,errors},null,2));console.log('PASS all new interactions on desktop and phone');
 }catch(e){if(page&&!page.isClosed())await page.screenshot({path:path.join(OUT,'failure.png'),fullPage:true});throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
