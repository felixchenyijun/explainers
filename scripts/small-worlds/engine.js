let S,timer=null;
const KEY='small-worlds-v1-'+G.slug;
function fresh(){return {version:1,chapter:0,unlocked:0,chapters:{},lab:structuredClone(G.initialLab),sandbox:false,completed:false,calm:matchMedia('(prefers-reduced-motion: reduce)').matches};}
try{const raw=JSON.parse(localStorage.getItem(KEY));S=raw&&raw.version===1?{...fresh(),...raw,lab:{...G.initialLab,...raw.lab}}:fresh();if(!Number.isInteger(S.chapter)||S.chapter<0||S.chapter>=G.chapters.length||typeof S.chapters!=='object')S=fresh();}catch{S=fresh();}
function data(){return S.sandbox?S.lab:(S.chapters[S.chapter]||=( {} ));}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch{}}
function stop(){if(timer)clearInterval(timer);timer=null;}
function isRunning(){return timer!==null;}
function animate(end,ms){stop();const target=data();if(S.calm){target.tick=end;render();return;}timer=setInterval(()=>{target.tick=Math.min(end,(target.tick||0)+1);if(target.tick===end)stop();render();},ms);}
function animateCafe(){stop();const target=data();if(S.calm){target.minute=240;target.tick=12;render();return;}let last=performance.now();timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.2,(now-last)/1000);last=now;target.minute=Math.min(240,(target.minute??(target.tick||0)*20)+dt*(target.speed||2));target.tick=target.minute/20;if(target.minute>=240)stop();render();},90);}
function render(moveFocus=false){
 const motion=Motion.before(),focus=document.activeElement?.id;
 const scene=G.render();document.body.classList.toggle('calm',S.calm);
 document.getElementById('app').innerHTML=scene.html+(scene.ready?`<div class="nextrow"><span class="hint">${S.chapter===G.chapters.length-2?'A new setting, the same idea.':'Your next decision builds on this one.'}</span>${U.button(scene.next||'Keep going →','next')}</div>`:'')+`<nav class="progress" aria-label="Story chapters">${G.chapters.map((name,i)=>`<button class="${i===S.chapter&&!S.sandbox?'current ':''}${i<=S.unlocked?'visited':''}" data-do="goto" data-value="${i}" ${i>S.unlocked?'disabled':''} aria-label="Chapter ${i+1}: ${name}" ${i===S.chapter&&!S.sandbox?'aria-current="step"':''}></button>`).join('')}</nav><p class="chapter-meta">${S.sandbox?'SANDBOX · your rules':`${String(S.chapter+1).padStart(2,'0')} / ${String(G.chapters.length).padStart(2,'0')} · ${G.chapters[S.chapter]}`}</p><details class="sources"><summary>Inside this little world: assumptions & sources</summary><p>${G.model}</p><ul>${G.sources.map(([name,url])=>`<li><a href="${url}" target="_blank" rel="noopener">${name} ↗</a></li>`).join('')}</ul><p>Original art and simulation. Inspired by the learning-through-play structure of <a href="https://ncase.me/trust/" target="_blank" rel="noopener">The Evolution of Trust</a> by Nicky Case. No accounts or tracking. Progress is stored only in this browser.</p></details>`;
 document.getElementById('mode').textContent=S.sandbox?'Return to story':'Sandbox';
 document.getElementById('motion').textContent=S.calm?'Motion off':'Motion on';
 document.getElementById('motion').setAttribute('aria-pressed',String(!S.calm));
 document.getElementById('back').hidden=S.sandbox||S.chapter===0;
 if(moveFocus){document.getElementById('scene-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}else if(focus){document.getElementById(focus)?.focus({preventScroll:true});}
 Sound.update();Motion.after(motion);save();
}
function go(c){stop();Sound.play(c===G.chapters.length-1?'complete':'page');S.sandbox=false;S.chapter=c;S.unlocked=Math.max(S.unlocked,c);if(c===G.chapters.length-1)S.completed=true;render(true);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b||b.disabled)return;const a=b.dataset.do,v=b.dataset.value;
 if(a==='sound'){Sound.set(!Sound.enabled);if(Sound.enabled)Sound.play('on');return;}
 Sound.init();
 if(a==='next'){if(G.render().ready)go(Math.min(G.chapters.length-1,S.chapter+1));return;}
 if(a==='back'){go(Math.max(0,S.chapter-1));return;}
 if(a==='goto'){const n=Number(v);if(n<=S.unlocked)go(n);return;}
 if(a==='lab'){stop();S.sandbox=!S.sandbox;render(true);return;}
 if(a==='motion'){S.calm=!S.calm;if(S.calm&&timer)stop();render();return;}
 if(a==='pause'){stop();Sound.silence();render();return;}
 if(a==='restart'){document.getElementById('reset-confirm').hidden=false;return;}
 if(a==='cancel-reset'){document.getElementById('reset-confirm').hidden=true;return;}
 if(a==='confirm-reset'){stop();S=fresh();document.getElementById('reset-confirm').hidden=true;render(true);return;}
 G.act(a,v);Sound.action(a);render();if(a==='play'&&G.slug==='little-cafe')document.querySelector('.cafe-dashboard')?.scrollIntoView({block:'start',behavior:'instant'});
});
document.addEventListener('input',e=>{if(e.target.matches('input[type=range][data-key]'))document.getElementById('out-'+e.target.dataset.key).textContent=e.target.value+(e.target.dataset.unit||'');});
document.addEventListener('change',e=>{if(!e.target.dataset.key)return;stop();G.change(e.target.dataset.key,e.target.value);Sound.play('tap');render();});
window.addEventListener('pagehide',()=>{stop();Sound.silence();save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();Sound.silence();render();}});
window.addEventListener('storage',e=>{if(e.key==='small-worlds-sound'){Sound.enabled=Sound.read();if(!Sound.enabled)Sound.silence();Sound.update();}});
window.SmallWorlds={getState:()=>structuredClone(S),model:Models,game:G.slug};
render();
