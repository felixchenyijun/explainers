import {START,END,utcToTDB,hermite,smallPosition} from './physics.js';
const first=utcToTDB(START),last=utcToTDB(END);

// History is expressed in the body's parent frame, just like its orbit guide.
// Reverse playback leaves its tail on the future side of the current date.
export function trailTimes(jd,period,direction,count=25,maxSpan=Infinity){
 const available=direction>0?jd-first:last-jd;
 const span=Math.min(180,maxSpan,Math.max(.005,(period||365)*.075),Math.max(0,available));
 if(span<1e-8)return null;
 return Array.from({length:count},(_,i)=>jd-direction*span*i/(count-1));
}

export function bodyTrail(b,jd,direction,count=25,maxSpan=Infinity){
 const times=trailTimes(jd,b.period,direction,count,maxSpan);if(!times)return null;
 const values=new Float64Array(count*3),sample=new Float64Array(6);
 for(let i=0;i<count;i++){
  if(b.basis)smallPosition(b,times[i],sample);
  else hermite(b.data,b.ephem,times[i],sample);
  values.set(sample.subarray(0,3),i*3);
 }
 return {times,values};
}
