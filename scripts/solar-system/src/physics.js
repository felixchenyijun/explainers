export const AU=149597870.7, DAY=86400, J2000=2451545, DEG=Math.PI/180;
export const GM={Sun:132712440041.2794,Mercury:22031.86855,Venus:324858.592,Earth:398600.435507,Mars:42828.375816,Jupiter:126686531.9,Saturn:37931206.234,Uranus:5793951.256,Neptune:6835099.97,Pluto:869.6138178};
export const START=Date.UTC(2026,0,1), END=Date.UTC(2026,11,31,23,59,59);
export function utcToTDB(ms){
  const tt=ms/86400000+2440587.5+69.184/DAY;
  const g=(357.53+.9856003*(tt-J2000))*DEG;
  return tt+(.001657*Math.sin(g)+.000022*Math.sin(2*g))/DAY;
}
export function hermite(data,meta,jd,out=new Float64Array(6)){
 const t=Math.max(0,Math.min(meta.count-1,(jd-meta.start)/meta.step));
 const i=Math.min(meta.count-2,Math.floor(t)),u=t-i,u2=u*u,u3=u2*u,dt=meta.step;
 const a=i*6,b=a+6;
 for(let k=0;k<3;k++){
  out[k]=(2*u3-3*u2+1)*data[a+k]+(u3-2*u2+u)*dt*data[a+k+3]+(-2*u3+3*u2)*data[b+k]+(u3-u2)*dt*data[b+k+3];
  out[k+3]=((6*u2-6*u)*data[a+k]+(3*u2-4*u+1)*dt*data[a+k+3]+(-6*u2+6*u)*data[b+k]+(3*u2-2*u)*dt*data[b+k+3])/dt;
 }
 return out;
}
export function prepareSmall(row){
 const [id,name,designation,cls,epoch,a,e,i,node,w,M,n,radius,H,q,tp]=row;
 const O=node*DEG,I=i*DEG,W=w*DEG,cO=Math.cos(O),sO=Math.sin(O),cI=Math.cos(I),sI=Math.sin(I),cW=Math.cos(W),sW=Math.sin(W);
 return {id:String(id),name,designation,cls,epoch,a:a*AU,e,i,node,w,M:M*DEG,n:n*DEG,radius,H,q,tp,parent:'Sun',
  type:['Ceres','Eris','Haumea','Makemake'].includes(name)?'dwarf':/^[A-Z]*C$/.test(cls)||name.includes('/')?'comet':'asteroid',
  period:360/n,basis:[cO*cW-sO*sW*cI,sO*cW+cO*sW*cI,sW*sI,-cO*sW-sO*cW*cI,-sO*sW+cO*cW*cI,cW*sI]};
}
export function smallPosition(b,jd,out=new Float64Array(3),offset=0){
 let M=b.M+b.n*(jd-b.epoch),x,y;
 if(b.e<1){
  M=((M+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  let E=b.e>.8?(M>=0?Math.PI:-Math.PI):M;
  for(let k=0;k<18;k++){const d=(E-b.e*Math.sin(E)-M)/(1-b.e*Math.cos(E));E-=d;if(Math.abs(d)<1e-12)break;}
  x=b.a*(Math.cos(E)-b.e);y=b.a*Math.sqrt(1-b.e*b.e)*Math.sin(E);
 }else{
  let H=Math.asinh(M/b.e);
  for(let k=0;k<24;k++){const d=(b.e*Math.sinh(H)-H-M)/(b.e*Math.cosh(H)-1);H-=d;if(Math.abs(d)<1e-12)break;}
  x=b.a*(Math.cosh(H)-b.e);y=-b.a*Math.sqrt(b.e*b.e-1)*Math.sinh(H);
 }
 const p=b.basis;out[offset]=p[0]*x+p[3]*y;out[offset+1]=p[1]*x+p[4]*y;out[offset+2]=p[2]*x+p[5]*y;
 return out;
}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>Math.hypot(...v);
export function ellipseFromState(state,mu,segments=320){
 const r=Array.from(state.slice(0,3)),v=Array.from(state.slice(3,6)),rn=norm(r),h=cross(r,v),hn=norm(h);
 if(!rn||!hn)return null;
 const ev=cross(v,h).map((x,k)=>x/mu-r[k]/rn),e=norm(ev);
 if(e>=.99)return null;
 const p=hn*hn/mu,a=p/(1-e*e),axis=e>1e-8?ev.map(x=>x/e):r.map(x=>x/rn),q=cross(h.map(x=>x/hn),axis);
 const vertices=new Float32Array((segments+1)*3);
 for(let j=0;j<=segments;j++){
  const f=j/segments*2*Math.PI,rad=p/(1+e*Math.cos(f))/a;
  const x=(axis[0]*Math.cos(f)+q[0]*Math.sin(f))*rad,y=(axis[1]*Math.cos(f)+q[1]*Math.sin(f))*rad,z=(axis[2]*Math.cos(f)+q[2]*Math.sin(f))*rad;
  vertices.set([x,z,-y],j*3);
 }
 return {vertices,a,e};
}
export function smallEllipse(b,segments=320){
 const vertices=new Float32Array((segments+1)*3),a=Math.abs(b.a),p=b.basis;
 for(let j=0;j<=segments;j++){
  let x,y;
  if(b.e<1){const E=j/segments*2*Math.PI;x=Math.cos(E)-b.e;y=Math.sqrt(1-b.e*b.e)*Math.sin(E);}
  else{const H=(j/segments*2-1)*2;x=b.e-Math.cosh(H);y=Math.sqrt(b.e*b.e-1)*Math.sinh(H);}
  vertices.set([p[0]*x+p[3]*y,p[2]*x+p[5]*y,-p[1]*x-p[4]*y],j*3);
 }
 return {vertices,a,e:b.e};
}
export function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
export function fmtDistance(km){if(!Number.isFinite(km))return '—';if(km>=AU*.15)return (km/AU).toLocaleString('en-US',{maximumFractionDigits:km/AU>1000?0:3})+' AU';return km.toLocaleString('en-US',{maximumFractionDigits:km<100?2:0})+' km';}
export function fmtPeriod(days){if(!days||!Number.isFinite(days))return '—';if(days>730)return (days/365.25).toLocaleString('en-US',{maximumFractionDigits:1})+' years';if(days<2)return (days*24).toFixed(2)+' hours';return days.toLocaleString('en-US',{maximumFractionDigits:2})+' days';}
