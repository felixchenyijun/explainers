import * as THREE from 'three';
import {AU,smallPosition} from './physics.js';
import {bodyTrail} from './trail-physics.js';
import {VISUALS} from './worlds.js';

const count=25;
const material=()=>new THREE.LineBasicMaterial({vertexColors:true,transparent:true,
 blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});

export class MotionTrails{
 constructor(scene){this.scene=scene;this.bodies=new Map();this.lastUpdate=-Infinity;this.lastJD=NaN;this.direction=1;}
 initSmall(bodies){
  this.smallBodies=bodies;
  // Two segments per small body keep the complete 39k catalog interactive.
  const positions=new Float32Array(bodies.length*12),colors=new Float32Array(positions.length);
  for(let i=0;i<bodies.length;i++){
   const c=new THREE.Color(bodies[i].cls==='TJN'?'#a99b78':bodies[i].cls==='TNO'?'#83bcc8':'#9eb4b2');
   [0.48,.15,.15,0].forEach((alpha,j)=>colors.set([c.r*alpha,c.g*alpha,c.b*alpha],i*12+j*3));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  this.small=new THREE.LineSegments(g,material());this.small.material.opacity=.36;this.small.frustumCulled=false;this.small.visible=false;this.scene.add(this.small);
 }
 updateBody(b,state,view,refresh){
  let line=this.bodies.get(b.id);
  const parent=b.type==='moon'?b.parent:b.name;
  const focus=state.selected.type==='region'?state.selected.scope:state.selected.type==='moon'?state.selected.parent:state.selected.name;
  const nearby=Math.hypot(...b.pos.map((v,i)=>v-state.origin[i]))<state.distance*3;
  const relevant=(b.type!=='moon'||parent===focus)&&(nearby||b.id===state.selected.id);
  const visible=state.flags.trails&&relevant&&b.id!=='10'&&(b.data||b.basis);
  if(!visible){if(line)line.visible=false;return;}
  if(!line){
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
   g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(count*3),3));line=new THREE.Line(g,material());line.frustumCulled=false;line.userData={jd:NaN,selected:null};this.scene.add(line);this.bodies.set(b.id,line);
  }
  const selected=b.id===state.selected.id;
  if((refresh||selected||!Number.isFinite(line.userData.jd))&&(line.userData.jd!==state.jd||line.userData.distance!==state.distance)||line.userData.direction!==state.direction){
   const speed=b.localState?Math.hypot(...b.localState.slice(3,6)):Math.abs(b.a*b.n);
   const span=Math.max((b.radius||0)*5,state.distance*.14)/Math.max(1,speed);
   const history=bodyTrail(b,state.jd,state.direction,count,span);line.userData.hasHistory=!!history;
   if(history){
    const p=line.geometry.attributes.position.array,v=history.values;
    for(let i=0;i<count;i++){p[i*3]=v[i*3]-v[0];p[i*3+1]=v[i*3+2]-v[2];p[i*3+2]=-(v[i*3+1]-v[1]);}
    line.geometry.attributes.position.needsUpdate=true;
   }
   line.userData.jd=state.jd;line.userData.direction=state.direction;line.userData.distance=state.distance;
  }
  if(line.userData.selected!==selected){
   const c=new THREE.Color(selected?'#e6f6bd':VISUALS[b.name]?.color||'#91c6d0'),colors=line.geometry.attributes.color.array;
   for(let i=0;i<count;i++){const fade=(1-i/(count-1))**1.5*(selected?1.45:.82);colors.set([c.r*fade,c.g*fade,c.b*fade],i*3);}
   line.geometry.attributes.color.needsUpdate=true;line.userData.selected=selected;
  }
  line.visible=line.userData.hasHistory;view.relative(b.pos,line.position);line.scale.setScalar(1/view.unit);
 }
 render(state,bodies,smallCoords,view){
  const now=performance.now(),refresh=now-this.lastUpdate>140||state.direction!==this.direction;
  for(const b of bodies)if(b.pos)this.updateBody(b,state,view,refresh);
  if(state.selected.basis)this.updateBody(state.selected,state,view,refresh);
  // A previously selected asteroid is no longer part of the visible local system.
  for(const [id,line] of this.bodies)if(line.userData.small&&id!==state.selected.id)line.visible=false;
  if(state.selected.basis&&this.bodies.has(state.selected.id))this.bodies.get(state.selected.id).userData.small=true;
  if(this.small){
   const wasVisible=this.small.visible;
   this.small.visible=state.flags.trails&&state.flags.small&&state.distance>.2*AU;
   if(this.small.visible){
    const p=this.small.geometry.attributes.position.array;
    if(!wasVisible||!Number.isFinite(this.lastJD)||(refresh&&this.lastJD!==state.jd)||state.direction!==this.direction){
     const sample=new Float64Array(3);
     for(let i=0;i<this.smallBodies.length;i++){
      const b=this.smallBodies[i],span=Math.min(120,Math.max(.01,b.period*.003));
      for(let j=1;j<=2;j++){
       smallPosition(b,state.jd-state.direction*span*j/2,sample);const k=i*12+(j===1?3:9);
       p[k]=sample[0]/AU;p[k+1]=sample[2]/AU;p[k+2]=-sample[1]/AU;
       if(j===1){p[k+3]=p[k];p[k+4]=p[k+1];p[k+5]=p[k+2];}
      }
     }
     this.lastJD=state.jd;
    }
    for(let i=0;i<this.smallBodies.length;i++){p[i*12]=smallCoords[i*3]/AU;p[i*12+1]=smallCoords[i*3+2]/AU;p[i*12+2]=-smallCoords[i*3+1]/AU;}
    this.small.geometry.attributes.position.needsUpdate=true;view.relative([0,0,0],this.small.position);this.small.scale.setScalar(AU/view.unit);
   }
  }
  if(refresh)this.lastUpdate=now;this.direction=state.direction;
 }
}
