/* Small, original Foley sounds. Nothing is loaded or played before opt-in. */
const Sound={
 enabled:false,ctx:null,bus:null,nodes:new Set(),lastScene:null,lastObserved:null,
 read(){try{return localStorage.getItem('small-worlds-sound')==='on';}catch{return false;}},
 init(){if(!this.enabled)return;try{if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.ctx=new Audio();this.bus=this.ctx.createGain();this.bus.gain.value=.28;this.bus.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}},
 update(){const b=document.getElementById('sound');if(!b)return;b.innerHTML=`<span aria-hidden="true">${this.enabled?'♪':'♩'}</span> Sound ${this.enabled?'on':'off'}`;b.setAttribute('aria-pressed',String(this.enabled));b.title=this.enabled?'Mute sound effects':'Turn on gentle sound effects';},
 set(value){this.enabled=value;try{localStorage.setItem('small-worlds-sound',value?'on':'off');}catch{}if(value){this.init();if(this.bus)this.bus.gain.setValueAtTime(.28,this.ctx.currentTime);}else this.silence();this.update();},
 silence(){for(const n of this.nodes){try{n.stop();}catch{}}this.nodes.clear();},
 tone(freq,duration=.1,delay=0,type='sine',volume=.18,to=freq){if(!this.ctx||this.ctx.state!=='running')return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.bus);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();};o.start(t);o.stop(t+duration+.02);},
 noise(duration=.09,frequency=1000,volume=.13,delay=0){if(!this.ctx||this.ctx.state!=='running')return;const t=this.ctx.currentTime+delay,n=this.ctx.createBufferSource(),b=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*duration),this.ctx.sampleRate),samples=b.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);n.buffer=b;const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=frequency;f.Q.value=.7;const g=this.ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);n.connect(f);f.connect(g);g.connect(this.bus);this.nodes.add(n);n.onended=()=>{this.nodes.delete(n);n.disconnect();f.disconnect();g.disconnect();};n.start(t);n.stop(t+duration+.02);},
 play(kind){if(!this.enabled||document.hidden)return;this.init();if(!this.ctx||this.ctx.state!=='running')return;
  switch(kind){
   case 'on':this.tone(440,.12);this.tone(660,.18,.1);break;
   case 'page':this.noise(.13,1100,.15);this.tone(340,.07,.04,'sine',.06);break;
   case 'complete':[392,494,587,784].forEach((f,i)=>this.tone(f,.26,i*.085,'sine',.13));break;
   case 'put':case 'cup':this.tone(880,.15,0,'sine',.2);this.tone(1320,.11,.035,'sine',.07);break;
   case 'take':this.tone(360,.13,0,'triangle',.13,660);break;
   case 'hide':this.noise(.19,700,.22);break;
   case 'sweep':this.noise(.16,2300,.22);[1150,760,1480].forEach((f,i)=>this.tone(f,.09,i*.04,'triangle',.1,f*.75));break;
   case 'water':this.tone(510,.16,0,'sine',.24,110);this.noise(.09,550,.08,.025);break;
   case 'ballot':[440,554,660].forEach((f,i)=>this.tone(f,.15,i*.055,'sine',.12));break;
   case 'road':this.noise(.16,500,.12);this.tone(170,.11,0,'triangle',.08,280);break;
   case 'clue':this.noise(.07,1800,.12);this.tone(590,.12,.035,'sine',.14);break;
   case 'arrival':this.noise(.05,480,.15);this.noise(.05,650,.12,.08);break;
   default:this.noise(.045,1500,.17);this.tone(410,.045,0,'sine',.06);
  }
 },
 observe(context){const cafe=document.querySelector('[data-cafe-clock]'),pip=document.querySelector('[data-sound]');const now={tick:data().tick||0,arrived:Number(cafe?.dataset.arrived||0),served:Number(cafe?.dataset.served||0)};
  if(context===this.lastScene&&this.lastObserved){const old=this.lastObserved;if(cafe&&now.tick>old.tick){if(now.served>old.served)this.play('cup');else if(now.arrived>old.arrived)this.play('arrival');}else if(now.tick>old.tick){if(pip&&pip.dataset.sound!=='wait')this.play(pip.dataset.sound);else if(G.slug==='last-fish')this.play('water');else if(G.slug==='everyone-says')this.play('clue');}}
  this.lastScene=context;this.lastObserved=now;
 },
 action(action){if(['choose','mode','order','share','signal','catch','staff','protect','inspect','swap','common','causal-answer','life-case','life-answer','adoption'].includes(action))this.play(G.slug==='who-won'?'ballot':G.slug==='shortcut-city'?'road':G.slug==='last-fish'?'water':G.slug==='everyone-says'?'clue':'tap');}
};
Sound.enabled=Sound.read();
const Motion={context:null,
 before(){const phases=new Map(),actors=new Map();for(const el of document.querySelectorAll('[data-motion]')){phases.set(el.dataset.motion,el.getAnimations().filter(a=>a.animationName).map(a=>({name:a.animationName,time:a.currentTime})));}for(const el of document.querySelectorAll('[data-actor]')){const mover=el.querySelector('.actor-move'),m=new DOMMatrix(getComputedStyle(mover).transform),scale=Number(el.dataset.scale);actors.set(el.dataset.actor,{x:Number(el.dataset.x)+m.e*scale,y:Number(el.dataset.y)+m.f*scale});}return {phases,actors,context:this.context};},
 after(old){const context=G.slug+'-'+S.sandbox+'-'+S.chapter;this.context=context;Sound.observe(context);if(S.calm||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const same=old.context===context;for(const el of document.querySelectorAll('[data-motion]')){const phases=same?old.phases.get(el.dataset.motion):null;if(phases)for(const a of el.getAnimations()){const p=phases.find(p=>p.name===a.animationName);if(p&&p.time!==null)a.currentTime=p.time;}}
  if(same)for(const el of document.querySelectorAll('[data-actor]')){const previous=old.actors.get(el.dataset.actor);if(!previous)continue;const scale=Number(el.dataset.scale),dx=(previous.x-Number(el.dataset.x))/scale,dy=(previous.y-Number(el.dataset.y))/scale;if(Math.abs(dx)+Math.abs(dy)>.1)el.querySelector('.actor-move').animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:G.slug==='little-cafe'?170:480,easing:'cubic-bezier(.22,.7,.25,1)'});}
 }
};
