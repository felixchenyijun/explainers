import {chapters} from './chapters.js';
import {createStage,getExperiment} from './scenes.js';
const $=id=>document.getElementById(id);
const groupNames=['One request, from the inside','Memory, computation & reuse','Sharing the work','From a laptop to a fleet'];
const shortGroups=['01 · One request','02 · Memory & reuse','03 · Sharing the work','04 · Real systems'];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={index:0,step:0,progress:1,value:.5,playing:false,autoplay:false,elapsed:0,zoom:false};
const clamp=(v,low=0,high=1)=>Math.max(low,Math.min(high,v));
const chapter=()=>chapters[state.index];
const step=()=>chapter().steps[state.step];
const text=(id,value)=>{$(id).textContent=value;};
let stage=null,utterance=null,speechActive=false;
try{stage=createStage($('stage'));}catch(error){$('fallback').hidden=false;console.error('WebGL unavailable',error);}
const render=()=>{stage?.render(chapter().id,state.step,state.progress,state.value);$('progress').style.width=`${state.progress*100}%`;};
function cancelSpeech(){if(utterance){utterance.onend=null;utterance.onerror=null;}utterance=null;speechActive=false;if('speechSynthesis' in window)speechSynthesis.cancel();}
function speak(){
 cancelSpeech();if(!$('voice').checked)return;
 const voice=speechSynthesis.getVoices().find(v=>v.localService&&/^en[-_]/i.test(v.lang));
 if(!voice){$('voice').checked=false;text('status','A local English voice is unavailable. Read the explanation below.');return;}
 const a=step();utterance=new SpeechSynthesisUtterance(`${a.title}. ${a.body} ${a.insight}`);utterance.voice=voice;utterance.rate=.94;speechActive=true;
 const current=utterance;const finished=()=>{if(utterance===current)speechActive=false;};utterance.onend=finished;utterance.onerror=finished;speechSynthesis.speak(utterance);
}
if(!('speechSynthesis' in window))$('voice').disabled=true;
function syncTransport(){
 text('play',state.playing?'Ⅱ Pause':'↻ Replay this step');
 $('play').setAttribute('aria-label',state.playing?'Pause animation':'Replay this step');
 $('watch').setAttribute('aria-pressed',String(state.autoplay));text('watch',state.autoplay?'■ Stop whole lesson':'▶ Watch whole lesson');
 $('back').disabled=state.step===0;
 text('forward',state.step===5?'Next lesson →':'Continue →');$('forward').disabled=state.step===5&&state.index===chapters.length-1;
 if(state.playing)text('status',state.autoplay?'Automatic pacing · pause whenever you want to think':'One transition, then a pause.');
 else text('status','Take your time. Change a number, predict the result, then continue.');
}
function pause(){state.playing=false;state.autoplay=false;cancelSpeech();syncTransport();}
function writeHash(push=false){const hash=`#${chapter().id}${state.step?'/'+(state.step+1):''}`;if(location.hash!==hash)history[push?'pushState':'replaceState'](null,'',hash);}
function experiment(){
 const e=getExperiment(chapter().id,state.value);
 text('control-label',e.label);text('control-value',e.valueLabel);text('experiment-equation',e.formula);text('experiment-copy',e.summary);
 $('parameter').setAttribute('aria-valuetext',`${e.label}: ${e.valueLabel}`);
 $('metrics').replaceChildren(...e.metrics.map(m=>{const box=document.createElement('div');box.className='metric';const dt=document.createElement('dt');dt.textContent=m.label;const dd=document.createElement('dd');dd.textContent=m.value;box.append(dt,dd);return box;}));
}
function updateStep(){
 const c=chapter(),a=step();
 text('scene-title',`${String(state.step+1).padStart(2,'0')} / 06 · ${a.title}`);text('equation',a.equation);
 text('kicker',a.kicker);text('step-title',a.title);text('body',a.body);text('insight',a.insight);text('challenge',a.challenge);text('answer',a.answer);
 $('answer').hidden=true;$('answer-toggle').setAttribute('aria-expanded','false');text('answer-toggle','Reveal the reasoning');
 $('stage').setAttribute('aria-label',`${c.title}. Step ${state.step+1}: ${a.title}. ${a.insight}`);
 [...$('steps').children].forEach((button,i)=>{if(i===state.step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 syncTransport();experiment();render();
}
function setStep(index,{animate=false,keepAuto=false,hash=true}={}){
 cancelSpeech();state.step=clamp(Math.trunc(Number(index)||0),0,5);state.elapsed=0;state.progress=animate&&!reduced.matches?0:1;state.playing=animate&&(!reduced.matches||keepAuto);state.autoplay=keepAuto&&state.playing;
 updateStep();if(hash)writeHash();if(state.playing)speak();
}
function loadLesson(index,initialStep=0,push=false){
 pause();state.index=clamp(index,0,chapters.length-1);state.value=chapter().control?.value??.5;state.zoom=false;$('canvas-wrap').classList.remove('zoomed');$('stage').style.width='';$('stage').style.height='';$('zoom').setAttribute('aria-pressed','false');text('zoom','Enlarge diagram');stage?.resize();
 const c=chapter();document.title=`${c.title} · Inside inference`;
 text('title',c.question);text('thesis',c.thesis);text('chapter-label',groupNames[c.group]);text('lesson-count',`${String(state.index+1).padStart(2,'0')} / 15 · SIX STEPS`);
 $('lesson-select').value=c.id;$('parameter').value=state.value;
 document.querySelectorAll('.lesson').forEach((b,i)=>b.setAttribute('aria-current',String(i===state.index)));
 $('steps').replaceChildren(...c.steps.map((a,i)=>{const button=document.createElement('button');button.className='step-link';button.dataset.step=i;const n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');button.append(n,document.createTextNode(a.title));button.onclick=()=>setStep(i);return button;}));
 $('transcript-content').replaceChildren(...c.steps.map((a,i)=>{const part=document.createElement('section');const h=document.createElement('h3');h.textContent=`${i+1}. ${a.title}`;const p=document.createElement('p');p.textContent=a.body;const eq=document.createElement('p');eq.textContent=a.equation;part.append(h,p,eq);return part;}));
 $('deep-dive').replaceChildren(...c.deepDive.map(content=>{const p=document.createElement('p');p.textContent=content;return p;}));
 $('sources').replaceChildren(...c.sources.map(source=>{const a=document.createElement('a');a.textContent=source.label;a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';return a;}));
 $('previous-lesson').disabled=state.index===0;$('next-lesson').disabled=state.index===chapters.length-1;
 text('next-lesson',state.index<chapters.length-1?`${chapters[state.index+1].title} →`:'Course complete');$('transcript').open=false;
 setStep(initialStep,{hash:false});writeHash(push);
}
for(let group=0;group<4;group++){
 const label=document.createElement('div');label.className='group';label.textContent=shortGroups[group];$('playlist').append(label);
 const opts=document.createElement('optgroup');opts.label=shortGroups[group];
 chapters.forEach((c,i)=>{if(c.group!==group)return;const b=document.createElement('button');b.className='lesson';b.dataset.lesson=c.id;const n=document.createElement('span');n.className='number';n.textContent=String(i+1).padStart(2,'0');const title=document.createElement('span');title.textContent=c.title;b.append(n,title);b.onclick=()=>loadLesson(i,0,true);$('playlist').append(b);const option=document.createElement('option');option.value=c.id;option.textContent=`${i+1}. ${c.title}`;opts.append(option);});$('lesson-select').append(opts);
}
$('skip').onclick=e=>{e.preventDefault();$('main').focus({preventScroll:true});$('main').scrollIntoView({block:'start'});};
$('back').onclick=()=>setStep(state.step-1);
$('forward').onclick=()=>{if(state.step<5)setStep(state.step+1,{animate:true});else if(state.index<chapters.length-1)loadLesson(state.index+1,0,true);};
$('play').onclick=()=>{if(state.playing){pause();return;}state.elapsed=0;state.progress=0;state.playing=true;state.autoplay=false;syncTransport();speak();render();};
$('watch').onclick=()=>{if(state.autoplay){pause();return;}state.step=0;state.elapsed=0;state.progress=reduced.matches?1:0;state.playing=true;state.autoplay=true;updateStep();writeHash();speak();};
$('answer-toggle').onclick=()=>{const reveal=$('answer').hidden;$('answer').hidden=!reveal;$('answer-toggle').setAttribute('aria-expanded',String(reveal));text('answer-toggle',reveal?'Hide the reasoning':'Reveal the reasoning');};
$('parameter').oninput=e=>{pause();state.value=Number(e.target.value);state.progress=1;experiment();render();};
$('voice').onchange=()=>{if(!$('voice').checked)cancelSpeech();else if(state.playing)speak();};
$('previous-lesson').onclick=()=>loadLesson(state.index-1,0,true);$('next-lesson').onclick=()=>loadLesson(state.index+1,0,true);
$('lesson-select').onchange=e=>loadLesson(chapters.findIndex(c=>c.id===e.target.value),0,true);
$('zoom').onclick=()=>{state.zoom=!state.zoom;$('canvas-wrap').classList.toggle('zoomed',state.zoom);$('stage').style.width=state.zoom?`${Math.max(1100,$('canvas-wrap').clientWidth*1.4)}px`:'';$('stage').style.height=state.zoom?`${Math.max(1100,$('canvas-wrap').clientWidth*1.4)/2}px`:'';$('zoom').setAttribute('aria-pressed',String(state.zoom));text('zoom',state.zoom?'Fit diagram':'Enlarge diagram');stage?.resize();render();};
function fromHash(){const [id,rawStep]=location.hash.slice(1).split('/');const index=chapters.findIndex(c=>c.id===id);loadLesson(index<0?0:index,clamp((Number(rawStep)||1)-1,0,5));}
window.addEventListener('hashchange',fromHash);
window.addEventListener('resize',()=>{stage?.resize();render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
reduced.addEventListener('change',()=>{pause();state.progress=1;render();});
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.code==='ArrowRight'){e.preventDefault();$('forward').click();}if(e.code==='ArrowLeft'){e.preventDefault();$('back').click();}});
let previousTime=0;
function tick(time){const dt=previousTime?Math.min(.1,(time-previousTime)/1000):0;previousTime=time;
 if(state.playing){state.elapsed+=dt;state.progress=reduced.matches?1:clamp(state.elapsed/10);render();
  const duration=state.autoplay?Math.max(28,(step().body.split(/\s+/).length+step().insight.split(/\s+/).length)/2.25+6):10;
  if(state.elapsed>=duration&&!speechActive){if(state.autoplay&&state.step<5)setStep(state.step+1,{animate:true,keepAuto:true});else pause();}
 }
 requestAnimationFrame(tick);
}
fromHash();requestAnimationFrame(tick);
window.studio={getState:()=>({...state,id:chapter().id,webgl:Boolean(stage)}),show:(id,stepIndex=0,progress=1,value=.5)=>{const i=chapters.findIndex(c=>c.id===id);if(i<0)throw Error('Unknown lesson');loadLesson(i,stepIndex);state.progress=clamp(progress);state.value=clamp(value);$('parameter').value=state.value;experiment();render();},getExperiment:()=>getExperiment(chapter().id,state.value),selfCheck:()=>{if(chapters.length!==15||chapters.some(c=>c.steps.length!==6||!c.sources.length))throw Error('Incomplete course');for(const c of chapters)for(const s of c.steps)for(const field of ['title','body','equation','challenge','answer'])if(!s[field])throw Error(`${c.id} missing ${field}`);return{passed:true,lessons:15,steps:90,webgl:Boolean(stage)};}};
