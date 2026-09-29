import * as THREE from 'three';
import {AU,DAY,DEG,GM,ellipseFromState,smallEllipse,closeOrbitFromState} from './physics.js';
import {VISUALS,RINGS} from './worlds.js';
import {orientationMatrix,equatorialToRender} from './orientation.js';
import {MotionTrails} from './trails.js';

const V=()=>new THREE.Vector3();
function random(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return (seed>>>0)/4294967296;};}
const toVec=a=>new THREE.Vector3(a[0],a[2],-a[1]);
const sphere=new THREE.SphereGeometry(1,96,64);
function proceduralTexture(body){
 const vis=VISUALS[body.name]||{},rand=random(Number(body.id)||117),c=document.createElement('canvas');c.width=1024;c.height=512;
 const g=c.getContext('2d');g.fillStyle=vis.color||'#97958d';g.fillRect(0,0,1024,512);
 if(vis.surface==='haze'){
  for(let i=0;i<80;i++){g.fillStyle=`rgba(102,64,25,${rand()*.05})`;g.fillRect(0,rand()*512,1024,rand()*50);}
 }else if(vis.surface==='ice'){
  for(let i=0;i<150;i++){g.beginPath();let x=rand()*1024,y=rand()*512;g.moveTo(x,y);for(let k=0;k<12;k++){x+=(rand()-.35)*30;y+=(rand()-.5)*15;g.lineTo(x,y);}g.strokeStyle=`rgba(116,71,46,${.05+rand()*.3})`;g.lineWidth=.3+rand()*2;g.stroke();}
 }else{
  for(let i=0;i<2200;i++){
   const x=rand()*1024,y=rand()*512,r=1+Math.pow(rand(),4)*20;
   g.beginPath();g.ellipse(x,y,r*1.2,r,0,0,Math.PI*2);g.fillStyle=vis.surface==='sulfur'?`rgba(${rand()>.65?'50,33,20':'186,80,25'},${rand()*.7})`:`rgba(26,26,23,${rand()*.15})`;g.fill();
   if(vis.surface!=='sulfur'){g.beginPath();g.ellipse(x+.7,y-.7,r*1.2,r,0,Math.PI*.15,Math.PI*1.05);g.strokeStyle=`rgba(245,245,230,${rand()*.13})`;g.lineWidth=.6;g.stroke();}
  }
 }
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function pointMaterial(size,opacity=1){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{pointSize:{value:size},alpha:{value:opacity}},vertexShader:`varying vec3 vColor; uniform float pointSize; void main(){vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;gl_PointSize=pointSize;if(mv.z>0.)gl_PointSize=0.;}`,fragmentShader:`varying vec3 vColor;uniform float alpha;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(vColor,alpha*smoothstep(.5,.15,r));}`});}

export class SolarScene{
 constructor(container,orientation){
  this.orientation=orientation;this.meshes=new Map();this.lines=new Map();this.effects=new Map();this.textures=new Map();
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#06090e');
  this.renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.setSize(innerWidth,innerHeight);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.append(this.renderer.domElement);
  this.camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.00005,1e12);
  if(innerWidth<700)this.camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.13,innerWidth,innerHeight);
  this.light=new THREE.DirectionalLight(0xfff5e2,3.1);this.light.castShadow=true;
  this.light.shadow.mapSize.set(2048,2048);this.light.shadow.bias=-.00015;this.light.shadow.normalBias=.08;
  this.scene.add(this.light,this.light.target);
  this.ambient=new THREE.AmbientLight(0xb4c7dd,.12);this.scene.add(this.ambient);
  this.textureLoader=new THREE.TextureLoader();
  this.starGroup=new THREE.Group();this.scene.add(this.starGroup);this.makeStars();this.makeOort();
  this.projector=V();this.unit=1;this.origin=new Float64Array(3);this.hitTargets=[];
  this.markers=new THREE.Points(new THREE.BufferGeometry(),pointMaterial(4,1));this.markers.frustumCulled=false;this.scene.add(this.markers);
  this.planetLights=new THREE.Points(new THREE.BufferGeometry(),pointMaterial(7*this.renderer.getPixelRatio(),1));
  this.planetLights.material.blending=THREE.AdditiveBlending;this.planetLights.frustumCulled=false;this.scene.add(this.planetLights);
  this.smallPoints=null;this.smallCoords=null;
  this.trails=new MotionTrails(this.scene);
  const closeGeometry=new THREE.BufferGeometry();closeGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(65*3),3).setUsage(THREE.DynamicDrawUsage));
  this.closeOrbit=new THREE.Line(closeGeometry,new THREE.LineBasicMaterial({color:0xc5e5ad,transparent:true,opacity:.76,depthWrite:false}));
  this.closeOrbit.frustumCulled=false;this.closeOrbit.visible=false;this.scene.add(this.closeOrbit);
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.dispatchEvent(new CustomEvent('atlas-error',{detail:'The graphics context was lost. Reload this page to restart the atlas.'}));});
 }
 texture(name){if(this.textures.has(name))return this.textures.get(name);const t=this.textureLoader.load('textures/'+name+(name==='saturn_ring_alpha'?'.png':'.jpg'));t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.set(name,t);return t;}
 makeStars(){
  const rand=random(29041),positions=[],colors=[];
  for(let i=0;i<2400;i++){
   const z=rand()*2-1,a=rand()*Math.PI*2,s=Math.sqrt(1-z*z);positions.push(s*Math.cos(a)*40000,z*40000,s*Math.sin(a)*40000);
   const k=.25+Math.pow(rand(),5)*.6;colors.push(k*.85,k*.92,k);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const stars=new THREE.Points(g,pointMaterial(1.65,.6));stars.renderOrder=-5;stars.material.depthTest=false;this.starGroup.add(stars);
 }
 makeOort(){
  const rand=random(75865),p=[],c=[];for(let i=0;i<8000;i++){
   const r=Math.exp(Math.log(2000)+rand()*Math.log(50)),z=2*rand()-1,a=rand()*Math.PI*2,s=Math.sqrt(1-z*z);
   p.push(r*s*Math.cos(a),r*z,r*s*Math.sin(a));c.push(.35,.48,.49);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  this.oort=new THREE.Points(g,pointMaterial(1.65,.23));this.oort.frustumCulled=false;this.scene.add(this.oort);
 }
 makeBody(b){
  if(this.meshes.has(b.id)||!b.radius)return;
  const vis=VISUALS[b.name]||{},root=new THREE.Group(),rotator=new THREE.Group();root.add(rotator);
  const texture=vis.texture?this.texture(vis.texture):proceduralTexture(b);
  const material=b.id==='10'?new THREE.MeshBasicMaterial({map:texture,color:0xffbf69}):new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0,bumpMap:vis.texture&&['Jupiter','Saturn','Uranus','Neptune','Venus'].includes(b.name)?null:texture,bumpScale:.0015});
  const mesh=new THREE.Mesh(sphere,material);mesh.castShadow=b.id!=='10';mesh.receiveShadow=true;rotator.add(mesh);
  let ratio=vis.ratio||[1,1,1];
  const model=this.orientation[b.id];
  if(model?.radii&&!vis.ratio){
   const r=model.radii,mean=Math.cbrt(r[0]*r[1]*r[2]);ratio=[r[0]/mean,r[2]/mean,r[1]/mean];
  }
  mesh.scale.set(...ratio);
  root.userData={rotator,mesh,body:b};this.scene.add(root);this.meshes.set(b.id,root);
  if(RINGS[b.name])this.addRings(root,b);
  if(b.name==='Earth'){
   const clouds=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({map:this.texture('earth_clouds'),alphaMap:this.texture('earth_clouds'),transparent:true,opacity:.62,roughness:1,depthWrite:false}));clouds.scale.setScalar((b.radius+12)/b.radius);rotator.add(clouds);
   const night=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({map:this.texture('earth_nightmap'),transparent:true,blending:THREE.AdditiveBlending,opacity:.12,depthWrite:false}));night.scale.setScalar(1.00015);rotator.add(night);
   this.addAtmosphere(rotator,100/b.radius,0x6fafff);
  }
  if(b.name==='Venus')this.addAtmosphere(rotator,80/b.radius,0xd8b873);
  if(b.name==='Titan')this.addAtmosphere(rotator,200/b.radius,0xb99550);
  if(b.name==='Sun')this.addSolarActivity(root,b);
 }
 addAtmosphere(root,height,color){
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,uniforms:{tint:{value:new THREE.Color(color)}},vertexShader:`varying vec3 n;varying vec3 v;#include <logdepthbuf_pars_vertex>
void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;#include <logdepthbuf_vertex>\n}`,fragmentShader:`varying vec3 n;varying vec3 v;uniform vec3 tint;#include <logdepthbuf_pars_fragment>
void main(){#include <logdepthbuf_fragment>\nfloat a=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(tint,a*.35);}`});
  // GLSL preprocessor directives must occupy their own lines.
  mat.vertexShader='#include <common>\n'+mat.vertexShader.replace(/#/g,'\n#');mat.fragmentShader=mat.fragmentShader.replace(/#/g,'\n#');
  const glow=new THREE.Mesh(sphere,mat);glow.scale.setScalar(1+height);root.add(glow);
 }
 addRings(root,b){
  const rings=new THREE.Group();root.userData.rotator.add(rings);
  for(const [inner,outer,opacity,color] of RINGS[b.name]){
   const geo=new THREE.RingGeometry(inner/b.radius,outer/b.radius,384,1);geo.rotateX(-Math.PI/2);
   const positions=geo.getAttribute('position'),uv=geo.getAttribute('uv');
   for(let i=0;i<uv.count;i++){const r=Math.hypot(positions.getX(i),positions.getZ(i))*b.radius;uv.setXY(i,(r-66900)/(140250-66900),.5);}
   const ringMap=b.name==='Saturn'&&outer<140300?this.texture('saturn_ring_alpha'):null;
   const material=new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,transparent:true,opacity,roughness:1,depthWrite:false,map:ringMap,emissive:color,emissiveMap:ringMap,emissiveIntensity:ringMap?1.4:.08});
   const ring=new THREE.Mesh(geo,material);ring.receiveShadow=true;ring.castShadow=false;rings.add(ring);
  }
  if(b.name==='Saturn'){
   const lineGeo=new THREE.BufferGeometry(),pts=[];for(let i=0;i<=600;i++){const a=i/600*Math.PI*2;pts.push(Math.cos(a)*140220/b.radius,0,Math.sin(a)*140220/b.radius);}
   lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));rings.add(new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0x80735e,transparent:true,opacity:.4})));
  }
 }
 addSolarActivity(root,b){
  const group=new THREE.Group(),rand=random(443);root.userData.rotator.add(group);
  const loops=[];
  for(let j=0;j<20;j++){
   const phi=rand()*Math.PI*2,theta=Math.acos(rand()*1.7-.85),n=new THREE.Vector3(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
   const tangent=new THREE.Vector3(-Math.sin(phi),0,Math.cos(phi)),span=.04+rand()*.15,height=(20000+rand()*160000)/b.radius,points=[];
   for(let k=0;k<=48;k++){const u=k/48,p=n.clone().multiplyScalar(1+Math.sin(u*Math.PI)*height).addScaledVector(tangent,(u-.5)*span*2);points.push(p);}
   const curve=new THREE.CatmullRomCurve3(points),geo=new THREE.TubeGeometry(curve,48,.001+rand()*.0025,5,false);
   const loop=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:j%3?0xf75c16:0xffa04b,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));group.add(loop);loops.push(loop);
  }
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),grad=g.createRadialGradient(128,128,38,128,128,128);grad.addColorStop(0,'rgba(255,183,58,0)');grad.addColorStop(.15,'rgba(255,167,44,.14)');grad.addColorStop(.3,'rgba(255,111,22,.035)');grad.addColorStop(1,'rgba(255,77,12,0)');g.fillStyle=grad;g.fillRect(0,0,256,256);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.scale.setScalar(5.2);group.add(sprite);
  this.effects.set('solar',{group,loops});
 }
 initSmall(bodies){
  this.trails.initSmall(bodies);
  const p=new Float32Array(bodies.length*3),c=new Float32Array(p.length);this.smallCoords=new Float64Array(p.length);
  for(let i=0;i<bodies.length;i++){const b=bodies[i],color=new THREE.Color(b.cls==='TJN'?'#ac9272':b.cls==='TNO'?'#769cac':b.type==='comet'?'#83b9a5':'#8c9499');c.set([color.r,color.g,color.b],i*3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(c,3));
  this.smallPoints=new THREE.Points(g,pointMaterial(innerWidth<700?2:1.8,.7));this.smallPoints.frustumCulled=false;this.scene.add(this.smallPoints);
 }
 updateOrbit(b,jd){
  if(!b.localState&&!b.basis)return;
  const guide=b.basis?smallEllipse(b):ellipseFromState(b.localState,GM[b.parent]*DAY*DAY);
  if(!guide)return;
  let line=this.lines.get(b.id);
  if(!line){line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:VISUALS[b.name]?.color||'#627676',transparent:true,opacity:.25,depthWrite:false}));line.frustumCulled=false;this.scene.add(line);this.lines.set(b.id,line);}
  line.geometry.setAttribute('position',new THREE.BufferAttribute(guide.vertices,3));line.userData={a:guide.a,body:b,jd};
 }
 relative(pos,out=V()) {return out.set((pos[0]-this.origin[0])/this.unit,(pos[2]-this.origin[2])/this.unit,-(pos[1]-this.origin[1])/this.unit);}
 render(state,bodies,byName,small,dt){
  const {origin,distance,yaw,pitch,jd,selected,flags}=state;this.origin.set(origin);this.unit=distance/500;
  const off=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(500);
  this.camera.position.copy(off);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
  this.starGroup.position.copy(this.camera.position);this.starGroup.visible=flags.stars;
  this.oort.visible=flags.regions&&distance>500*AU;this.oort.scale.setScalar(AU/this.unit);this.relative([0,0,0],this.oort.position);
  const selectedBody=selected.type==='region'?byName.get(selected.scope):selected;
  const localSystem=selectedBody?.type==='moon'?selectedBody.parent:selectedBody?.name;
  const scopeParent=byName.get(localSystem);const scopeDistance=scopeParent?.pos?Math.hypot(...scopeParent.pos.map((v,i)=>v-origin[i])):0;
  let sizeForShadow=selectedBody?.radius/this.unit||1;
  const sunDirection=toVec(selectedBody?.pos||origin).negate().normalize();
  if(!sunDirection.length())sunDirection.set(1,0,0);
  const selectedPos=selectedBody?.pos?this.relative(selectedBody.pos):V();
  this.light.target.position.copy(selectedPos);this.light.position.copy(selectedPos).addScaledVector(sunDirection,Math.max(sizeForShadow*10,500));
  const sc=this.light.shadow.camera,extent=Math.max(sizeForShadow*2.8,.2);sc.left=sc.bottom=-extent;sc.right=sc.top=extent;sc.near=.1;sc.far=Math.max(sizeForShadow*25,1500);sc.updateProjectionMatrix();
  this.ambient.intensity=flags.fill?.20:.012;
  const markers=[],markerColors=[],lights=[],lightColors=[];this.hitTargets=[];
  const objects=small?.includes(selected)?[...bodies,selected]:bodies;
  for(const b of objects){
   if(!b.pos)continue;
   const root=this.meshes.get(b.id),position=this.relative(b.pos),r=b.radius/this.unit;
   if(root){
    root.position.copy(position);root.scale.setScalar(r);root.visible=r>1e-7&&position.length()<1e10;
    const model=this.orientation[b.id];
    if(model){
     const [x,y,z]=orientationMatrix(model,jd).map(equatorialToRender),matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(...x),new THREE.Vector3(...z),new THREE.Vector3(...y).negate());root.userData.rotator.quaternion.setFromRotationMatrix(matrix);
    }else if(b.type!=='asteroid'&&b.type!=='comet'){
     // No measured spin model: do not fabricate a rotation rate.
     root.userData.rotator.rotation.set(0,0,0);
    }
   }
   const toCamera=position.distanceTo(this.camera.position),angularRadius=(b.radius||0)/this.unit/toCamera*innerHeight/(2*Math.tan(21*DEG));
   if(root)root.visible=angularRadius>.15&&toCamera<1e10;
   const relevant=b.type!=='moon'||b.parent===localSystem||scopeDistance<distance&&b.parent===scopeParent?.parent;
   const guideVisible=flags.orbits&&(b.type!=='moon'||(relevant&&distance<5*AU))&&b.id!=='10';
   let line=this.lines.get(b.id);
   if(guideVisible&&(!line||Math.abs(jd-line.userData.jd)>.5)&&b.localState)this.updateOrbit(b,jd);
   line=this.lines.get(b.id);
   if(line){
    const parent=byName.get(b.parent);this.relative(parent?.pos||[0,0,0],line.position);line.scale.setScalar(line.userData.a/this.unit);
    line.visible=guideVisible&&line.userData.a<distance*2.5&&line.userData.a>distance*.001&&(b.type!=='moon'||distance>(scopeParent?.radius||0)*20||b.id===selected.id);
    line.material.opacity=b.id===selected.id ? .52 : b.type==='moon' ? .17 : .24;
   }
   const isPlanet=['planet','star'].includes(b.type)||b.id==='999';
   const distant=isPlanet&&angularRadius<2.8&&toCamera>2200;
   if((!relevant||toCamera>2200)&&b.id!==selected.id&&!distant)continue;
   // A directional point at a finite sky radius avoids far-distance clipping.
   // This is a light/locator overlay; the physical mesh stays at its real size.
   const projectedPosition=distant?position.clone().sub(this.camera.position).normalize().multiplyScalar(10000).add(this.camera.position):position;
   if(projectedPosition.clone().applyMatrix4(this.camera.matrixWorldInverse).z>=0)continue;
   const proj=projectedPosition.clone().project(this.camera);
   if(Math.abs(proj.x)>1.1||Math.abs(proj.y)>1.1)continue;
   const x=(proj.x+1)/2*innerWidth,y=(1-proj.y)/2*innerHeight;
   if(!distant||flags.lights)this.hitTargets.push({body:b,x,y,radius:Math.max(7,angularRadius),distance:toCamera,distant});
   if(distant&&flags.lights){
    lights.push(projectedPosition.x,projectedPosition.y,projectedPosition.z);
    const c=new THREE.Color(VISUALS[b.name]?.color||'#ccd9cc').convertLinearToSRGB().multiplyScalar(1.12);lightColors.push(c.r,c.g,c.b);
   }else if(!distant&&flags.markers&&angularRadius<3){markers.push(position.x,position.y,position.z);const c=new THREE.Color(VISUALS[b.name]?.color||'#97aab0');markerColors.push(c.r,c.g,c.b);}
   b.screen={x,y,angularRadius,distance:toCamera};
  }
  this.markers.geometry.setAttribute('position',new THREE.Float32BufferAttribute(markers,3));this.markers.geometry.setAttribute('color',new THREE.Float32BufferAttribute(markerColors,3));this.markers.visible=flags.markers;
  this.planetLights.geometry.setAttribute('position',new THREE.Float32BufferAttribute(lights,3));this.planetLights.geometry.setAttribute('color',new THREE.Float32BufferAttribute(lightColors,3));this.planetLights.visible=flags.lights;
  if(this.smallPoints){
   this.smallPoints.visible=flags.small&&flags.markers&&distance>.005*AU;
   if(this.smallPoints.visible){const a=this.smallPoints.geometry.attributes.position.array,p=this.smallCoords;for(let i=0;i<p.length;i+=3){a[i]=(p[i]-origin[0])/this.unit;a[i+1]=(p[i+2]-origin[2])/this.unit;a[i+2]=-(p[i+1]-origin[1])/this.unit;}this.smallPoints.geometry.attributes.position.needsUpdate=true;}
  }
  const activity=this.effects.get('solar');if(activity){activity.group.visible=flags.activity;activity.loops.forEach((l,i)=>{l.material.opacity=.43+.18*Math.sin((jd-2461041.5)*7+i*1.7);});}
  this.closeOrbit.visible=false;
  if(flags.orbits&&selected.localState&&distance<Math.hypot(...selected.localState.slice(0,3))*.3){
   const guide=closeOrbitFromState(selected.localState,GM[selected.parent]*DAY*DAY,distance);
   if(guide){this.closeOrbit.geometry.attributes.position.array.set(guide.vertices);this.closeOrbit.geometry.attributes.position.needsUpdate=true;this.relative(selected.pos,this.closeOrbit.position);this.closeOrbit.scale.setScalar(1/this.unit);this.closeOrbit.visible=true;}
  }
  this.trails.render(state,bodies,this.smallCoords,this);
  this.renderer.render(this.scene,this.camera);
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;if(innerWidth<700)this.camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.13,innerWidth,innerHeight);else this.camera.clearViewOffset();this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
}
