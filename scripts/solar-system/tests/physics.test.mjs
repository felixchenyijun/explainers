import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {AU,DAY,hermite,ellipseFromState,closeOrbitFromState,smallPosition,prepareSmall,utcToTDB} from '../src/physics.js';
import {orientationMatrix,orientationAngles} from '../src/orientation.js';
import {trailTimes,bodyTrail} from '../src/trail-physics.js';
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json'));
const orientation=JSON.parse(fs.readFileSync('public/data/orientation.json'));
const reference=JSON.parse(fs.readFileSync('data/orientation-reference.json'));
test('All 460 moons are accounted for; unavailable ephemerides are explicit',()=>{
 const moons=catalog.bodies.filter(b=>b.type==='moon');assert.equal(moons.length,460);
 assert.equal(moons.filter(b=>b.parent==='Jupiter').length,115);
 assert.equal(moons.filter(b=>b.ephem).length,459);
 assert.deepEqual(moons.filter(b=>b.unavailable).map(b=>b.name),['Daphnis']);
});
test('All trajectories have complete finite samples, 2026 coverage and matching reference positions',()=>{
 for(const b of catalog.bodies.filter(b=>b.ephem)){
  const buffer=gunzipSync(fs.readFileSync('public/data/'+b.ephem.file)),v=new Float64Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/8);
  assert.equal(v.length,b.ephem.count*6,b.name);assert.ok(b.ephem.start<=utcToTDB(Date.UTC(2026,0,1)),b.name);
  assert.ok(b.ephem.start+b.ephem.step*(b.ephem.count-1)>=utcToTDB(Date.UTC(2026,11,31,23,59,59)),b.name);
  for(const n of v)assert.ok(Number.isFinite(n),b.name);
  assert.deepEqual(Array.from(v.slice(0,6)),b.sample,b.name);
  const exact=hermite(v,b.ephem,b.ephem.start);for(let i=0;i<6;i++)assert.ok(Math.abs(exact[i]-b.sample[i])<1e-9,b.name);
 }
});
test('Hermite interpolation reproduces cubic position and its derivative',()=>{
 const f=t=>4*t**3-2*t*t+3*t+1,df=t=>12*t*t-4*t+3;
 const data=new Float64Array([f(0),0,0,df(0),0,0,f(1),0,0,df(1),0,0]);
 for(const t of [.1,.3,.5,.9]){const v=hermite(data,{start:0,step:1,count:2},t);assert.ok(Math.abs(v[0]-f(t))<1e-12);assert.ok(Math.abs(v[3]-df(t))<1e-12);}
});
test('IAU rotations match independent SPICE tipbod matrices for all 61 models',()=>{
 let worst=0;
 for(const [id,rows] of Object.entries(reference))for(const row of rows){
  const columns=orientationMatrix(orientation[id],row.jd);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){const err=Math.abs(columns[j][i]-row.matrix[i][j]);worst=Math.max(worst,err);assert.ok(err<2e-8,`${id} ${row.jd} rotation discrepancy ${err}`);}
 }
 console.log('Maximum rotation matrix error versus SPICE:',worst);
});
test('Retrograde spin rates and correct sidereal rates are retained',()=>{
 assert.ok(orientation['299'].pm[1]<0);assert.ok(orientation['799'].pm[1]<0);
 assert.ok(Math.abs(360/orientation['399'].pm[1]*24-23.93447)<.001);
 assert.ok(Math.abs(360/orientation['599'].pm[1]*24-9.92492)<.001);
});
test('Kepler orbit closes and matches its periapsis at zero mean anomaly',()=>{
 const b=prepareSmall(['test','Test','test','MBA',2451545,1,.2,0,0,0,0,360/365.256,1,5,.8,2451545]);
 const a=smallPosition(b,2451545),c=smallPosition(b,2451545+b.period);
 assert.ok(Math.abs(a[0]-.8*AU)<1e-6);assert.ok(Math.hypot(...a.map((x,i)=>x-c[i]))<.001);
});
test('Orbit guide derived from state retains physical circular radius',()=>{
 const mu=398600.435507*DAY*DAY,r=384400,v=Math.sqrt(mu/r);
 const guide=ellipseFromState(new Float64Array([r,0,0,0,v,0]),mu);
 assert.ok(Math.abs(guide.a-r)<1e-7);assert.ok(guide.e<1e-12);
 for(let i=0;i<guide.vertices.length;i+=3)assert.ok(Math.abs(Math.hypot(...guide.vertices.slice(i,i+3))*guide.a-r)<.03);
});
test('Reversing time gives the same physical state without accumulating integration drift',()=>{
 const b=catalog.bodies.find(b=>b.id==='502'),buffer=gunzipSync(fs.readFileSync('public/data/'+b.ephem.file)),v=new Float64Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/8),jd=2461222.25;
 const before=Array.from(hermite(v,b.ephem,jd));hermite(v,b.ephem,jd+12.123);hermite(v,b.ephem,jd-42.003);
 assert.deepEqual(Array.from(hermite(v,b.ephem,jd)),before);
});
test('Motion tails reverse direction and never sample beyond the trajectory edition',()=>{
 const jd=utcToTDB(Date.UTC(2026,6,1));
 const forward=trailTimes(jd,365,1),reverse=trailTimes(jd,365,-1);
 assert.equal(forward[0],jd);assert.equal(reverse[0],jd);
 assert.ok(forward.at(-1)<jd);assert.ok(reverse.at(-1)>jd);
 assert.ok(Math.abs(jd-forward.at(-1)-(reverse.at(-1)-jd))<1e-9);
 const start=utcToTDB(Date.UTC(2026,0,1)),end=utcToTDB(Date.UTC(2026,11,31,23,59,59));
 assert.equal(trailTimes(start,500,1),null);assert.equal(trailTimes(end,500,-1),null);
 assert.ok(trailTimes(start+.1,500,1).every(t=>t>=start));
 assert.ok(trailTimes(end-.1,500,-1).every(t=>t<=end));
});
test('Close-up orbit passes through the selected planet and retains the physical orbit radius',()=>{
 const r=AU,mu=132712440041.2794*DAY*DAY,angle=1.237,v=Math.sqrt(mu/r);
 const state=new Float64Array([r*Math.cos(angle),r*Math.sin(angle),0,-v*Math.sin(angle),v*Math.cos(angle),0]);
 const line=closeOrbitFromState(state,mu,6371*5.3);
 assert.ok(Math.hypot(...line.vertices.slice(32*3,33*3))<1e-6);
 for(let i=0;i<line.vertices.length;i+=3){
  const x=state[0]+line.vertices[i],y=state[1]-line.vertices[i+2],z=state[2]+line.vertices[i+1];
  assert.ok(Math.abs(Math.hypot(x,y,z)-r)<.005);
 }
});
test('Moon tail head and past points are sampled from the same JPL trajectory as the body',()=>{
 const b={...catalog.bodies.find(x=>x.id==='502')},buf=gunzipSync(fs.readFileSync('public/data/'+b.ephem.file));
 b.data=new Float64Array(buf.buffer,buf.byteOffset,buf.byteLength/8);
 const jd=utcToTDB(Date.UTC(2026,6,1)),trail=bodyTrail(b,jd,1);
 for(let i=0;i<trail.times.length;i++){
  const sample=hermite(b.data,b.ephem,trail.times[i]);
  assert.deepEqual(Array.from(trail.values.slice(i*3,i*3+3)),Array.from(sample.slice(0,3)));
 }
});
test('161 independent Horizons midpoint checks agree within 0.5 km; planets within 10 m',()=>{
 const references=JSON.parse(fs.readFileSync('data/ephemeris-reference.json'));let max=0,count=0;
 for(const row of references){
  const b=catalog.bodies.find(b=>b.id===row.id),buffer=gunzipSync(fs.readFileSync('public/data/'+b.ephem.file)),v=new Float64Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/8);
  for(const r of row.rows){const actual=hermite(v,b.ephem,r.jd),error=Math.hypot(...r.state.slice(0,3).map((x,i)=>x-actual[i]));max=Math.max(max,error);count++;assert.ok(error<(b.type==='moon'?.5:.01),`${b.name}: ${error} km`);}
 }
 assert.equal(count,161);console.log('161 held-out midpoint checks; maximum discrepancy:',max,'km (not a global bound)');
});
