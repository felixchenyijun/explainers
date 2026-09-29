import {SolarScene} from './scene.js';
import {AU,DAY,START,END,utcToTDB,hermite,prepareSmall,smallPosition,distance,fmtDistance,fmtPeriod} from './physics.js';
import {VISUALS,REGIONS} from './worlds.js';
import {orientationAngles,orientationMatrix,equatorialToRender} from './orientation.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t),logLerp=(a,b,t)=>Math.exp(lerp(Math.log(a),Math.log(b),t));
let catalog,orientation,view,bodies=[],small=[],all=[],byId=new Map(),byName=new Map(),labels=new Map(),loadingCount=0,searchLimit=90,navPinned=false,navTimer,toastTimer,lastUI=0,lastSmall=-Infinity,lastLabel=0,flightSerial=0;
let saved=[];try{saved=JSON.parse(localStorage.getItem('solar-atlas-checkpoints-v1')||'[]');if(!Array.isArray(saved))saved=[];}catch{}
const state={time:Math.max(START,Math.min(END,Date.now())),jd:0,playing:false,speed:86400,direction:1,selected:null,origin:new Float64Array(3),distance:480000,yaw:1,pitch:.35,flight:null,flags:{labels:true,markers:true,orbits:true,small:true,activity:true,regions:true,stars:true,fill:true}};
state.jd=utcToTDB(state.time);
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
async function readGzip(url,json=false){const r=await fetch(url);if(!r.ok)throw Error(`Could not load ${url.split('/').pop()} (${r.status}).`);const stream=r.body.pipeThrough(new DecompressionStream('gzip')),response=new Response(stream);return json?response.json():response.arrayBuffer();}
async function loadBody(b){
 if(!b?.ephem||b.data)return;if(b.loading)return b.loading;
 b.loading=(async()=>{loadingCount++;try{const buf=await readGzip('data/'+b.ephem.file);b.data=new Float64Array(buf);if(b.data.length!==b.ephem.count*6)throw Error('Invalid trajectory length for '+b.name);b.localState=new Float64Array(6);b.pos=new Float64Array(3);return b;}finally{loadingCount--;b.loading=null;}})();return b.loading;
}
async function loadSystem(name){
 const group=bodies.filter(b=>b.parent===name&&b.ephem&&!b.data);let index=0;
 const worker=async()=>{while(index<group.length){const b=group[index++];try{await loadBody(b);}catch(e){b.loadError=true;console.warn(e.message);}}};
 await Promise.all(Array.from({length:4},worker));
}
function updatePositions(){
 state.jd=utcToTDB(state.time);
 for(const b of bodies){
  if(b.id==='10'){b.pos=[0,0,0];continue;}
  if(!b.data)continue;
  hermite(b.data,b.ephem,state.jd,b.localState);const p=byName.get(b.parent)?.pos||[0,0,0];
  for(let i=0;i<3;i++)b.pos[i]=b.localState[i]+p[i];
 }
 if(state.selected?.basis)smallPosition(state.selected,state.jd,state.selected.pos);
 if(small.length&&Math.abs(state.jd-lastSmall)>1e-7){
  for(let i=0;i<small.length;i++)smallPosition(small[i],state.jd,view.smallCoords,i*3);
  lastSmall=state.jd;
 }
}
function positionOf(b){if(b.type==='region')return byName.get(b.scope)?.pos||[0,0,0];return b.pos||[0,0,0];}
function defaultDistance(b){const fit=Math.max(1,innerHeight/innerWidth*.67);if(b.type==='region')return b.distance*fit;const radius=b.radius||50;return radius*(b.name==='Saturn'?8.2:b.name==='Sun'?5.5:5.3)*fit;}
function scope(b){return b.type==='region'?b.scope:b.type==='moon'?b.parent:b.name;}
async function go(id,options={}){
 const target=byId.get(String(id));if(!target)return;
 const serial=++flightSerial;
 if(target.unavailable){showUnavailable(target);return;}
 const focal=target.type==='region'?byName.get(target.scope):target;
 state.navigationPending=serial;
 if(focal?.ephem&&!focal.data){$('flight').hidden=false;$('flight-phase').textContent='LOADING TRAJECTORY';$('flight-title').textContent='Preparing '+focal.name;$('flight-progress').style.width='0%';try{await loadBody(focal);}catch(e){state.navigationPending=null;$('flight').hidden=true;toast(e.message);return;}}
 if(serial!==flightSerial)return;
 if(target.basis){target.pos=new Float64Array(3);smallPosition(target,state.jd,target.pos);view.makeBody(target);view.updateOrbit(target,state.jd);}
 updatePositions();
 const old=state.selected,newDistance=options.distance||defaultDistance(target),sep=distance(state.origin,positionOf(target));
 const start=Array.from(state.origin),oldDistance=state.distance;
 const aim=positionOf(target);let yaw=state.yaw,pitch=state.pitch;
 if(target.type==='region'){pitch=.72;yaw=.35;}
 else if(Math.hypot(...aim)>1000){
  // Arrive on the illuminated side, slightly off the Sun-object axis.
  yaw=Math.atan2(-aim[0],aim[1])+.45;pitch=.3;
  if(target.name==='Saturn'){
   const n=equatorialToRender(orientationMatrix(orientation[target.id],state.jd)[2]);
   const s=[-aim[0],-aim[2],aim[1]],length=Math.hypot(...s);for(let i=0;i<3;i++)s[i]/=length;
   const side=n.reduce((sum,x,i)=>sum+x*s[i],0)>=0?1:-1;
   const d=s.map((x,i)=>x+n[i]*side*.9),len=Math.hypot(...d);yaw=Math.atan2(d[0],d[2]);pitch=Math.asin(d[1]/len);
  }
 }
 if(options.yaw!==undefined)yaw=options.yaw;if(options.pitch!==undefined)pitch=options.pitch;
 state.selected=target;updateInspector();renderDestinations();
 state.navigationPending=null;
 if(options.instant||matchMedia('(prefers-reduced-motion: reduce)').matches){state.origin.set(positionOf(target));state.distance=newDistance;state.yaw=yaw;state.pitch=pitch;state.flight=null;$('flight').hidden=true;}
 else{
  state.flight={start:performance.now(),duration:sep>oldDistance*3?6000:3200,from:start,old:old?.id,to:target.id,fromDistance:oldDistance,toDistance:newDistance,apex:Math.max(oldDistance,newDistance,sep*1.3),fromYaw:state.yaw,toYaw:yaw,fromPitch:state.pitch,toPitch:pitch};
  $('flight').hidden=false;$('flight-title').textContent='En route to '+target.name;
 }
 if(!navPinned)closeNav();
 loadSystem(scope(target)).then(()=>{updatePositions();updateInspector();}).catch(()=>{});
 if(target.type!=='region')history.replaceState(null,'','#'+encodeURIComponent(target.id));else history.replaceState(null,'','#'+target.id);
}
function flightStep(now){
 const f=state.flight;if(!f){state.origin.set(positionOf(state.selected));return;}
 const t=Math.min(1,(now-f.start)/f.duration),end=positionOf(state.selected);let p,zoom,phase;
 if(t<.29){p=0;zoom=logLerp(f.fromDistance,f.apex,smooth(t/.29));phase='PULLING BACK';}
 else if(t<.72){p=smooth((t-.29)/.43);zoom=f.apex;phase='CROSSING SPACE';}
 else{p=1;zoom=logLerp(f.apex,f.toDistance,smooth((t-.72)/.28));phase='APPROACHING';}
 for(let i=0;i<3;i++)state.origin[i]=lerp(f.from[i],end[i],p);
 state.distance=zoom;
 let dy=(f.toYaw-f.fromYaw+Math.PI*3)%(Math.PI*2)-Math.PI;
 state.yaw=f.fromYaw+dy*smooth(t);state.pitch=lerp(f.fromPitch,f.toPitch,smooth(t));
 $('flight-phase').textContent=phase;$('flight-progress').style.width=t*100+'%';
 if(t>=1){state.flight=null;$('flight').hidden=true;}
}
function cancelFlight(){if(!state.flight)return;state.flight=null;$('flight').hidden=true;state.origin.set(positionOf(state.selected));toast('Flight stopped. Tracking '+state.selected.name+'.');}
function openNav(filter){clearTimeout(navTimer);$('nav').classList.add('open');document.body.classList.add('nav-open');$('nav-toggle').setAttribute('aria-expanded','true');if(filter){$('filter').value=filter;renderDestinations();}}
function closeNav(){clearTimeout(navTimer);$('nav').classList.remove('open');document.body.classList.remove('nav-open');$('nav-toggle').setAttribute('aria-expanded','false');}
const featured=['system','399','earth-moon','10','solar-activity','599','jupiter-system','502','501','699','saturn-system','606','602','799','899','801','999','belt','trojans','kuiper','oort'];
function friendlyName(b){return b.name.replace(/^S(\d{4})_([A-Z])_?(\d+)$/,'S/$1 $2 $3');}
function subtitle(b){
 if(b.type==='region')return b.id==='oort'?'Illustrative · outermost frontier':'A wider perspective';
 if(b.unavailable)return 'Trajectory unavailable for 2026';
 if(b.type==='moon')return `${b.parent} · ${b.radius?fmtDistance(b.radius*2)+' across':'size not measured here'}`;
 if(b.type==='star')return 'Our star · 1.39 million km across';
 if(b.type==='planet')return `${b.type} · ${fmtDistance(b.radius*2)} across`;
 return `${b.type} · ${b.designation||b.name}${b.cls?' · '+b.cls:''}`;
}
function matching(){
 const query=$('search').value.trim().toLowerCase(),filter=$('filter').value;
 if(filter==='saved')return saved.map(s=>({...byId.get(s.id),bookmark:s})).filter(b=>b.id);
 let list=all;
 if(!query&&filter==='featured')return featured.map(id=>byId.get(id)).filter(Boolean);
 if(filter==='planet')list=bodies.filter(b=>['planet','star'].includes(b.type));
 else if(filter==='moon')list=bodies.filter(b=>b.type==='moon');
 else if(['Jupiter','Saturn','Uranus','Neptune'].includes(filter))list=bodies.filter(b=>b.parent===filter&&b.type==='moon');
 else if(['dwarf','comet','region'].includes(filter))list=all.filter(b=>b.type===filter);
 else if(['MBA','TJN','TNO'].includes(filter))list=small.filter(b=>filter==='MBA'?['MBA','OMB','IMB'].includes(b.cls):b.cls===filter);
 if(query){
  const terms=query.split(/\s+/).map(x=>x.replace(/[^a-z0-9]/g,'')).filter(Boolean);list=list.filter(b=>{const key=b.searchKey||(b.searchKey=(friendlyName(b)+' '+b.name+' '+(b.designation||'')+' '+b.id+' '+(b.parent||'')).toLowerCase().replace(/[^a-z0-9]/g,''));return terms.every(q=>key.includes(q));});
  list.sort((a,b)=>(a.name.toLowerCase()===query?-1:0)-(b.name.toLowerCase()===query?-1:0)||(a.type==='moon'?-1:0)-(b.type==='moon'?-1:0));
 }
 return list;
}
function renderDestinations(){
 const list=matching(),fragment=document.createDocumentFragment();$('result-count').textContent=`${list.length.toLocaleString()} ${$('filter').value==='saved'?'SAVED CHECKPOINTS':'DESTINATIONS'}${list.length>searchLimit?' · SHOWING '+searchLimit:''}`;
 for(const b of list.slice(0,searchLimit)){
  const button=document.createElement('button');button.className='destination'+(state.selected?.id===b.id?' active':'');button.dataset.id=b.id;
  const visual=VISUALS[b.name]||{},style=visual.texture?`background-image:url(textures/${visual.texture}.jpg)`:`--orb:${visual.color||'#6e7c7c'}`;
  button.innerHTML=`<span class="orb" style="${style}"></span><span class="text"><strong>${esc(b.bookmark?.name||friendlyName(b))}</strong><small>${esc(b.bookmark?'Saved viewpoint · '+fmtDistance(b.bookmark.distance):subtitle(b))}</small></span><span class="arrow">↗</span>`;
  button.title=b.bookmark?'Fly to saved viewpoint':(visual.description||b.description||subtitle(b));
  button.addEventListener('click',()=>go(b.id,b.bookmark||{}));fragment.append(button);
 }
 if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent=$('filter').value==='saved'?'Save a viewpoint with the ☆ beside a world’s name. Your checkpoints stay in this browser.':'No match in this category. Try All cataloged destinations, or another name.';fragment.append(p);}
 if(list.length>searchLimit){const more=document.createElement('button');more.className='more';more.textContent='Show 90 more ↓';more.onclick=()=>{searchLimit+=90;renderDestinations();};fragment.append(more);}
 $('destinations').replaceChildren(fragment);
}
function updateInspector(){
 const b=state.selected;if(!b)return;const vis=VISUALS[b.name]||{},children=bodies.filter(x=>x.parent===b.name&&x.type==='moon');
 $('body-name').textContent=friendlyName(b);$('body-type').textContent=b.type==='region'?'REGION OF SPACE':b.type==='moon'?`${b.parent.toUpperCase()} / NATURAL SATELLITE`:b.type==='star'?'OUR STAR / G2 V':b.type.toUpperCase()+' / SOLAR SYSTEM';
 $('body-description').textContent=vis.description||b.description||(b.type==='moon'?`One of ${b.parent}’s cataloged natural satellites.`:'A real object in JPL’s Small-Body Database.');
 let rows=[];
 if(b.type==='region')rows=[['REFERENCE RANGE',fmtDistance(b.distance)],['MODE',b.id==='oort'?'Conceptual cloud':'Physical scale']];
 else{
  rows=[['MEAN DIAMETER',b.radius?fmtDistance(2*b.radius):'Not in source'],[b.type==='moon'?'FROM '+b.parent.toUpperCase():'FROM THE SUN',fmtDistance(Math.hypot(...(b.localState?.slice(0,3)||b.pos||[0,0,0])))],['MEAN ORBIT PERIOD',fmtPeriod(b.period)]];
  const rotation=orientation[b.id]?.pm?.[1];
  rows.push(rotation?['SIDEREAL ROTATION',fmtPeriod(360/Math.abs(rotation))]:['SPIN MODEL','Unknown']);
 }
 $('body-stats').innerHTML=rows.map(([l,v])=>`<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('');
 const links=[];
 if(children.length)links.push([`Browse ${children.length} ${children.length===1?'moon':'moons'}`,()=>{openNav(['Jupiter','Saturn','Uranus','Neptune'].includes(b.name)?b.name:'moon');$('search').value=['Jupiter','Saturn','Uranus','Neptune'].includes(b.name)?'':b.name;renderDestinations();}]);
 if(b.type==='moon')links.push([`Visit ${b.parent}`,()=>go(byName.get(b.parent).id)]);
 if(b.name==='Jupiter')links.push(['Moon system ↗',()=>go('jupiter-system')]);
 if(b.name==='Saturn')links.push(['Moon system ↗',()=>go('saturn-system')]);
 if(b.name==='Earth')links.push(['Earth & Moon ↗',()=>go('earth-moon')]);
 if(b.name==='Sun')links.push(['Solar activity ↗',()=>go('solar-activity')]);
 if(b.type==='region'&&b.scope!=='Sun')links.push(['Visit '+b.scope,()=>go(byName.get(b.scope).id)]);
 const fragment=document.createDocumentFragment();for(const [text,fn]of links){const btn=document.createElement('button');btn.textContent=text;btn.onclick=fn;fragment.append(btn);}$('body-links').replaceChildren(fragment);
 const source=b.type==='region'?b.note||'Navigate with the same physical scale at every distance.':b.basis?'Orbit: SBDB osculating elements, propagated with a two-body Kepler model. Gravitational perturbations and close-encounter deflections are not included.':'Orbit: geometric JPL Horizons vectors, interpolated in TDB. Time coverage: January–December 2026.';
 const spin=orientation[b.id]?'Spin: IAU pole, prime meridian and periodic terms from NAIF pck00011. Cloud patterns are static; Earth and Moon orientations use the approximate IAU model.':'No measured spin model is included for this body. No rotation is invented.';
 $('field-notes').innerHTML=`<p>${esc(vis.note||b.note||(b.type==='moon'?'Known mean radii come from JPL’s physical-parameter table. Unmeasured sizes have a locator only. Small mapped surfaces are representative procedural textures.':''))}</p><p>${esc(source)}</p>${b.type!=='region'?'<p>'+esc(spin)+'</p>':''}`;
 $('focus-label').querySelector('b').textContent=(b.type==='region'?'EXPLORING ':'TRACKING ')+friendlyName(b).toUpperCase();
 $('model-status').textContent=b.type==='region'?(b.id==='oort'?'CONCEPTUAL EXTENT · NOT OBSERVED OBJECTS':'KM SCALE · ORBIT GUIDES ON DEMAND'):b.basis?'SBDB · KEPLER APPROXIMATION':b.id==='10'?'IAU ROTATION · ILLUSTRATIVE SOLAR ACTIVITY':'JPL HORIZONS · '+(orientation[b.id]?'IAU SPIN':'SPIN UNKNOWN');
 const isSaved=saved.some(s=>s.id===b.id);$('bookmark').textContent=isSaved?'★':'☆';$('bookmark').classList.toggle('saved',isSaved);
}
function saveView(){
 const b=state.selected;if(!b)return;
 const existing=saved.findIndex(x=>x.id===b.id);
 const item={id:b.id,name:friendlyName(b),distance:state.distance,yaw:state.yaw,pitch:state.pitch};
 if(existing>=0){saved.splice(existing,1);toast('Checkpoint removed.');}else{saved.push(item);toast('Viewpoint saved. Find it under ☆ Saved.');}
 try{localStorage.setItem('solar-atlas-checkpoints-v1',JSON.stringify(saved));}catch{toast('Your browser could not persist this checkpoint. It is saved for this session.');}
 updateInspector();renderDestinations();
}
function setTime(ms){if(!Number.isFinite(ms)){toast('Choose a valid UTC date in 2026.');return;}const clamped=Math.max(START,Math.min(END,ms));if(clamped!==ms)toast('This edition contains JPL trajectories for 2026.');state.time=clamped;updatePositions();updateTimeUI();}
function updateTimeUI(){
 if(document.activeElement!==$('date'))$('date').value=new Date(state.time).toISOString().slice(0,16);
 if(document.activeElement!==$('timeline'))$('timeline').value=(state.time-START)/1000;
 $('play').textContent=state.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',state.playing?'Pause time':'Play time');
 $('reverse').setAttribute('aria-pressed',String(state.direction<0));$('time-direction').textContent=state.playing?(state.direction>0?'FORWARD':'REVERSE'):'PAUSED';
}
function updateScale(){
 const kmPerPixel=2*state.distance*Math.tan(21*Math.PI/180)/innerHeight,aim=kmPerPixel*(innerWidth<700?70:100),pow=10**Math.floor(Math.log10(aim));
 const nice=[1,2,5,10].map(x=>x*pow).reverse().find(x=>x<=aim)||pow;
 $('scale-bar').style.width=nice/kmPerPixel+'px';$('scale-text').textContent=fmtDistance(nice);
 $('range-text').textContent='Camera range '+fmtDistance(state.distance);
 const b=state.selected;if(b&&b.type!=='region'){
  const value=$('body-stats').children[1]?.querySelector('b');if(value)value.textContent=fmtDistance(Math.hypot(...(b.localState?.slice(0,3)||b.pos||[0,0,0])));
 }
}
function updateLabels(){
 for(const el of labels.values())el.style.display='none';if(!state.flags.labels)return;
 const hit=[...view.hitTargets].sort((a,b)=>(a.body.id===state.selected.id?-1:0)-(b.body.id===state.selected.id?-1:0)||b.body.radius-a.body.radius);
 const occupied=[],mobile=innerWidth<700;let count=0;
 for(const t of hit){
  const b=t.body;if(b.id===state.selected.id&&t.radius>25)continue;
  if(t.x<85||t.x>innerWidth-90||t.y<105||t.y>innerHeight-210)continue;
  if(!mobile&&t.x<390&&t.y>innerHeight-570)continue;
  if(count>24||occupied.some(p=>Math.abs(p[0]-t.x)<105&&Math.abs(p[1]-t.y)<24))continue;
  let el=labels.get(b.id);if(!el){el=document.createElement('div');el.className='world-label';el.innerHTML='<i></i>'+esc(friendlyName(b));$('labels').append(el);labels.set(b.id,el);}
  el.style.display='block';el.style.left=t.x+'px';el.style.top=t.y+'px';el.classList.toggle('selected',b.id===state.selected.id);occupied.push([t.x,t.y]);count++;
 }
}
function openModal(html){$('modal-body').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function showUnavailable(b){openModal(`<h2>${esc(friendlyName(b))}</h2><p>This moon is included in the catalog, but its available JPL Horizons ephemeris ends in 2018. This edition covers 2026, so there is no plotted position or invented orbit phase for it.</p><p>You can still explore Saturn’s other 290 moons with available trajectories.</p>`);}
function about(){
 const measured=bodies.filter(b=>b.type==='moon'&&b.radius).length;
 openModal(`<h2>Space is enormous.<br>The scale should tell the truth.</h2><p>Solar Atlas uses <strong>one kilometer scale for body dimensions and distances</strong>. A tiny moon stays tiny. Navigation dots and labels are optional overlays; they never enlarge the underlying world.</p><div class="coverage"><div><b>8</b><span>planets</span></div><div><b>460</b><span>cataloged moons</span></div><div><b>39,032</b><span>small bodies</span></div></div><table><tr><th>Layer</th><th>What is modeled</th></tr><tr><td>Planets & Pluto</td><td>JPL Horizons geometric vectors for 2026, with cubic Hermite interpolation. Body-centered positions, not compressed orbit radii.</td></tr><tr><td>Moons</td><td>All 460 entries in JPL’s satellite table: 115 Jupiter, 291 Saturn, 30 Uranus, 16 Neptune, 5 Pluto, 2 Mars, 1 Earth. 459 have 2026 trajectories. Daphnis is catalog-only. ${measured} have mean radii in the loaded physical table; other sizes remain unknown.</td></tr><tr><td>Spin & tilt</td><td>61 IAU models from NAIF pck00011, including pole precession, prime-meridian rotation and periodic terms. Retrograde rotation is retained. Earth and Moon use approximate IAU orientation, not precision Earth-orientation/libration kernels.</td></tr><tr><td>Orbit lines</td><td>Osculating ellipse guides derived from the current Horizons position and velocity. Actual positions follow the integrated trajectory; the guide is not a promise that an orbit stays a fixed ellipse.</td></tr><tr><td>Asteroids & comets</td><td>20,000 diameter-ranked asteroids, 10,133 additional Trojans, 7,282 additional TNOs, 1,008 additional centaurs, and 610 numbered comets after deduplication. Pluto also appears in the source catalog and is rendered only once using Horizons. SBDB elements with Kepler propagation; these are less accurate than the Horizons trajectories.</td></tr><tr><td>Rings</td><td>Published radial extents in the planet’s equatorial plane, including major gaps and ringlets. Opacity is enhanced. Circular annuli approximate rings; eccentricity, vertical structure, individual grains, transient arcs and fine density waves are not resolved.</td></tr><tr><td>Solar activity</td><td>A scaled solar photosphere plus illustrative prominence loops and corona. These are not observed flares or a weather forecast.</td></tr><tr><td>Distant regions</td><td>Cataloged trans-Neptunian objects. The 2,000–100,000 AU Oort cloud is an explicitly conceptual distribution, not observations.</td></tr></table><h3>What “accurate” means here</h3><p>Horizons includes gravitational perturbations in its source trajectories. Moon sample spacing targets 1/60 of an orbital period, shortened for eccentricity and clamped between five minutes and six hours; planets use three-hour samples. Interpolated positions are approximations, not spacecraft navigation solutions. Dates are shown in UTC and converted to TDB. The supported timeline is <strong>January 1–December 31, 2026</strong>.</p><p>Measured radii retain source uncertainty. Irregular moons use ellipsoids where PCK axes are available, normalized to the JPL mean radius. Dwarf planets and asteroids otherwise use equivalent spheres. Known small-body moons, spacecraft, meteoroids, individual dust and ring grains are not exhaustively included. No dataset contains every rock or every transient event.</p><h3>Checked against the source</h3><p>161 separately requested Horizons points across 23 bodies and seven dates were compared with interpolated positions. The largest difference was <strong>403 meters</strong>; the tested planet and Pluto points were within <strong>10 meters</strong>. These sampled checks are not a global error bound. All 61 orientation models also matched independently computed SPICE rotation matrices.</p><h3>Surfaces and light</h3><p>Planet and Moon maps: Solar System Scope / INOVE, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>, based on NASA imagery. Colors are enhanced and map gaps may be reconstructed. Twenty additional moon and Pluto maps come from <a href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noreferrer">NASA 3D Resources / JPL</a>. Other surfaces are labeled procedural illustrations. Cloud maps and city lights are static; texture features are not a current atmospheric forecast. Solar illumination direction follows geometry; fill light, stellar backdrop and exposure aid exploration. Disable fill light for a darker night side.</p><h3>Sources & credits</h3><p><a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">JPL Horizons</a> · <a href="https://ssd.jpl.nasa.gov/sats/elem/" target="_blank" rel="noreferrer">Satellite catalog</a> · <a href="https://ssd.jpl.nasa.gov/sats/phys_par/" target="_blank" rel="noreferrer">Satellite radii</a> · <a href="https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html" target="_blank" rel="noreferrer">Small-Body Database</a> · <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc" target="_blank" rel="noreferrer">IAU / NAIF rotation kernel</a> · <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Surface maps</a> · <a href="https://pds-rings.seti.org/saturn/saturn_rings_table.html" target="_blank" rel="noreferrer">PDS ring dimensions</a> · <a href="https://science.nasa.gov/solar-system/oort-cloud/facts/" target="_blank" rel="noreferrer">Oort cloud</a> · <a href="THIRD-PARTY-NOTICES.txt" target="_blank">Three.js & asset licenses</a></p><p>Public-source snapshot: September 29, 2026. Built with Three.js. No live API dependency, tracking or account needed.</p>`);
}
function setupUI(){
 // Hover can open the drawer before a click lands. Clicking Explore should
 // consistently open it; the explicit close button handles dismissal.
 $('nav-toggle').onclick=()=>openNav();
 $('nav').addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover)').matches)openNav();});
 $('nav').addEventListener('mouseleave',()=>{if(!navPinned&&!$('drawer').contains(document.activeElement))navTimer=setTimeout(closeNav,350);});
 $('close-nav').onclick=()=>{navPinned=false;$('pin-nav').setAttribute('aria-pressed','false');closeNav();};
 $('pin-nav').onclick=()=>{navPinned=!navPinned;$('pin-nav').setAttribute('aria-pressed',String(navPinned));};
 $('saved-toggle').onclick=()=>{$('search').value='';openNav('saved');};
 $('search').addEventListener('input',()=>{searchLimit=90;if($('filter').value==='saved')$('filter').value='all';renderDestinations();});
 $('search').addEventListener('keydown',e=>{if(e.key==='Enter')$('destinations').querySelector('.destination')?.click();});
 $('filter').addEventListener('change',()=>{searchLimit=90;renderDestinations();});
 for(const b of document.querySelectorAll('[data-jump]'))b.onclick=()=>go(b.dataset.jump);
 $('system').onclick=()=>go('system');$('bookmark').onclick=saveView;
 $('layers-toggle').onclick=()=>{closeNav();$('layers').hidden=!$('layers').hidden;};$('close-layers').onclick=()=>$('layers').hidden=true;
 for(const [id,key] of [['show-labels','labels'],['show-markers','markers'],['show-orbits','orbits'],['show-small','small'],['show-activity','activity'],['show-regions','regions'],['show-stars','stars'],['fill-light','fill']])$(id).onchange=e=>state.flags[key]=e.target.checked;
 $('details-toggle').onclick=()=>{$('field-notes').hidden=!$('field-notes').hidden;$('details-toggle').setAttribute('aria-expanded',String(!$('field-notes').hidden));$('details-toggle').querySelector('span').textContent=$('field-notes').hidden?'+':'−';};
 $('play').onclick=()=>{state.playing=!state.playing;updateTimeUI();};$('reverse').onclick=()=>{state.direction*=-1;state.playing=true;updateTimeUI();};
 $('speed').onchange=e=>state.speed=Number(e.target.value);$('date').onchange=e=>setTime(Date.parse(e.target.value+'Z'));
 $('day-back').onclick=()=>setTime(state.time-86400000);$('day-forward').onclick=()=>setTime(state.time+86400000);$('now').onclick=()=>{state.playing=false;setTime(Date.now());};
 $('timeline').addEventListener('input',e=>{state.playing=false;setTime(START+Number(e.target.value)*1000);});
 $('cancel-flight').onclick=cancelFlight;$('zoom-in').onclick=()=>zoom(.65);$('zoom-out').onclick=()=>zoom(1.55);
 $('top-view').onclick=()=>{cancelFlight();state.pitch=Math.PI/2-.0001;state.yaw=0;};$('reset-view').onclick=()=>go(state.selected.id);
 $('about').onclick=about;$('scale-info').onclick=about;$('close-modal').onclick=()=>$('modal').close();
 $('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
 $('help').onclick=()=>openModal('<h2>Your controls.</h2><table><tr><td>Drag / one finger</td><td>Orbit the selected world</td></tr><tr><td>Scroll / pinch</td><td>Zoom through physical space</td></tr><tr><td><kbd>/</kbd></td><td>Search every destination</td></tr><tr><td><kbd>Space</kbd></td><td>Play or pause time</td></tr><tr><td><kbd>R</kbd></td><td>Reverse time</td></tr><tr><td><kbd>1</kbd></td><td>Fly to the solar system</td></tr><tr><td><kbd>2</kbd></td><td>Fly to the inner worlds</td></tr><tr><td><kbd>Esc</kbd></td><td>Close panels or stop a flight</td></tr><tr><td><kbd>+</kbd> <kbd>−</kbd></td><td>Zoom in and out</td></tr></table><p>Hover over Explore to open the destination drawer. Use the dropdown to browse a moon system. Click ☆ beside a world’s name to save your current camera position.</p>');
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('modal').open)return;closeNav();$('layers').hidden=true;cancelFlight();return;}
  if(/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(e.target.tagName)||$('modal').open)return;
  if(e.key==='/'){e.preventDefault();openNav('all');$('search').focus();}
  if(e.code==='Space'){e.preventDefault();$('play').click();}
  if(e.key.toLowerCase()==='r')$('reverse').click();if(e.key==='1')go('system');if(e.key==='2')go('inner');if(e.key==='+')zoom(.7);if(e.key==='-')zoom(1.4);
 });
 const canvas=view.renderer.domElement,pointers=new Map();let down=null,pinch=0;
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;cancelFlight();closeNav();$('layers').hidden=true;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);down={x:e.clientX,y:e.clientY,moved:false};document.body.classList.add('dragging');});
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)zoom(pinch/d);pinch=d;down.moved=true;}
  else{state.yaw-=(e.clientX-old.x)*.004;state.pitch=Math.max(-1.565,Math.min(1.565,state.pitch+(e.clientY-old.y)*.004));if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)down.moved=true;}
 });
 const up=e=>{pointers.delete(e.pointerId);pinch=0;if(down&&!down.moved&&e.type!=='pointercancel'&&!pointers.size){
  const candidates=view.hitTargets.filter(t=>Math.hypot(t.x-e.clientX,t.y-e.clientY)<Math.min(150,t.radius+4)).sort((a,b)=>a.distance-b.distance);if(candidates[0])go(candidates[0].body.id);
 }if(pointers.size){down={...[...pointers.values()][0],moved:true};}else{down=null;document.body.classList.remove('dragging');}};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-.45,Math.min(.45,e.deltaY*.0015))));},{passive:false});
 window.addEventListener('resize',()=>view.resize());
 window.addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.slice(1));if(byId.has(id)&&state.selected?.id!==id)go(id);});
}
function zoom(factor){cancelFlight();const min=state.selected?.radius?state.selected.radius*1.1:10;state.distance=Math.max(min,Math.min(400000*AU,state.distance*factor));}
let previous=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.12,(now-previous)/1000);previous=now;
 if(state.playing){state.time+=dt*state.speed*1000*state.direction;if(state.time<=START||state.time>=END){state.time=Math.max(START,Math.min(END,state.time));state.playing=false;toast('Reached the edge of the 2026 trajectory dataset. Reverse time to continue.');}}
 updatePositions();flightStep(now);view.render(state,bodies,byName,small,dt);
 if(now-lastLabel>65){updateLabels();lastLabel=now;}
 if(now-lastUI>220){updateTimeUI();updateScale();lastUI=now;}
}
async function init(){
 try{
  [catalog,orientation]=await Promise.all([fetch('data/catalog.json').then(r=>r.json()),fetch('data/orientation.json').then(r=>r.json())]);
  bodies=catalog.bodies;for(const b of bodies){byId.set(b.id,b);byName.set(b.name,b);}
  for(const r of REGIONS)byId.set(r.id,r);all=[...REGIONS,...bodies];
  view=new SolarScene($('scene'),orientation);
  bodies.filter(b=>b.radius).forEach(b=>view.makeBody(b));
  $('loading-text').textContent='Loading the planets and their physical scale…';
  await Promise.all(bodies.filter(b=>b.type!=='moon').map(loadBody));
  updatePositions();state.selected=byId.get('699');state.origin.set(state.selected.pos);
  setupUI();updateTimeUI();renderDestinations();
  const hash=decodeURIComponent(location.hash.slice(1));await go(byId.has(hash)?hash:'699',{instant:true});
  $('loading').classList.add('finished');setTimeout(()=>$('loading').hidden=true,650);
  requestAnimationFrame(frame);
  const rows=await readGzip('data/small-bodies.json.gz',true);
  small=rows.map(prepareSmall).filter(b=>!byId.has(b.id)&&b.name!=='Pluto');for(const b of small){byId.set(b.id,b);if(!byName.has(b.name))byName.set(b.name,b);}
  all=[...REGIONS,...bodies,...small];view.initSmall(small);renderDestinations();
  if(hash&&!bodies.some(b=>b.id===hash)&&byId.has(hash))go(hash);
  // Eagerly prepare a few useful neighbors; the full system loads on demand.
  loadBody(byId.get('301')).catch(()=>{});
  window.__atlas={state,byId,bodies,small,view,go,setTime,orientation,ready:true,
   inspect:id=>{const b=byId.get(String(id));return {name:b.name,radius:b.radius,pos:b.pos?Array.from(b.pos):null,local:b.localState?Array.from(b.localState):null,spin:orientation[b.id]?orientationAngles(orientation[b.id],state.jd):null};}};
 }catch(e){console.error(e);$('loading').hidden=false;$('loading').classList.remove('finished');$('loading').classList.add('error');$('loading').querySelector('h2').textContent='The atlas couldn’t start.';$('loading-text').textContent=e.message+' Please reload in a browser with WebGL 2 support.';}
}
document.addEventListener('atlas-error',e=>toast(e.detail));
init();
