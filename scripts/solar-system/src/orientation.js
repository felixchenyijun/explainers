import {DEG,J2000} from './physics.js';
export function orientationAngles(model,jd){
 const d=jd-J2000,T=d/36525,poly=(a,t)=>a[0]+(a[1]||0)*t+(a[2]||0)*t*t;
 let ra=poly(model.ra,T),dec=poly(model.dec,T),w=poly(model.pm,d);
 const a=model.angles,n=model.angleSize;
 for(let j=0;j<a.length/n;j++){
  const angle=(a[j*n]+a[j*n+1]*T+(n>2?a[j*n+2]*T*T:0))*DEG;
  ra+=(model.raTerms[j]||0)*Math.sin(angle);dec+=(model.decTerms[j]||0)*Math.cos(angle);w+=(model.pmTerms[j]||0)*Math.sin(angle);
 }
 return {ra:ra*DEG,dec:dec*DEG,w:(w%360)*DEG};
}
export function orientationMatrix(model,jd){
 const {ra:a,dec:d,w}=orientationAngles(model,jd),sa=Math.sin(a),ca=Math.cos(a),sd=Math.sin(d),cd=Math.cos(d),sw=Math.sin(w),cw=Math.cos(w);
 // Columns are the body-fixed x, y and north-pole axes in ICRF/J2000.
 return [[-sa*cw-ca*sd*sw,ca*cw-sa*sd*sw,cd*sw],[sa*sw-ca*sd*cw,-ca*sw-sa*sd*cw,cd*cw],[ca*cd,sa*cd,sd]];
}
export function equatorialToRender(v){
 const e=84381.448/3600*DEG,c=Math.cos(e),s=Math.sin(e);
 return [v[0],-v[1]*s+v[2]*c,-v[1]*c-v[2]*s];
}
