import * as THREE from 'three';

/* ============ ASHFALL : souls-like boss rush ============ */
const canvas = document.getElementById('game');
function bootFail(msg){
  const note=document.getElementById('loading-note');
  if(note){ note.textContent=msg; note.style.opacity=1; note.style.color='#ff5a3c'; }
  const btn=document.getElementById('btn-start');
  if(btn){ btn.textContent='⟳ RETRY (RELOAD)'; btn.onclick=()=>location.reload(); }
  window.__ashfallFailed=msg;
}
let renderer;
try{
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
}catch(e){ bootFail('WebGL unavailable in this browser — try Chrome/Edge with hardware acceleration.'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a09);
scene.fog = new THREE.FogExp2(0x0f0d0b, 0.016);
const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 300);

addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

/* ---------- helpers ---------- */
const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist2D=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function angleTo(from,to){ return Math.atan2(to.x-from.x, to.z-from.z); }
function angDiff(a,b){ let d=a-b; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; }
const $=id=>document.getElementById(id);

/* ---------- audio (procedural) ---------- */
let AC=null, muted=false, droneNodes=[];
function audio(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); startDrone(); }catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); }
function env(g,t0,a,peak,d){ g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+a); g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d); }
function tone(freq,dur,type='sine',vol=0.2,slide=0){ if(!AC||muted)return; const t=AC.currentTime; const o=AC.createOscillator(),g=AC.createGain(); o.type=type; o.frequency.setValueAtTime(freq,t); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),t+dur); env(g,t,0.01,vol,dur); o.connect(g).connect(AC.destination); o.start(t); o.stop(t+dur+0.1); }
function noise(dur=0.2,vol=0.25,low=400,high=3000){ if(!AC||muted)return; const t=AC.currentTime; const len=AC.sampleRate*dur; const buf=AC.createBuffer(1,len,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<len;i++)d[i]=Math.random()*2-1; const s=AC.createBufferSource(); s.buffer=buf; const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=rand(low,high); f.Q.value=0.8; const g=AC.createGain(); env(g,t,0.005,vol,dur); s.connect(f).connect(g).connect(AC.destination); s.start(t); }
const sfx={
  swing(){ noise(0.16,0.18,900,2600); },
  heavySwing(){ noise(0.3,0.24,300,1200); },
  hit(){ noise(0.18,0.32,200,900); tone(90,0.2,'triangle',0.3,-40); },
  bossHit(){ noise(0.14,0.2,500,2000); tone(220,0.12,'square',0.12,-80); },
  block(){ tone(320,0.15,'square',0.2,-120); noise(0.12,0.2,1200,4000); },
  deflect(){ tone(1244,0.22,'square',0.28,-300); tone(1868,0.3,'sine',0.22,-400); noise(0.2,0.3,2500,7000); },
  deathblow(){ tone(98,0.9,'sawtooth',0.35,-60); noise(0.7,0.35,300,2500); [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,0.5,'triangle',0.2),i*90)); },
  roll(){ noise(0.22,0.12,300,900); },
  heal(){ tone(300,0.5,'sine',0.2,300); tone(450,0.6,'sine',0.14,200); },
  kiai(){ noise(0.14,0.14,1400,4200); tone(180,0.18,'sawtooth',0.14,120); },
  charge(){ if(!AC||muted)return; const t=AC.currentTime; const o=AC.createOscillator(),g=AC.createGain(); o.type='sine'; o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(880,t+0.7); env(g,t,0.05,0.16,0.7); o.connect(g).connect(AC.destination); o.start(t); o.stop(t+0.9); },
  roar(){ if(!AC||muted)return; tone(70,1.1,'sawtooth',0.32,-30); tone(105,1.0,'sawtooth',0.2,-50); noise(0.9,0.2,150,600); },
  death(){ tone(220,1.4,'sawtooth',0.25,-180); noise(1.0,0.2,200,800); },
  felled(){ [196,247,294,392].forEach((f,i)=>setTimeout(()=>tone(f,0.7,'triangle',0.22),i*160)); },
  ui(){ tone(660,0.08,'sine',0.15); },
  step(){ noise(0.06,0.06,200,600); },
  fire(){ noise(0.4,0.14,800,2400); },
  beam(){ tone(180,0.8,'sawtooth',0.22,420); noise(0.7,0.16,600,3000); },
};
function startDrone(){ try{
  const g=AC.createGain(); g.gain.value=0.05; g.connect(AC.destination);
  [55,82.5,110.3].forEach(f=>{ const o=AC.createOscillator(); o.type='sawtooth'; o.frequency.value=f; const fl=AC.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=220; o.connect(fl).connect(g); o.start(); droneNodes.push(o); });
}catch(e){} }

/* ---------- input ---------- */
const keys={};
let mouseDX=0, mouseDY=0, dragging=false, lastMX=0, lastMY=0;
addEventListener('keydown',e=>{ keys[e.code]=true; if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault(); handleKeyPress(e.code); });
addEventListener('keyup',e=>{ keys[e.code]=false; });
canvas.addEventListener('mousedown',e=>{ audio(); if(state==='fight'||state==='intro'){ if(e.button===0)tryAttack(false); if(e.button===2){ tryParry(); blocking=true; } } if(document.pointerLockElement!==canvas && (state==='fight')) canvas.requestPointerLock?.(); dragging=true; lastMX=e.clientX; lastMY=e.clientY; });
addEventListener('mouseup',e=>{ if(e.button===2)blocking=false; dragging=false; });
addEventListener('mousemove',e=>{ if(document.pointerLockElement===canvas){ mouseDX+=e.movementX; mouseDY+=e.movementY; } else if(dragging&&(state==='fight')){ mouseDX+=e.clientX-lastMX; mouseDY+=e.clientY-lastMY; lastMX=e.clientX; lastMY=e.clientY; } });
addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{ $('pause-tip').classList.toggle('hidden', document.pointerLockElement===canvas || (state!=='fight'&&state!=='intro')); });
function handleKeyPress(code){
  audio();
  if(code==='KeyM'){ muted=!muted; toast(muted?'SOUND OFF':'SOUND ON'); }
  if(state!=='fight')return;
  if(code==='Space')tryRoll();
  if(code==='KeyE'){ if(boss&&boss.broken&&!boss.dead&&state==='fight'&&dist2D(player.pos,boss.pos)<4)doDeathblow(); else tryFlask(); }
  if(code==='KeyQ')toggleLock();
  if(code==='KeyF')tryAttack(true);
  if(code==='KeyR')tryParry();
}

/* ---------- particles ---------- */
const PMAX=900;
function circleSprite(){
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  const grd=g.createRadialGradient(32,32,2,32,32,30); grd.addColorStop(0,'rgba(255,255,255,1)'); grd.addColorStop(0.5,'rgba(255,255,255,0.6)'); grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd; g.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(c); return t;
}
const pGeo=new THREE.BufferGeometry();
const pPos=new Float32Array(PMAX*3), pCol=new Float32Array(PMAX*3);
pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const pMat=new THREE.PointsMaterial({size:0.35,map:circleSprite(),vertexColors:true,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending});
const points=new THREE.Points(pGeo,pMat); points.frustumCulled=false; scene.add(points);
const parts=[]; for(let i=0;i<PMAX;i++)parts.push({life:0,max:1,vx:0,vy:0,vz:0,r:1,g:0.5,b:0.2,grav:0});
let pCursor=0;
function burst(p,n,color,spread=3,up=4,life=0.7,grav=-6){
  const c=new THREE.Color(color);
  for(let k=0;k<n;k++){ const pt=parts[pCursor]; const i=pCursor; pCursor=(pCursor+1)%PMAX;
    pt.life=pt.max=life*rand(0.5,1.2); pt.vx=rand(-spread,spread); pt.vy=rand(0.5,up); pt.vz=rand(-spread,spread); pt.grav=grav;
    pPos[i*3]=p.x+rand(-0.2,0.2); pPos[i*3+1]=p.y+rand(0,0.4); pPos[i*3+2]=p.z+rand(-0.2,0.2);
    const v=rand(0.7,1.3); pCol[i*3]=Math.min(1,c.r*v); pCol[i*3+1]=Math.min(1,c.g*v); pCol[i*3+2]=Math.min(1,c.b*v);
  }
}
function updateParticles(dt){
  for(let i=0;i<PMAX;i++){ const pt=parts[i]; if(pt.life<=0){ pPos[i*3+1]=-999; continue; }
    pt.life-=dt; pt.vy+=pt.grav*dt;
    pPos[i*3]+=pt.vx*dt; pPos[i*3+1]+=pt.vy*dt; pPos[i*3+2]+=pt.vz*dt;
    if(pPos[i*3+1]<0.02){ pPos[i*3+1]=0.02; pt.vy*=-0.3; }
    const f=Math.max(0,pt.life/pt.max); pCol[i*3]*=(0.985); pCol[i*3+1]*=(0.985); pCol[i*3+2]*=(0.985); void f;
  }
  pGeo.attributes.position.needsUpdate=true; pGeo.attributes.color.needsUpdate=true;
}
setInterval(()=>{ // ambient embers
  if(state==='title')return;
  emberPos.set(player.pos.x+rand(-18,18), rand(0.5,7), player.pos.z+rand(-18,18));
  burst(emberPos,1,Math.random()<0.7?0xff5a1a:0xffc46a,0.3,0.8,2.2,0.6);
},90);
const emberPos=V3();

/* ---------- arena ---------- */
function stoneTexture(){
  const c=document.createElement('canvas'); c.width=c.height=512; const g=c.getContext('2d');
  g.fillStyle='#2a2723'; g.fillRect(0,0,512,512);
  for(let i=0;i<2600;i++){ g.fillStyle=`rgba(${rand(20,70)|0},${rand(18,60)|0},${rand(15,50)|0},0.5)`; g.fillRect(rand(0,512),rand(0,512),rand(1,4),rand(1,4)); }
  g.strokeStyle='rgba(0,0,0,0.55)'; g.lineWidth=3;
  for(let r=0;r<4;r++){ g.beginPath(); g.arc(256,256,60+r*58,0,Math.PI*2); g.stroke(); }
  for(let i=0;i<16;i++){ const a=i/16*Math.PI*2; g.beginPath(); g.moveTo(256+Math.cos(a)*40,256+Math.sin(a)*40); g.lineTo(256+Math.cos(a)*250,256+Math.sin(a)*250); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3); return t;
}
const ARENA_R=21;
let floorMat, wallMat, brazierLights=[], flames=[];
const arenaGroup=new THREE.Group(); scene.add(arenaGroup);
function buildArena(){
  floorMat=new THREE.MeshStandardMaterial({map:stoneTexture(),roughness:0.95,metalness:0.05});
  const floor=new THREE.Mesh(new THREE.CircleGeometry(ARENA_R+6,64),floorMat);
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; arenaGroup.add(floor);
  const lavaGlow=new THREE.Mesh(new THREE.RingGeometry(ARENA_R+0.4,ARENA_R+5.5,64),new THREE.MeshBasicMaterial({color:0xff3a00,transparent:true,opacity:0.28,side:THREE.DoubleSide}));
  lavaGlow.rotation.x=-Math.PI/2; lavaGlow.position.y=0.02; arenaGroup.add(lavaGlow);
  wallMat=new THREE.MeshStandardMaterial({color:0x1c1a17,roughness:1});
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R+6,ARENA_R+6,10,48,1,true),wallMat);
  wall.position.y=5; wall.material.side=THREE.BackSide; arenaGroup.add(wall);
  const stoneMat=new THREE.MeshStandardMaterial({color:0x5a5348,roughness:0.85});
  const darkMat=new THREE.MeshStandardMaterial({color:0x38332c,roughness:1});
  for(let i=0;i<10;i++){ const a=i/10*Math.PI*2;
    const p=new THREE.Mesh(new THREE.BoxGeometry(1.6,rand(7,10),1.6),i%2?stoneMat:darkMat);
    p.position.set(Math.cos(a)*(ARENA_R+3.4),4,Math.sin(a)*(ARENA_R+3.4)); p.castShadow=true; arenaGroup.add(p);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.6,2.2),darkMat); cap.position.set(p.position.x,8.2,p.position.z); arenaGroup.add(cap);
  }
  // braziers
  for(let i=0;i<4;i++){ const a=i/4*Math.PI*2+Math.PI/4; const x=Math.cos(a)*(ARENA_R-2),z=Math.sin(a)*(ARENA_R-2);
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.4,0.9,10),darkMat); bowl.position.set(x,0.45,z); bowl.castShadow=true; arenaGroup.add(bowl);
    const fl=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,10),new THREE.MeshBasicMaterial({color:0xff8a2a})); fl.position.set(x,1.25,z); arenaGroup.add(fl); flames.push(fl);
    const l=new THREE.PointLight(0xff7a2a,30,16,1.8); l.position.set(x,2.2,z); scene.add(l); brazierLights.push(l);
  }
  // moon
  const moon=new THREE.Mesh(new THREE.SphereGeometry(6,16,16),new THREE.MeshBasicMaterial({color:0xd8cfb0,fog:false}));
  moon.position.set(-60,55,-90); scene.add(moon);
  const moonL=new THREE.PointLight(0xcfd4ff,200,300,1.6); moonL.position.copy(moon.position); scene.add(moonL);
  const arenaGlow=new THREE.PointLight(0xff9a4a,60,46,1.7); arenaGlow.position.set(0,9,0); scene.add(arenaGlow);
  scene.add(new THREE.HemisphereLight(0x8a90b0,0x4a2c14,1.25));
  const dir=new THREE.DirectionalLight(0xd8dcf0,1.7); dir.position.set(-20,30,-14); dir.castShadow=true;
  dir.shadow.mapSize.set(1024,1024); dir.shadow.camera.left=-26; dir.shadow.camera.right=26; dir.shadow.camera.top=26; dir.shadow.camera.bottom=-26; scene.add(dir);
  // dead trees / swords in ground decor
  for(let i=0;i<14;i++){ const a=rand(0,Math.PI*2), r=rand(ARENA_R+1,ARENA_R+5);
    const sw=new THREE.Mesh(new THREE.BoxGeometry(0.12,rand(1,1.8),0.3),new THREE.MeshStandardMaterial({color:0x6a6a72,roughness:0.4,metalness:0.8}));
    sw.position.set(Math.cos(a)*r,0.5,Math.sin(a)*r); sw.rotation.z=rand(-0.4,0.4); sw.rotation.y=rand(0,6); arenaGroup.add(sw);
  }
}
buildArena();

/* ---------- character builders ---------- */
function mat(c,r=0.7,m=0.1,e=0x000000,ei=0){ const mt=new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,emissive:e,emissiveIntensity:ei}); mt.userData.base=ei; return mt; }
function limb(w,h,d,c){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),c); m.castShadow=true; return m; }
function buildPlayerMesh(){
  const g=new THREE.Group();
  const armor=mat(0x4a5468,0.5,0.7), cloth=mat(0x2a1f18,0.95,0), skin=mat(0xc9a97e,0.8,0);
  const torso=limb(0.7,0.85,0.42,armor); torso.position.y=1.35; g.add(torso); g.userData.torso=torso;
  const cloak=new THREE.Mesh(new THREE.PlaneGeometry(0.75,1.1),new THREE.MeshStandardMaterial({color:0x5a1a1a,side:THREE.DoubleSide,roughness:1})); cloak.position.set(0,1.15,-0.28); cloak.rotation.x=0.15; g.add(cloak); g.userData.cloak=cloak;
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.24,12,12),skin); head.position.y=2.0; head.castShadow=true; g.add(head);
  const helm=new THREE.Mesh(new THREE.ConeGeometry(0.28,0.5,10),armor); helm.position.y=2.22; helm.castShadow=true; g.add(helm);
  const legL=limb(0.22,0.9,0.24,mat(0x333a48,0.6,0.6)); legL.position.set(-0.18,0.45,0); g.add(legL); g.userData.legL=legL;
  const legR=legL.clone(); legR.position.x=0.18; g.add(legR); g.userData.legR=legR;
  const armL=limb(0.18,0.75,0.2,armor); armL.position.set(-0.48,1.4,0); g.add(armL); g.userData.armL=armL;
  const armR=limb(0.18,0.75,0.2,armor); armR.position.set(0.48,1.4,0); g.add(armR); g.userData.armR=armR;
  const sword=new THREE.Group();
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.09,1.25,0.02),mat(0xb9c2d4,0.25,0.95)); blade.position.y=0.85; blade.castShadow=true; sword.add(blade);
  const guard=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.07,0.08),mat(0x8a6a2a,0.4,0.8)); guard.position.y=0.22; sword.add(guard);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.3,8),mat(0x1a1210,0.9,0)); grip.position.y=0.05; sword.add(grip);
  sword.position.set(0.48,1.05,0.15); sword.rotation.x=Math.PI/2.3; g.add(sword); g.userData.sword=sword;
  const shield=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.06,14),mat(0x3a3f4a,0.5,0.6)); shield.rotation.z=Math.PI/2; shield.position.set(-0.62,1.25,0.15); shield.castShadow=true; g.add(shield); g.userData.shield=shield;
  const glow=new THREE.PointLight(0x4466ff,0,7,2); glow.position.y=2; g.add(glow); g.userData.glow=glow;
  return g;
}
function buildBossMesh(kind){
  const g=new THREE.Group();
  if(kind===0){ // Hollow Blade — full jointed rig: every limb rotates around
    // its own joint pivot, sword parented to the hand fist
    const armor=mat(0x3d2f28,0.6,0.5), edge=mat(0x8a1f1f,0.5,0.3,0xff2200,0.7);
    const steel=mat(0x4a4a52,0.45,0.8), clothM=mat(0x1a0f0f,1,0);
    const HIPS_Y=1.02;
    const joint=(r)=>{ const s=new THREE.Mesh(new THREE.SphereGeometry(r,10,10),armor); s.castShadow=true; return s; };
    const bone=(r,len,m)=>{ const b=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,4,10),m||armor); b.castShadow=true; return b; };
    const hips=new THREE.Group(); hips.position.y=HIPS_Y; g.add(hips); g.userData.hips=hips;
    const pelvis=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.2,0.26),armor); pelvis.castShadow=true; hips.add(pelvis);
    const faulds=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.36,0.3,10),clothM); faulds.position.y=-0.2; faulds.castShadow=true; hips.add(faulds);
    // waist pivot -> chest
    const torsoG=new THREE.Group(); torsoG.position.y=0.14; hips.add(torsoG); g.userData.torso=torsoG;
    const chest=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.21,0.55,12),armor); chest.position.y=0.34; chest.castShadow=true; torsoG.add(chest);
    const belt=new THREE.Mesh(new THREE.CylinderGeometry(0.23,0.24,0.1,10),steel); belt.position.y=0.08; torsoG.add(belt);
    // pauldrons ride on the torso so arms rotate freely beneath them
    for(const s of[-1,1]){ const pd=new THREE.Mesh(new THREE.SphereGeometry(0.15,10,10),steel); pd.scale.set(1,0.72,1); pd.position.set(0.34*s,0.55,0); pd.castShadow=true; torsoG.add(pd); }
    // neck + helmeted head, eyes track the player
    const neck=new THREE.Group(); neck.position.y=0.68; torsoG.add(neck); g.userData.neck=neck;
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.15,12,12),mat(0x1a1512,0.9,0.2)); head.position.y=0.1; head.castShadow=true; neck.add(head);
    const helm=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.17,0.22,10),steel); helm.position.y=0.24; helm.castShadow=true; neck.add(helm);
    const crest=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.16,0.3),edge); crest.position.y=0.38; neck.add(crest);
    const eyes=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.05,0.04),mat(0xff2200,0.4,0,0xff2200,2.4)); eyes.position.set(0,0.11,0.14); neck.add(eyes);
    const cape=new THREE.Mesh(new THREE.PlaneGeometry(1.0,1.7),new THREE.MeshStandardMaterial({color:0x1a0f0f,side:THREE.DoubleSide,roughness:1})); cape.position.set(0,0.42,-0.32); cape.rotation.x=0.15; torsoG.add(cape); g.userData.cape=cape;
    const chestLight=new THREE.PointLight(0xff2211,12,12,1.8); chestLight.position.y=0.4; torsoG.add(chestLight);
    // ARMS: shoulder pivot -> upper arm -> elbow pivot -> forearm -> fist -> sword
    function buildArm(side){
      const sh=new THREE.Group(); sh.position.set(0.37*side,0.5,0); torsoG.add(sh);
      const up=bone(0.085,0.2); up.position.y=-0.18; sh.add(up);
      const el=new THREE.Group(); el.position.y=-0.36; sh.add(el); el.add(joint(0.08));
      const fo=bone(0.07,0.18,steel); fo.position.y=-0.16; el.add(fo);
      const hand=new THREE.Group(); hand.position.y=-0.33; el.add(hand);
      const palm=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.13,0.09),armor); palm.position.y=-0.05; palm.castShadow=true; hand.add(palm);
      for(let f=-1;f<=1;f++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.1,0.035),armor); fin.position.set(0.035*f,-0.15,0.01); hand.add(fin); }
      const thumb=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.08,0.03),armor); thumb.position.set(0.06*side,-0.06,0.03); thumb.rotation.z=0.5*side; hand.add(thumb);
      return {sh,el,hand};
    }
    const armR=buildArm(1), armL=buildArm(-1);
    g.userData.armR=armR.sh; g.userData.elbR=armR.el; g.userData.handR=armR.hand;
    g.userData.armL=armL.sh; g.userData.elbL=armL.el; g.userData.handL=armL.hand;
    // sword gripped in the right fist: blade continues the forearm line
    const sword=new THREE.Group(); sword.position.set(0,-0.1,0.03); sword.rotation.x=Math.PI; armR.hand.add(sword); g.userData.sword=sword;
    const bladeMat=mat(0x9aa2b5,0.3,0.9,0xff3322,0);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.13,2.0,0.03),bladeMat); blade.position.y=1.2; blade.castShadow=true; sword.add(blade);
    const e=new THREE.Mesh(new THREE.BoxGeometry(0.05,2.0,0.045),edge); e.position.y=1.2; sword.add(e);
    const guard=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.07,0.08),steel); guard.position.y=0.18; sword.add(guard);
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.3,8),mat(0x1a1210,0.9,0)); grip.position.y=0.02; sword.add(grip);
    g.userData.wmats=[bladeMat,edge];
    // LEGS: hip pivot -> thigh -> knee pivot (+cap) -> shin -> foot
    function buildLeg(side){
      const hp=new THREE.Group(); hp.position.set(0.15*side,-0.04,0); hips.add(hp);
      const th=bone(0.11,0.22); th.position.y=-0.22; hp.add(th);
      const kn=new THREE.Group(); kn.position.y=-0.46; hp.add(kn); kn.add(joint(0.1));
      const sh2=bone(0.085,0.22,steel); sh2.position.y=-0.21; kn.add(sh2);
      const ft=new THREE.Group(); ft.position.y=-0.44; kn.add(ft);
      const foot=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.3),armor); foot.position.set(0,-0.03,0.08); foot.castShadow=true; ft.add(foot);
      return {hp,kn};
    }
    const legL=buildLeg(-1), legR=buildLeg(1);
    g.userData.legL=legL.hp; g.userData.kneeL=legL.kn; g.userData.legR=legR.hp; g.userData.kneeR=legR.kn;
    g.scale.setScalar(1.12);
    g.userData.wristRest=0.85; // greatsword dragged tip-down behind the heel
    g.userData.handR.rotation.x=0.85;
    const l=new THREE.PointLight(0xff2211,10,12,1.8); l.position.y=2.6; g.add(l);
  } else if(kind===1){ // Cinder Golem
    const rock=mat(0x2e2a26,0.95,0.05), crack=mat(0xff5a1a,0.6,0,0xff4400,1.6), dark=mat(0x1a1512,1,0);
    const fistMat=mat(0x1a1512,1,0,0xff5511,0);
    const hips=limb(1.8,0.9,1.2,dark); hips.position.y=1.1; g.add(hips);
    const torso=limb(2.3,1.6,1.5,rock); torso.position.y=2.4; g.add(torso); g.userData.torso=torso;
    const core=new THREE.Mesh(new THREE.SphereGeometry(0.5,14,14),crack); core.position.set(0,2.5,0.78); g.add(core); g.userData.core=core;
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.7,0.9),rock); head.position.y=3.5; g.add(head);
    const eyes=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.12,0.05),crack); eyes.position.set(0,3.5,0.46); g.add(eyes);
    const armL=limb(0.8,2.0,0.8,rock); armL.position.set(-1.6,2.2,0); g.add(armL); g.userData.armL=armL;
    const armR=limb(0.8,2.0,0.8,rock); armR.position.set(1.6,2.2,0); g.add(armR); g.userData.armR=armR;
    const fistL=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.9,1.0),fistMat); fistL.position.set(-1.6,1.0,0.1); fistL.castShadow=true; g.add(fistL); g.userData.fistL=fistL;
    const fistR=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.9,1.0),fistMat); fistR.position.set(1.6,1.0,0.1); fistR.castShadow=true; g.add(fistR); g.userData.fistR=fistR;
    g.userData.wmats=[fistMat,crack];
    const legL=limb(0.7,1.0,0.7,dark); legL.position.set(-0.6,0.4,0); g.add(legL); g.userData.legL=legL;
    const legR=limb(0.7,1.0,0.7,dark); legR.position.set(0.6,0.4,0); g.add(legR); g.userData.legR=legR;
    const l=new THREE.PointLight(0xff5a1a,26,16,1.8); l.position.y=2.6; g.add(l); g.userData.glow=l;
  } else { // Ashen Saint
    const robe=mat(0x2a2030,0.9,0.1), gold=mat(0xc9a44a,0.35,0.9), glowM=mat(0xffd88a,0.4,0,0xffaa33,2);
    const skirt=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.2,12),robe); skirt.position.y=1.1; skirt.castShadow=true; g.add(skirt);
    const torso=limb(0.9,1.1,0.6,robe); torso.position.y=2.6; g.add(torso);
    const hood=new THREE.Mesh(new THREE.ConeGeometry(0.45,0.9,10),robe); hood.position.y=3.6; g.add(hood);
    const face=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10),mat(0x000000,1,0,0xffcc66,1.2)); face.position.set(0,3.3,0.15); g.add(face);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.05,8,32),gold); halo.position.y=3.9; halo.rotation.x=Math.PI/2.3; g.add(halo); g.userData.halo=halo;
    const armR=limb(0.2,1.0,0.22,robe); armR.position.set(0.42,2.6,0.35); g.add(armR); g.userData.armR=armR;
    const armL=limb(0.2,1.0,0.22,robe); armL.position.set(0.08,2.2,0.45); g.add(armL); g.userData.armL=armL;
    const staff=new THREE.Group();
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.6,8),gold); rod.castShadow=true; staff.add(rod);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(0.24,12,12),glowM); orb.position.y=1.45; staff.add(orb); g.userData.orb=orb;
    staff.position.set(0.25,2.3,0.55); g.add(staff); g.userData.sword=staff; // held two-handed front-center
    g.userData.wmats=[gold,glowM];
    const l=new THREE.PointLight(0xffb84a,22,18,1.7); l.position.y=3.4; g.add(l);
  }
  g.traverse(o=>{ if(o.isMesh)o.castShadow=true; });
  { const u=g.userData; u.rest={ armRy:u.armR?u.armR.position.y:0, fistLy:u.fistL?u.fistL.position.y:0, fistRy:u.fistR?u.fistR.position.y:0, swx:u.sword?u.sword.position.x:0, swy:u.sword?u.sword.position.y:0, swz:u.sword?u.sword.position.z:0, swrx:u.sword?u.sword.rotation.x:0 }; }
  scene.add(g); return g;
}

/* ---------- telegraphs / fx meshes ---------- */
function makeRing(r,color=0xff2211){
  const m=new THREE.Mesh(new THREE.RingGeometry(r-0.25,r,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.y=0.05; m.visible=false; scene.add(m); return m;
}
const telegraphRing=makeRing(4.5), telegraphRing2=makeRing(3.2,0xff8833);
/* Melee sector telegraph: red pie-slice on the ground showing the strike zone */
function sectorGeo(r,arc){
  const g=new THREE.CircleGeometry(r,26,-Math.PI/2-arc/2,arc);
  g.rotateX(-Math.PI/2); return g;
}
const teleArc=new THREE.Mesh(sectorGeo(3.6,Math.PI*0.6),new THREE.MeshBasicMaterial({color:0xff2211,transparent:true,opacity:0.4,side:THREE.DoubleSide,depthWrite:false}));
teleArc.position.y=0.06; teleArc.visible=false; scene.add(teleArc);
function showMeleeTele(pos,yaw,range,arcDeg=100){
  teleArc.geometry.dispose();
  teleArc.geometry=sectorGeo(range,arcDeg*Math.PI/180);
  teleArc.position.set(pos.x,0.06,pos.z); teleArc.rotation.y=yaw; teleArc.visible=true;
}
function hideMeleeTele(){ teleArc.visible=false; }
/* Weapon charge glow: blade/fists/staff flare red while winding up */
function setWGlow(u,k,hex=0xff3322){
  if(!u.wmats)return;
  for(const m of u.wmats){ m.emissive.setHex(hex); m.emissiveIntensity=(m.userData.base||0)+k*2.4; }
}
function decayWGlow(dt){
  if(!boss)return; const u=boss.mesh.userData; if(!u.wmats)return;
  for(const m of u.wmats){ const b=m.userData.base||0; if(m.emissiveIntensity>b)m.emissiveIntensity=Math.max(b,m.emissiveIntensity-6*dt); }
}
const slashMesh=new THREE.Mesh(new THREE.PlaneGeometry(2.4,0.75),new THREE.MeshBasicMaterial({color:0xcfe0ff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
scene.add(slashMesh); let slashT=1;
function showSlash(pos,yaw,big=false,color=0xcfe0ff){
  slashMesh.position.copy(pos); slashMesh.position.y+=1.3; slashMesh.rotation.y=yaw;
  slashMesh.scale.setScalar(big?1.35:0.9); slashMesh.material.color.set(color); slashMesh.material.opacity=0.65; slashT=0;
}

/* ---------- projectiles / shockwaves / pools ---------- */
const projectiles=[], shockwaves=[], pools=[];
const projGeo=new THREE.SphereGeometry(0.28,10,10);
const projMatCache={};
function projMat(color){ if(!projMatCache[color])projMatCache[color]=new THREE.MeshBasicMaterial({color}); return projMatCache[color]; }
function spawnProj(from,targetPos,{speed=12,dmg=14,color=0xff5a2a,homing=0,life=4,size=1}={}){
  // perf: shared unlit material, NO per-projectile light (each light forces
  // a shader recompile on spawn — that was the cast hitch), hard cap count
  if(projectiles.length>=14){ const old=projectiles.shift(); scene.remove(old.mesh); }
  const m=new THREE.Mesh(projGeo,projMat(color)); m.scale.setScalar(size); m.position.copy(from);
  const dir=targetPos.clone().sub(from); dir.y=0; dir.normalize();
  const o={mesh:m,vel:dir.multiplyScalar(speed),velY:rand(0,1),life,dmg,homing,color};
  scene.add(m); projectiles.push(o); burst(from,4,color,2,3,0.4); return o;
}
const waveGeo=new THREE.TorusGeometry(1,0.18,8,48);
function spawnShockwave(pos,{maxR=7,speed=9,dmg=18,color=0xff5a2a}={}){
  const m=new THREE.Mesh(waveGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9})); m.rotation.x=Math.PI/2; m.position.copy(pos); m.position.y=0.35; m.scale.setScalar(0.5);
  scene.add(m); shockwaves.push({mesh:m,r:0.5,maxR,speed,dmg,hitDone:false}); sfx.fire();
}
function spawnPool(pos,{r=2.6,dps=12,life=6,color=0xff4400}={}){
  const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.5,depthWrite:false})); m.rotation.x=-Math.PI/2; m.position.copy(pos); m.position.y=0.06;
  scene.add(m); pools.push({mesh:m,r,t:life,dps}); burst(pos,14,color,3,4,0.6);
}

/* ---------- game state ---------- */
const BOSS_DEFS=[
  {name:'HOLLOW BLADE',sub:'fallen duelist',hp:340,dmgMul:1.0,speed:5.2,arena:0x0a0908,posture:100},
  {name:'CINDER GOLEM',sub:'heart of slag',hp:560,dmgMul:1.35,speed:3.1,arena:0x140a06,posture:130},
  {name:'ASHEN SAINT',sub:'choir of embers',hp:700,dmgMul:1.15,speed:4.4,arena:0x0d0a14,posture:110},
];
/* ---------- safe storage (sandboxed iframes may throw) ---------- */
const store={
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
};
let state='title', bossIndex=0, ngPlus=0, deaths=0, runTime=0, bestTime=parseFloat(store.get('ashfall_best')||'0');
if(bestTime>0)$('best-time').textContent=fmtTime(bestTime);
function fmtTime(s){ s=Math.floor(s); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }

/* ---------- player ---------- */
const player={
  mesh:buildPlayerMesh(), pos:V3(0,0,10), vel:V3(), yaw:Math.PI, hp:100, maxHp:100, st:100, maxSt:100,
  stDelay:0, rollT:0, rollCD:0, rollDir:V3(), iframes:0, atkT:1, atkDur:0.45, combo:0, comboWin:0, didHit:false, heavy:false,
  drinkT:0, flasks:3, blocking:false, sprinting:false, dead:false, stepT:0, animT:0,
  parryT:0, parryCD:0,
};
player.mesh.position.copy(player.pos); scene.add(player.mesh);
let blocking=false;
function playerReset(full=true){
  player.hp=player.maxHp; player.st=player.maxSt; player.flasks=3; player.dead=false;
  player.pos.set(0,0,10); player.vel.set(0,0,0); player.rollT=0; player.atkT=1; player.drinkT=0; player.iframes=0; blocking=false;
  player.parryT=0; player.parryCD=0;
  player.yaw=Math.PI; player.mesh.rotation.set(0,Math.PI,0);
  player.mesh.traverse(o=>{ if(o.isMesh){ o.material.transparent=false; o.material.opacity=1; } });
  projectiles.forEach(p=>scene.remove(p.mesh)); projectiles.length=0;
  shockwaves.forEach(s=>scene.remove(s.mesh)); shockwaves.length=0;
  pools.forEach(p=>scene.remove(p.mesh)); pools.length=0;
  updateHUD();
}
function tryAttack(heavy){
  if(player.atkT<1||player.rollT>0||player.drinkT>0||player.dead)return;
  // SEKIRO DEATHBLOW: broken boss in range -> instant kill
  if(boss&&boss.broken&&!boss.dead&&dist2D(player.pos,boss.pos)<4.2){ doDeathblow(); return; }
  const cost=heavy?34:20;
  if(player.st<cost){ toast('EXHAUSTED'); tone(150,0.15,'square',0.15); return; }
  player.st-=cost; player.stDelay=0.7; player.heavy=heavy;
  player.atkT=0; player.atkDur=heavy?0.75:0.42; player.didHit=false;
  if(!heavy){ player.combo=(player.comboWin>0)?(player.combo+1)%3:0; player.comboWin=1.2; }
  player.yaw=camYaw; // face away from camera (forward)
  if(lockedOn&&boss&&!boss.dead)player.yaw=angleTo(player.pos,boss.pos);
  heavy?sfx.heavySwing():sfx.swing();
}
function tryRoll(){
  if(player.rollCD>0||player.rollT>0||player.drinkT>0||player.dead)return;
  if(player.st<22){ toast('EXHAUSTED'); return; }
  player.st-=22; player.stDelay=0.6; player.rollT=0.46; player.rollCD=0.15; player.iframes=0.30; player.atkT=1;
  const mv=getMoveDir();
  player.rollDir.copy(mv.lengthSq()>0.01?mv:V3(Math.sin(player.yaw),0,Math.cos(player.yaw)));
  sfx.roll(); burst(player.pos,8,0x999999,2,2,0.4,-4);
}
function tryFlask(){
  if(player.drinkT>0||player.flasks<=0||player.dead||player.hp>=player.maxHp-1)return;
  player.flasks--; player.drinkT=1.15; sfx.heal(); updateHUD();
}
/* ---------- SEKIRO parry / posture / deathblow ---------- */
const PARRY_WINDOW=0.30, PARRY_CD=0.38;
function tryParry(){
  if(state!=='fight'||player.dead||player.parryCD>0||player.rollT>0||player.drinkT>0)return;
  if(player.st<6){ toast('EXHAUSTED'); return; }
  player.st-=6; player.stDelay=Math.max(player.stDelay,0.3);
  player.parryT=PARRY_WINDOW; player.parryCD=PARRY_CD; player.parryFlashed=false;
  // quick guard flash
  burst(V3(player.pos.x+Math.sin(player.yaw)*0.7,1.3,player.pos.z+Math.cos(player.yaw)*0.7),4,0xfff2c9,1.2,1.5,0.25,0);
}
function addBossPosture(amount){
  if(!boss||boss.dead||boss.broken||state!=='fight')return;
  boss.posture=Math.min(boss.postureMax,boss.posture+amount);
  boss.postureTick=2.5;
  updatePostureBar();
  if(boss.posture>=boss.postureMax)breakPosture();
}
function breakPosture(){
  if(!boss||boss.dead||boss.broken)return;
  boss.broken=true; boss.brokenT=5.0; boss.state='broken'; boss.t=5.0;
  boss.posture=boss.postureMax; updatePostureBar();
  telegraphRing.visible=false; telegraphRing2.visible=false; hideMeleeTele();
  // clear saint meteor telegraphs so they don't linger
  if(boss.meteorSpots){ for(const s of boss.meteorSpots)scene.remove(s.r); boss.meteorSpots=null; }
  sfx.roar(); sfx.deflect(); shake(0.4,0.5);
  burst(boss.pos,30,0xffe9a8,4,5,0.8);
  banner('POSTURE BROKEN','#ffd88a');
  $('deathblow').classList.remove('hidden');
  toast('DEATHBLOW! Подойди и нажми LMB / E');
}
function doDeathblow(){
  if(!boss||boss.dead||!boss.broken)return;
  $('deathblow').classList.add('hidden');
  player.yaw=angleTo(player.pos,boss.pos); player.mesh.rotation.y=player.yaw;
  player.atkT=0; player.atkDur=0.6; player.didHit=true; player.heavy=false;
  // dash to boss + red slash
  player.pos.x=boss.pos.x-Math.sin(player.yaw)*1.6; player.pos.z=boss.pos.z-Math.cos(player.yaw)*1.6;
  showSlash(boss.pos,player.yaw,true,0xff2222);
  burst(bossHitPos(),40,0xff2222,5,6,1); burst(bossHitPos(),20,0xffffff,3,4,0.6);
  sfx.deathblow(); shake(0.6,0.8); hitstop(0.25); flashDamage();
  banner('SHINOBI DEATHBLOW','#ff3a3a');
  bossDie(true);
}
function damagePlayer(dmg,fromPos,unblockable=false){
  if(state!=='fight'||player.dead)return;
  if(player.iframes>0){ spawnFloat(player.pos,'DODGED','dodged'); return; }
  const facing=angleTo(player.pos,fromPos||boss.pos);
  const faceOk=Math.abs(angDiff(facing,player.yaw))<1.3;
  // SEKIRO PERFECT PARRY: timed RMB tap, facing the hit, blockable attack
  if(player.parryT>0&&faceOk&&!unblockable&&player.st>0){
    player.parryT=0;
    const heavyHit=dmg>=22;
    addBossPosture(heavyHit?30:24);
    sfx.deflect(); hitstop(0.09); shake(0.18,0.3);
    burst(V3(player.pos.x+Math.sin(player.yaw)*0.8,1.4,player.pos.z+Math.cos(player.yaw)*0.8),18,0xffe9a8,3,4,0.5);
    burst(V3(player.pos.x+Math.sin(player.yaw)*0.8,1.4,player.pos.z+Math.cos(player.yaw)*0.8),8,0xffffff,2,3,0.3);
    spawnFloat(player.pos,'PARRIED!','parried');
    showSlash(player.pos,player.yaw+Math.PI,false,0xffe9a8);
    updateHUD();
    return;
  }
  const blocked=blocking&&!unblockable&&faceOk&&player.st>0;
  if(blocked){
    const sd=dmg*1.6; player.st=Math.max(0,player.st-sd); player.stDelay=0.8;
    dmg=Math.floor(dmg*0.28); sfx.block(); burst(player.pos,10,0xffd88a,3,3,0.4); shake(0.15,0.25);
    addBossPosture(7);
    if(player.st<=0){ toast('GUARD BREAK!'); player.stDelay=1.2; }
  } else {
    shake(0.3,0.5); flashDamage(); burst(player.pos,14,0xcc2211,3,4,0.6);
  }
  player.hp-=dmg; spawnFloat(player.pos,'-'+dmg,'player-dmg'); sfx.hit();
  updateHUD();
  if(player.hp<=0){ player.hp=0; playerDie(); }
}
function playerDie(){
  player.dead=true; sfx.death(); burst(player.pos,30,0x880000,4,5,1);
  setTimeout(()=>{ if(state==='fight'){ state='died'; deaths++; $('death-sub').textContent=`felled by ${BOSS_DEFS[bossIndex].name} · attempt ${deaths+1}`; $('death-screen').classList.remove('hidden'); document.exitPointerLock?.(); } },1100);
}

/* ---------- boss ---------- */
let boss=null, lockedOn=false;
function makeBoss(i){
  if(boss)scene.remove(boss.mesh);
  const def=BOSS_DEFS[i];
  const hpMul=1+ngPlus*0.3, dmgMul=def.dmgMul*(1+ngPlus*0.18);
  const mesh=buildBossMesh(i);
  boss={ kind:i, mesh, pos:V3(0,0,-9), yaw:0, hp:def.hp*hpMul, maxHp:def.hp*hpMul, dmgMul,
    state:'idle', t:1.2, atkName:'', strikeDone:false, secondSwipe:false, strikeN:0, comboLeft:0, dead:false, deathT:0, enraged:false,
    posture:0, postureMax:Math.round(def.posture*(1+ngPlus*0.15)), broken:false, brokenT:0, postureTick:0, meteorSpots:null,
    reactT:0, reactCD:0, guardK:0, stride:0, _dk:0,
    phase:1, speed:def.speed*(1+ngPlus*0.06), target:V3(), teleportCD:6, meteorCD:5, orbCD:4, specialCD:3, flash:0, walkT:0 };
  mesh.position.copy(boss.pos);
  $('boss-name').textContent=def.name;
  $('boss-counter').textContent=['I / III','II / III','III / III'][i];
  $('deathblow').classList.add('hidden');
  scene.fog.color.setHex(def.arena);
  updatePostureBar();
  return boss;
}
function bossTakeDamage(dmg,poise=1){
  if(!boss||boss.dead||state!=='fight')return;
  boss.hp-=dmg; boss.flash=0.12;
  burst(bossHitPos(),10,0xffcc66,3,4,0.5);
  spawnFloat(boss.pos,'-'+dmg,'');
  // hits also build posture (heavy builds more) — Sekiro style
  if(!boss.broken)addBossPosture(player.heavy?10:5);
  // poise break -> visible full-body flinch (blade), brief, never a stunlock
  if(boss.kind===0&&!boss.broken&&boss.reactCD<=0){
    if(Math.random()<poise*0.13){
      boss.reactT=0.32; boss.reactCD=1.5;
      const away=angleTo(player.pos,boss.pos);
      boss.pos.x+=Math.sin(away)*0.3; boss.pos.z+=Math.cos(away)*0.3;
      tone(140,0.18,'sawtooth',0.2,-60); noise(0.1,0.14,500,1500);
    }
  }
  sfx.bossHit(); hitstop(0.05);
  if(boss.hp<=0){ boss.hp=0; bossDie(); }
  updateBossBar();
}
function bossHitPos(){ return V3(boss.pos.x,boss.kind===1?2.2:1.6,boss.pos.z); }
function bossDealMelee(dmg,range=3,arc=1.2){
  const d=dist2D(player.pos,boss.pos);
  if(d>range)return false;
  const want=angleTo(boss.pos,player.pos);
  if(Math.abs(angDiff(want,boss.yaw))>arc && d>1.2)return false;
  damagePlayer(Math.round(dmg*boss.dmgMul),boss.pos); return true;
}
function bossDie(deathblow=false){
  boss.dead=true; boss.deathT=1.8; boss.state='dead'; sfx.death(); sfx.felled();
  $('deathblow').classList.add('hidden');
  hideMeleeTele();
  burst(boss.pos,60,deathblow?0xff2222:0xff8833,6,7,1.2); burst(boss.pos,30,0xffffff,4,5,0.8);
  shake(0.6,0.8); telegraphRing.visible=false; telegraphRing2.visible=false;
  if(boss.meteorSpots){ for(const s of boss.meteorSpots)scene.remove(s.r); boss.meteorSpots=null; }
  setTimeout(()=>{ if(state!=='fight')return; state='felled';
    $('felled-sub').textContent=`${BOSS_DEFS[bossIndex].name} falls${deathblow?' · SHINOBI DEATHBLOW':''} · ${fmtTime(runTime)} · flasks refill at the fog`;
    $('felled-screen').classList.remove('hidden'); document.exitPointerLock?.();
  },1900);
  updateBossBar();
}

/* boss AI — one function per boss, sharing a small state language */
function updateBoss(dt){
  if(!boss) return;
  if(state==='title'||state==='victory'){
    boss.mesh.position.copy(boss.pos);
    boss.mesh.rotation.y+=dt*0.4;
    const u0=boss.mesh.userData; if(u0.core)u0.core.rotation.y+=dt;
    return;
  }
  if(boss.dead){
    boss.deathT-=dt; decayWGlow(dt); hideMeleeTele();
    if(boss.kind===0)poseDeathBlade(1-Math.max(0,boss.deathT)/1.8);
    else { boss.mesh.position.y=-Math.max(0,1.8-boss.deathT)*0.8; boss.mesh.rotation.z+=dt*0.6; }
    return;
  }
  if(boss.reactT>0)boss.reactT-=dt;
  if(boss.reactCD>0)boss.reactCD-=dt;
  // SEKIRO posture decay
  if(state==='fight'&&!boss.broken){
    if(boss.postureTick>0)boss.postureTick-=dt;
    else if(boss.posture>0){ boss.posture=Math.max(0,boss.posture-9*dt); updatePostureBar(); }
  }
  // SEKIRO broken: kneel, wait for deathblow
  if(boss.broken){
    boss.brokenT-=dt; boss.t=Math.max(0,boss.t-dt);
    const u=boss.mesh.userData;
    boss.mesh.rotation.x+=(-0.55-boss.mesh.rotation.x)*Math.min(1,6*dt);
    boss.mesh.position.y+=(-0.55-boss.mesh.position.y)*Math.min(1,6*dt);
    if(u.armR){ u.armR.rotation.x+=(0.9-u.armR.rotation.x)*Math.min(1,6*dt); }
    if(u.armL){ u.armL.rotation.x+=(0.9-u.armL.rotation.x)*Math.min(1,6*dt); }
    if(boss.brokenT<=0){ boss.broken=false; boss.posture=0; updatePostureBar(); $('deathblow').classList.add('hidden'); boss.state='recover'; boss.t=1.0; boss.mesh.rotation.x=0; toast('boss recovers posture…'); }
    else if(Math.random()<dt*10)burst(boss.pos,1,0xffe9a8,1.5,2,0.4,0);
    return;
  }
  const def=BOSS_DEFS[bossIndex];
  boss.phase=(boss.hp<boss.maxHp*(boss.kind===2?0.6:0.5))?2:1;
  if(boss.phase===2&&!boss.enraged){ boss.enraged=true; sfx.roar(); burst(boss.pos,30,0xff2222,4,6,0.8); banner(boss.kind===0?'THE BLADE QUICKENS':boss.kind===1?'THE SLAG AWAKENS':'THE CHOIR SCREAMS','#ff5a3c'); }
  const d=dist2D(player.pos,boss.pos);
  const faceP=(rate=10)=>{ const w=angleTo(boss.pos,player.pos); boss.yaw+=angDiff(w,boss.yaw)*Math.min(1,rate*dt); };
  const step=(tx,tz,sp)=>{ const dx=tx-boss.pos.x,dz=tz-boss.pos.z; const l=Math.hypot(dx,dz)||1; boss.pos.x+=dx/l*sp*dt; boss.pos.z+=dz/l*sp*dt; };
  boss.t-=dt;
  const spdMul=boss.phase===2?1.35:1;
  boss.mesh.position.copy(boss.pos);
  boss.mesh.rotation.y=boss.yaw;
  // walk bob
  boss.walkT+=dt*(boss.state==='chase'?8:2);
  const u=boss.mesh.userData;
  if(u.legL)u.legL.rotation.x=Math.sin(boss.walkT)*(boss.state==='chase'?0.6:0.1);
  if(u.legR)u.legR.rotation.x=-Math.sin(boss.walkT)*(boss.state==='chase'?0.6:0.1);
  if(u.orb)u.orb.position.y=1.45+Math.sin(performance.now()*0.004)*0.1;
  if(u.halo)u.halo.rotation.z+=dt*1.5;
  if(u.cape)u.cape.rotation.x=Math.sin(performance.now()*0.002)*0.12;

  if(boss.kind===0)aiBlade(dt,d,faceP,step,spdMul);
  else if(boss.kind===1)aiGolem(dt,d,faceP,step,spdMul);
  else aiSaint(dt,d,faceP,step,spdMul);
  // hit-reaction overlay (blade): full-torso flinch decaying over the AI pose
  if(boss.kind===0&&boss.reactT>0&&!boss.broken){
    const k=Math.max(0,boss.reactT)/0.32, u=boss.mesh.userData;
    if(u.torso)u.torso.rotation.x+=-0.5*k;
    if(u.neck)u.neck.rotation.x+=0.45*k;
    if(u.armR)u.armR.rotation.x+=-0.6*k;
    if(u.armL)u.armL.rotation.z+=-0.5*k;
    if(u.handR)u.handR.rotation.x+=0.4*k;
    boss.mesh.position.y+=0.12*k;
  }
}
function setAtk(name,windup){ boss.state='windup'; boss.atkName=name; boss.t=windup; boss.windupTotal=windup; boss.strikeDone=false; boss.secondSwipe=false; boss.strikeN=0; boss.teleShown=false; boss.swingAlt=(boss.swingAlt||0); boss.drew=false; boss.chanted=false; if(boss.kind===0)boss.from=captureBladePose(); sfx.kiai(); hideMeleeTele(); }
/* Snapshot current blade joints so windups blend from any pose — zero pops */
function captureBladePose(){
  const u=boss.mesh.userData, g=(o)=>o?o.rotation.x:0, gz=(o)=>o?o.rotation.z:0;
  return { arx:g(u.armR), arz:gz(u.armR), ary:u.armR?u.armR.rotation.y:0,
    alx:g(u.armL), alz:gz(u.armL), aly:u.armL?u.armL.rotation.y:0,
    erx:g(u.elbR), elx:g(u.elbL), wrx:u.handR?u.handR.rotation.x:0.85,
    try_:u.torso?u.torso.rotation.y:0, trx:u.torso?u.torso.rotation.x:0,
    nex:u.neck?u.neck.rotation.x:0, lrx:g(u.legR), llx:g(u.legL),
    krx:g(u.kneeR), klx:g(u.kneeL),
    mrx:boss.mesh.rotation.x, mry:boss.mesh.rotation.y-boss.yaw, mrz:boss.mesh.rotation.z,
    mpy:boss.mesh.position.y };
}
/* Ease boss limbs back to neutral (called in idle/chase/recover) */
function easeBossPose(dt,rate=8){
  const u=boss.mesh.userData; const k=Math.min(1,rate*dt); const r=u.rest||{};
  if(u.armR){ u.armR.rotation.x+=(0-u.armR.rotation.x)*k; u.armR.rotation.z+=(0-u.armR.rotation.z)*k; u.armR.rotation.y+=(0-u.armR.rotation.y)*k; if(r.armRy!==undefined)u.armR.position.y+=(r.armRy-u.armR.position.y)*k; }
  if(u.armL){ u.armL.rotation.x+=(0-u.armL.rotation.x)*k; u.armL.rotation.z+=(0-u.armL.rotation.z)*k; u.armL.rotation.y+=(0-u.armL.rotation.y)*k; }
  if(u.legL){ u.legL.rotation.x+=(0-u.legL.rotation.x)*k; }
  if(u.legR){ u.legR.rotation.x+=(0-u.legR.rotation.x)*k; }
  if(u.fistL&&r.fistLy!==undefined){ u.fistL.position.y+=(r.fistLy-u.fistL.position.y)*k; }
  if(u.fistR&&r.fistRy!==undefined){ u.fistR.position.y+=(r.fistRy-u.fistR.position.y)*k; }
  if(u.sword&&r.swx!==undefined){ u.sword.position.x+=(r.swx-u.sword.position.x)*k; u.sword.position.y+=(r.swy-u.sword.position.y)*k; u.sword.position.z+=(r.swz-u.sword.position.z)*k; u.sword.rotation.z+=(0-u.sword.rotation.z)*k; u.sword.rotation.x+=((r.swrx||0)-u.sword.rotation.x)*k; }
  if(u.orb){ const s=u.orb.scale.x; if(s>1)u.orb.scale.setScalar(Math.max(1,s-2.5*dt)); }
  if(u.core){ const s=u.core.scale.x; if(s>1)u.core.scale.setScalar(Math.max(1,s-2.0*dt)); }
  if(u.torso){ u.torso.rotation.y+=(0-u.torso.rotation.y)*k; u.torso.rotation.x+=(0-u.torso.rotation.x)*k; }
  if(u.elbR){ u.elbR.rotation.x+=(0-u.elbR.rotation.x)*k; u.elbR.rotation.z+=(0-u.elbR.rotation.z)*k; }
  if(u.elbL){ u.elbL.rotation.x+=(0-u.elbL.rotation.x)*k; u.elbL.rotation.z+=(0-u.elbL.rotation.z)*k; }
  if(u.kneeL){ u.kneeL.rotation.x+=(0-u.kneeL.rotation.x)*k; }
  if(u.kneeR){ u.kneeR.rotation.x+=(0-u.kneeR.rotation.x)*k; }
  if(u.handR){ u.handR.rotation.x+=((u.wristRest||0)-u.handR.rotation.x)*k; u.handR.rotation.z+=(0-u.handR.rotation.z)*k; }
  if(u.handL){ u.handL.rotation.x+=(0-u.handL.rotation.x)*k; u.handL.rotation.z+=(0-u.handL.rotation.z)*k; }
  if(u.neck){ u.neck.rotation.x+=(0-u.neck.rotation.x)*k; u.neck.rotation.y+=(0-u.neck.rotation.y)*k; }
  boss.mesh.rotation.x+=(0-boss.mesh.rotation.x)*k;
  boss.mesh.rotation.z+=(0-boss.mesh.rotation.z)*k;
  if(boss.kind!==2)boss.mesh.position.y+=(0-boss.mesh.position.y)*k;
  decayWGlow(dt);
}
function windupP(){ return clamp(1-(boss.t/(boss.windupTotal||0.6)),0,1); }
/* Staged blade death: stagger -> buckle to the knees -> collapse face-down */
function poseDeathBlade(k){
  const B=boss, u=B.mesh.userData;
  const e1=1-Math.pow(1-Math.min(1,k/0.28),3);
  const e2=clamp((k-0.28)/0.32,0,1), e2s=e2*e2;
  const e3=clamp((k-0.6)/0.4,0,1), e3s=e3*e3;
  if(B._dk<1&&k>=0.3){ B._dk=1; burst(B.pos,16,0x6a6a72,3,2,0.6); shake(0.2,0.3); sfx.step(); }
  if(B._dk<2&&k>=0.62){ B._dk=2; burst(B.pos,26,0x6a6a72,4,3,0.8); burst(B.pos,10,0x880000,3,3,0.7); shake(0.4,0.5); sfx.hit(); }
  B.mesh.position.copy(B.pos);
  B.mesh.position.y+=0.12*e1-0.55*e2s-0.35*e3s;
  B.mesh.rotation.y=B.yaw; B.mesh.rotation.x=-0.1*e1+0.1*e2s; B.mesh.rotation.z=0;
  if(u.torso){ u.torso.rotation.x=-0.55*e1+1.1*e2s+0.6*e3s; u.torso.rotation.y=0; }
  if(u.neck){ u.neck.rotation.x=0.45*e1-0.2*e2s-0.5*e3s; u.neck.rotation.y=0; }
  const sprawl=e3s;
  if(u.armR){ u.armR.rotation.x=-0.3*e1+0.5*e2s+0.4*sprawl; u.armR.rotation.z=(0.3+0.9*e1)*(1-e2s)+1.4*sprawl; }
  if(u.armL){ u.armL.rotation.x=-0.3*e1+0.5*e2s+0.4*sprawl; u.armL.rotation.z=(-0.3-0.9*e1)*(1-e2s)-1.4*sprawl; }
  if(u.elbR)u.elbR.rotation.x=-0.3-0.2*e2s;
  if(u.elbL)u.elbL.rotation.x=-0.3-0.2*e2s;
  if(u.handR)u.handR.rotation.x=0.85-0.5*e2s;
  if(u.legL){ u.legL.rotation.x=-1.1*e2s+1.45*e2s*e3; }
  if(u.legR){ u.legR.rotation.x=-1.1*e2s+1.45*e2s*e3; }
  if(u.kneeL)u.kneeL.rotation.x=1.9*e2s-1.65*e2s*e3;
  if(u.kneeR)u.kneeR.rotation.x=1.9*e2s-1.65*e2s*e3;
  if(u.cape)u.cape.rotation.x=0.15+0.5*e3s;
}
function aiBlade(dt,d,faceP,step,spdMul){
  const B=boss;
  switch(B.state){
    case 'idle':
      faceP(6); easeBossPose(dt,6);
      { // breathing stance: chest rises, head settles, blade tip sways
        const u=B.mesh.userData, br=Math.sin(performance.now()*0.0022);
        if(u.torso)u.torso.rotation.x+=((0.04+0.025*br)-u.torso.rotation.x)*Math.min(1,4*dt);
        if(u.neck)u.neck.rotation.x+=((0.08)-u.neck.rotation.x)*Math.min(1,4*dt);
      }
      if(B.t<=0){ B.state='chase'; B.t=rand(0.1,0.3); B.stride=0;} break;
    case 'chase': {
      faceP(8); step(player.pos.x,player.pos.z,B.speed*spdMul); easeBossPose(dt,6);
      const u=B.mesh.userData;
      // guard blend 0 (far, sword dragged) -> 1 (engaged, sword leveled)
      B.guardK+=(((d<7)?1:0)-B.guardK)*Math.min(1,5*dt);
      const gk=B.guardK*B.guardK*(3-2*B.guardK), ik=1-gk;
      // stalking walk: hips roll, knees flex, off-arm counter-swings (after ease)
      B.stride=Math.min(1,B.stride+2.5*dt);
      const sw=Math.sin(B.walkT), st=B.stride;
      if(u.legL)u.legL.rotation.x=sw*0.55*st;
      if(u.legR)u.legR.rotation.x=-sw*0.55*st;
      if(u.kneeL)u.kneeL.rotation.x=(0.25+0.5*Math.max(0,Math.sin(B.walkT+2.1)))*st;
      if(u.kneeR)u.kneeR.rotation.x=(0.25+0.5*Math.max(0,Math.sin(B.walkT+Math.PI+2.1)))*st;
      if(u.torso)u.torso.rotation.y=0.07*Math.sin(B.walkT*0.5)*st;
      // sword arm: hip-drag rest -> leveled guard tracking the player
      if(u.armR){ u.armR.rotation.x+=((-0.9)*gk-u.armR.rotation.x)*Math.min(1,8*dt); u.armR.rotation.z+=((0.15)*gk-u.armR.rotation.z)*Math.min(1,8*dt); }
      if(u.elbR){ u.elbR.rotation.x+=((-0.15-0.4*gk)-u.elbR.rotation.x)*Math.min(1,8*dt); }
      if(u.handR){ u.handR.rotation.x+=((0.85-2.0*gk)-u.handR.rotation.x)*Math.min(1,8*dt); }
      if(u.armL){ u.armL.rotation.x+=((-0.45)*gk-u.armL.rotation.x)*Math.min(1,8*dt); u.armL.rotation.z+=((-0.35)*gk-u.armL.rotation.z)*Math.min(1,8*dt); }
      if(u.elbL){ u.elbL.rotation.x+=((-0.7)*gk-u.elbL.rotation.x)*Math.min(1,8*dt); }
      if(u.torso)u.torso.rotation.x+=((0.1*gk)-u.torso.rotation.x)*Math.min(1,6*dt);
      if(u.neck)u.neck.rotation.x+=((0.12*gk)-u.neck.rotation.x)*Math.min(1,6*dt);
      B.mesh.rotation.x+=(0.08*gk-B.mesh.rotation.x)*Math.min(1,6*dt);
      // crouch combines guard sink + walk bounce in one target (no fighting)
      B.mesh.position.y+=((-0.1*gk+Math.abs(Math.sin(B.walkT))*0.05*st)-B.mesh.position.y)*Math.min(1,6*dt);
      if(Math.random()<dt*8)burst(B.pos,1,0xff2211,1,2,0.4);
      if(d<2.9){ Math.random()<0.6?setAtk('combo',0.55):setAtk('slam',0.7); }
      else if(d<8&&B.specialCD<=0&&Math.random()<0.02){ setAtk('jump',0.6); B.specialCD=5; }
      else if(d>=8){ setAtk('dash',0.45); }
      else if(B.t<=0){ B.state='idle'; B.t=rand(0.2,0.5); }
      B.specialCD-=dt; break; }
    case 'windup': {
      faceP(3);
      const p=windupP(), u=B.mesh.userData;
      // blend from the snapshot pose over the first 40%: attacks flow out of
      // guard/walk/previous-recover with zero pops, whatever came before
      const F=B.from||{};
      const b=1-Math.pow(1-Math.min(1,p*2.5),3);
      const L=(f,t)=>f+(t-f)*b;
      const Fv=(k,dflt)=>((F[k]===undefined)?dflt:F[k]);
      B.mesh.position.y=-0.24*p;
      setWGlow(u,p,0xff3322);
      if(!B.teleShown){
        B.teleShown=true;
        if(B.atkName==='combo')showMeleeTele(B.pos,B.yaw,3.8,115);
        else if(B.atkName==='slam')showMeleeTele(B.pos,B.yaw,4.6,95);
        else if(B.atkName==='jump')showMeleeTele(B.pos,B.yaw,5.2,85);
      } else if(teleArc.visible){ teleArc.position.set(B.pos.x,0.06,B.pos.z); teleArc.rotation.y=B.yaw; }
      if(B.atkName==='combo'){
        // REF panel 2 (ЗАМАХ): blade drawn BACK to the side — horizontal, tip
        // behind; shoulder leads, elbow unfolds, wrist cocks; torso coils away,
        // weight sinks onto the back leg, head steady on the player
        if(u.armR){ u.armR.rotation.x=L(Fv('arx',-0.9),-0.9+0.55*p); u.armR.rotation.z=L(Fv('arz',0.15),0.15+1.35*p); u.armR.rotation.y=L(0,-0.55*p); }
        if(u.elbR)u.elbR.rotation.x=L(Fv('erx',-0.55),-0.55+0.3*p);
        if(u.handR)u.handR.rotation.x=L(Fv('wrx',-1.15),-1.15+0.45*p);
        if(u.armL){ u.armL.rotation.x=L(Fv('alx',-0.45),-0.45-0.05*p); u.armL.rotation.z=L(Fv('alz',-0.35),-0.35-0.1*p); }
        if(u.elbL)u.elbL.rotation.x=L(Fv('elx',-0.7),-0.7+0.2*p);
        if(u.torso){ u.torso.rotation.y=L(Fv('try_',0),-0.65*p); u.torso.rotation.x=L(Fv('trx',0.1),0.1+0.12*p); }
        if(u.neck)u.neck.rotation.x=L(Fv('nex',0.12),0.12-0.07*p);
        if(u.legR){ u.legR.rotation.x=L(Fv('lrx',0),0.55*p); }
        if(u.legL){ u.legL.rotation.x=L(Fv('llx',0),-0.35*p); }
        if(u.kneeR)u.kneeR.rotation.x=L(Fv('krx',0),0.3*p);
        if(u.kneeL)u.kneeL.rotation.x=L(Fv('klx',0),0.15*p);
        B.mesh.rotation.y=B.yaw+L(Fv('mry',0),-0.15*p-0.5*p);
        B.mesh.rotation.x=L(Fv('mrx',0.08),0.08+0.14*p);
        B.mesh.rotation.z=L(Fv('mrz',0),-0.08*p);
        B.mesh.position.y=L(Fv('mpy',-0.1),-0.1-0.04*p);
      } else if(B.atkName==='slam'){
        // crushing overhead hauled up from the guard
        if(u.armR){ u.armR.rotation.x=L(Fv('arx',-0.9),-0.9-1.5*p); u.armR.rotation.z=L(Fv('arz',0.15),0.15+0.15*p); }
        if(u.elbR)u.elbR.rotation.x=L(Fv('erx',-0.55),-0.55+0.25*p);
        if(u.handR)u.handR.rotation.x=L(Fv('wrx',-1.15),-1.15-1.15*p);
        if(u.armL){ u.armL.rotation.x=L(Fv('alx',-0.45),-0.45-0.35*p); u.armL.rotation.z=L(Fv('alz',-0.35),-0.35-0.05*p); }
        if(u.elbL)u.elbL.rotation.x=L(Fv('elx',-0.7),-0.7+0.3*p);
        if(u.torso){ u.torso.rotation.y=L(Fv('try_',0),-0.3*p); u.torso.rotation.x=L(Fv('trx',0.1),0.1+0.15*p); }
        if(u.neck)u.neck.rotation.x=L(Fv('nex',0.12),0.12-0.25*p);
        if(u.legR){ u.legR.rotation.x=L(Fv('lrx',0),0.4*p); }
        if(u.legL){ u.legL.rotation.x=L(Fv('llx',0),-0.25*p); }
        if(u.kneeR)u.kneeR.rotation.x=L(Fv('krx',0),0.2*p);
        B.mesh.rotation.y=B.yaw+L(Fv('mry',0),-0.3*p);
        B.mesh.rotation.x=L(Fv('mrx',0.08),0.08+0.1*p);
        B.mesh.position.y=L(Fv('mpy',-0.1),-0.1-0.1*p);
      } else if(B.atkName==='dash'){
        // sprinter coil: sword drops low behind, legs scissor for the launch
        if(u.armR){ u.armR.rotation.x=L(Fv('arx',0),0.6*p); u.armR.rotation.z=L(Fv('arz',0),0.3*p); }
        if(u.elbR)u.elbR.rotation.x=L(Fv('erx',-0.15),-0.15-0.05*p);
        if(u.handR)u.handR.rotation.x=L(Fv('wrx',0.85),0.85-0.65*p);
        if(u.armL){ u.armL.rotation.x=L(Fv('alx',0),-1.1*p); u.armL.rotation.z=L(Fv('alz',0),-0.2*p); }
        if(u.elbL)u.elbL.rotation.x=L(Fv('elx',0),-0.9*p);
        if(u.torso){ u.torso.rotation.y=L(Fv('try_',0),-0.15*p); u.torso.rotation.x=L(Fv('trx',0),-0.1*p); }
        if(u.legR){ u.legR.rotation.x=L(Fv('lrx',0),0.7*p); }
        if(u.legL){ u.legL.rotation.x=L(Fv('llx',0),-0.7*p); }
        if(u.kneeR)u.kneeR.rotation.x=L(Fv('krx',0),0.4*p);
        if(u.kneeL)u.kneeL.rotation.x=L(Fv('klx',0),0.9*p);
        B.mesh.rotation.y=B.yaw+L(Fv('mry',0),-0.15*p);
        B.mesh.rotation.x=L(Fv('mrx',0),0.22*p);
        B.mesh.position.y=L(Fv('mpy',0),-0.4*p);
      } else if(B.atkName==='jump'){
        // deep squat, blade hauled overhead with both hands helping
        if(u.armR){ u.armR.rotation.x=L(Fv('arx',-0.9),-0.9-1.3*p); u.armR.rotation.z=L(Fv('arz',0.15),0.15+0.1*p); }
        if(u.elbR)u.elbR.rotation.x=L(Fv('erx',-0.55),-0.55+0.15*p);
        if(u.handR)u.handR.rotation.x=L(Fv('wrx',-1.15),-1.15-1.0*p);
        if(u.armL){ u.armL.rotation.x=L(Fv('alx',-0.45),-0.45-1.35*p); }
        if(u.elbL)u.elbL.rotation.x=L(Fv('elx',-0.7),-0.7+0.4*p);
        if(u.torso){ u.torso.rotation.x=L(Fv('trx',0.1),0.1+0.1*p); }
        if(u.legR){ u.legR.rotation.x=L(Fv('lrx',0),-0.9*p); }
        if(u.legL){ u.legL.rotation.x=L(Fv('llx',0),-0.9*p); }
        if(u.kneeR)u.kneeR.rotation.x=L(Fv('krx',0),1.6*p);
        if(u.kneeL)u.kneeL.rotation.x=L(Fv('klx',0),1.6*p);
        B.mesh.rotation.x=L(Fv('mrx',0),0.1*p);
        B.mesh.position.y=L(Fv('mpy',0),-0.55*p);
      }
      if(Math.random()<dt*20)burst(V3(B.pos.x,2.5,B.pos.z),1,0xff2211,1,2,0.3,0);
      if(B.t<=0){ hideMeleeTele(); B.state='strike'; B.t=B.atkName==='combo'?0.55:0.45;
        setWGlow(u,1.5,0xff5533);
        if(B.atkName==='combo'){B.comboLeft=B.phase===2?3:2; B.swingAlt=0;}
        if(B.atkName==='dash'){ const w=angleTo(B.pos,player.pos); B.dashDir={x:Math.sin(w),z:Math.cos(w)}; sfx.heavySwing(); }
        if(B.atkName==='jump'){ B.jumpT=0.55; sfx.roar(); }
      } break; }
    case 'strike': {
      const u=B.mesh.userData;
      if(B.atkName==='combo'){
        // REF: horizontal cut left-right — SNAP (hips+shoulders whip + step),
        // CONTACT mid-sweep, FOLLOW-THROUGH hold, SETTLE recoil. Alternates sides.
        const dir=(B.swingAlt%2===0)?1:-1;
        const final=(B.comboLeft===0);
        const q=1-Math.max(0,B.t)/0.42;
        const easeOut=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
        if(!final){
          const snap=easeOut(q/0.4);            // violent uncoil, first 40%
          const sweep=easeOut(q/0.55);          // blade travel across
          const settle=clamp((q-0.8)/0.2,0,1);  // 25% recoil toward next coil
          // chained cuts begin where the previous one ended (first: windup coil)
          const startY=dir===1?-0.65:0.75, endY=0.75*dir;
          const startAZ=dir===1?1.5:-1.6, endAZ=-1.6*dir;
          const startSY=dir===1?-0.55:0.45, endSY=0.45*dir;
          const startWX=first?-0.7:-0.8;
          const startTY=dir===1?-0.65:0.35, endTY=dir===1?0.35:-0.65;
          const yawQ=startY+(endY-startY)*snap;
          // kinetic chain: hips -> torso -> shoulder -> elbow -> wrist snap.
          // small constant-amplitude pumps: no drift, no pops at any chain link
          const qm=Math.min(1,q), swn=Math.sin(qm*Math.PI);
          if(u.armR){ u.armR.rotation.x=-0.25+0.12*swn-0.1*snap; u.armR.rotation.z=startAZ+(endAZ-startAZ)*sweep; u.armR.rotation.y=startSY+(endSY-startSY)*sweep; }
          if(u.elbR)u.elbR.rotation.x=-0.2+0.1*swn;
          const wsnap=easeOut((q-0.4)/0.15); // wrist cracks just after shoulders
          if(u.handR)u.handR.rotation.x=startWX+(-1.05-startWX)*wsnap+0.25*settle;
          if(u.armL){ u.armL.rotation.x=-0.35+0.15*swn-0.1*snap; u.armL.rotation.z=-0.5-0.15*swn; }
          if(u.elbL)u.elbL.rotation.x=-0.55+0.15*swn;
          if(u.torso){ u.torso.rotation.y=startTY+(endTY-startTY)*snap; u.torso.rotation.x=(first?0.22:0.0)+(-0.0-(first?0.22:0.0))*snap-0.15*swn; }
          if(u.neck)u.neck.rotation.x=0.07+0.03*swn;
          if(first){ // driving step plants once per combo; then we walk him down
            if(u.legR){ u.legR.rotation.x=0.55-1.1*snap; }
            if(u.legL){ u.legL.rotation.x=-0.35+0.75*snap; }
            if(u.kneeR)u.kneeR.rotation.x=0.3+0.25*snap;
            if(u.kneeL)u.kneeL.rotation.x=0.15+0.05*snap;
          }
          B.mesh.rotation.y=B.yaw+yawQ;
          B.mesh.rotation.x=(first?0.22:-0.05)+(-0.05-(first?0.22:-0.05))*snap+0.06*swn;
          B.mesh.rotation.z=(first?-0.08:0.0)+(0.0-(first?-0.08:0.0))*snap;
          const stepV=7*(1-q)+1.5;
          B.pos.x+=Math.sin(B.yaw)*stepV*dt; B.pos.z+=Math.cos(B.yaw)*stepV*dt;
          B.mesh.position.copy(B.pos);
          B.mesh.position.y+=((first?-0.14:-0.06))+(-0.06-(first?-0.14:-0.06))*snap+0.05*swn;
          burst(V3(B.pos.x-Math.sin(B.yaw)*0.5,0.15,B.pos.z-Math.cos(B.yaw)*0.5),1,0x8a7a66,1.5,1,0.3);
        } else {
          // FINAL: gather from wherever the last cut ended (snapshot blend),
          // then a leaping overhead chop — hop masks the transition
          const F2=B.from2||{};
          const g=easeOut(Math.min(1,q/0.3));
          const c=easeOut(clamp((q-0.3)/0.7,0,1));
          const Q=(fk,load,chop)=>{ const f=(F2[fk]===undefined?load:F2[fk]); const l=f+(load-f)*g; return l+(chop-l)*c; };
          if(u.armR){ u.armR.rotation.x=Q('arx',-2.6,1.3); u.armR.rotation.z=Q('arz',0,0); u.armR.rotation.y=Q('ary',0,0); }
          if(u.elbR)u.elbR.rotation.x=Q('erx',-0.4,-0.05);
          if(u.handR)u.handR.rotation.x=Q('wrx',-2.2,-1.0);
          if(u.armL){ u.armL.rotation.x=Q('alx',-1.2,-0.2); u.armL.rotation.z=Q('alz',0,-0.3); }
          if(u.elbL)u.elbL.rotation.x=Q('elx',-0.8,-0.3);
          if(u.torso){ u.torso.rotation.y=Q('try_',0,0); u.torso.rotation.x=Q('trx',0.3,-0.5); }
          if(u.neck)u.neck.rotation.x=Q('nex',-0.1,0.2);
          B.mesh.rotation.y=B.yaw+Q('mry',0,0);
          B.mesh.rotation.x=Q('mrx',0,-0.15);
          B.mesh.rotation.z=Q('mrz',0,0);
          B.pos.x+=Math.sin(B.yaw)*4.5*dt; B.pos.z+=Math.cos(B.yaw)*4.5*dt;
          B.mesh.position.copy(B.pos);
          B.mesh.position.y+=Q('mpy',-0.2,0)+Math.sin(Math.min(1,q)*Math.PI)*0.7;
        }
        if(!B.strikeDone&&q>0.5){
          B.strikeDone=true;
          showSlash(B.pos,B.yaw+(final?0:dir*0.5),final,final?0xff4422:0xff6655);
          final?sfx.heavySwing():sfx.swing();
          bossDealMelee(final?24:(B.phase===2?19:16),final?4.0:3.4,1.35); shake(final?0.32:0.15,final?0.55:0.3);
          burst(bossHitPos(),final?16:8,0xff5533,3,4,0.5);
          if(final)spawnShockwave(B.pos,{maxR:4,speed:8,dmg:10});
        }
        if(B.t<=0){ if(B.comboLeft>0){ B.comboLeft--; if(B.comboLeft===0)B.from2=captureBladePose(); B.swingAlt++; B.strikeDone=false; B.t=0.42; faceP(10); } else { B.state='recover'; B.t=B.phase===2?0.4:0.55; } }
      } else if(B.atkName==='dash'){
        // rising slash out of the sprint: blade whips up at arrival
        const q=1-Math.max(0,B.t)/0.45;
        B.pos.x+=B.dashDir.x*24*dt; B.pos.z+=B.dashDir.z*24*dt;
        burst(B.pos,3,0xff2211,2,2,0.3); burst(V3(B.pos.x,0.2,B.pos.z),2,0xffcc66,2,1,0.3,-2);
        if(u.armR){ u.armR.rotation.x=0.6-q*2.4; u.armR.rotation.z=0.3-q*0.6; }
        if(u.elbR)u.elbR.rotation.x=-0.2+0.05*q;
        if(u.handR)u.handR.rotation.x=0.2-q*1.6;
        if(u.armL){ u.armL.rotation.x=-1.1+0.7*q; u.armL.rotation.z=-0.2+0.1*q; }
        if(u.torso){ u.torso.rotation.y=-0.15+0.45*q; u.torso.rotation.x=-0.1-0.1*q; }
        if(u.neck)u.neck.rotation.x=0.1*q;
        if(u.legR){ u.legR.rotation.x=0.7-1.3*q; }
        if(u.legL){ u.legL.rotation.x=-0.7+1.2*q; }
        if(u.kneeR)u.kneeR.rotation.x=0.4-0.2*q;
        if(u.kneeL)u.kneeL.rotation.x=0.9-0.5*q;
        B.mesh.rotation.y=B.yaw-0.15+0.15*q;
        B.mesh.rotation.x=0.22-0.37*q; B.mesh.position.y=-0.4+0.4*q;
        faceP(2);
        if(!B.strikeDone&&dist2D(player.pos,B.pos)<2.6){ B.strikeDone=true; bossDealMelee(22,3.2,2); showSlash(B.pos,B.yaw,true,0xff4422); burst(bossHitPos(),14,0xff5533,3,4,0.5); shake(0.3,0.5); }
        if(B.t<=0){ B.state='recover'; B.t=0.6; }
      } else if(B.atkName==='jump'){
        // death from above: tucked ball (blade held high), then full-body slam
        B.jumpT-=dt;
        const air=Math.sin((0.55-B.jumpT)/0.55*Math.PI);
        if(u.armR){ u.armR.rotation.x=-2.2; u.armR.rotation.z=0.25; }
        if(u.elbR)u.elbR.rotation.x=-0.4;
        if(u.handR)u.handR.rotation.x=-2.15;
        if(u.armL){ u.armL.rotation.x=-1.8; }
        if(u.elbL)u.elbL.rotation.x=-0.3;
        if(u.torso){ u.torso.rotation.x=0.2-0.1*air; }
        if(u.legR){ u.legR.rotation.x=-0.9+0.9*air; }
        if(u.legL){ u.legL.rotation.x=-0.9+0.9*air; }
        if(u.kneeR)u.kneeR.rotation.x=1.6-0.6*air;
        if(u.kneeL)u.kneeL.rotation.x=1.6-0.6*air;
        B.mesh.rotation.x=0.1-0.4*air;
        const w=angleTo(B.pos,player.pos); if(B.jumpT>0.25){ B.pos.x+=Math.sin(w)*9*dt; B.pos.z+=Math.cos(w)*9*dt; }
        B.mesh.position.copy(B.pos); B.mesh.position.y+=air*4.5;
        if(B.jumpT<=0){
          B.mesh.position.copy(B.pos);
          // impact frame: whole body crashes down behind the blade (shake masks it)
          if(u.armR){ u.armR.rotation.x=1.3; u.armR.rotation.z=0; }
          if(u.elbR)u.elbR.rotation.x=-0.05;
          if(u.handR)u.handR.rotation.x=-1.0;
          if(u.armL){ u.armL.rotation.x=1.3; u.armL.rotation.z=0; }
          if(u.elbL)u.elbL.rotation.x=-0.2;
          if(u.torso){ u.torso.rotation.x=-0.5; u.torso.rotation.y=0; }
          if(u.neck)u.neck.rotation.x=0.25;
          if(u.legR){ u.legR.rotation.x=-0.2; } if(u.legL){ u.legL.rotation.x=-0.2; }
          if(u.kneeR)u.kneeR.rotation.x=0.7; if(u.kneeL)u.kneeL.rotation.x=0.7;
          B.mesh.rotation.x=-0.25; B.mesh.rotation.y=B.yaw;
          showSlash(B.pos,B.yaw,true,0xff4422);
          spawnShockwave(B.pos,{maxR:6.5,speed:10,dmg:18}); burst(B.pos,26,0xff6622,5,6,0.8); shake(0.45,0.65); sfx.hit();
          setWGlow(u,1.2,0xff5533);
          B.state='recover'; B.t=0.9;
        }
      } else if(B.atkName==='slam'){
        // standing overhead crush: hips drop, spine folds over the impact
        const q=1-Math.max(0,B.t)/0.45;
        if(u.armR){ u.armR.rotation.x=-2.4+q*3.7; u.armR.rotation.z=0.3-0.3*q; }
        if(u.elbR)u.elbR.rotation.x=-0.3+0.25*q;
        if(u.handR)u.handR.rotation.x=-2.3+q*1.3;
        if(u.armL){ u.armL.rotation.x=-0.8+q*1.1; u.armL.rotation.z=-0.4+0.2*q; }
        if(u.elbL)u.elbL.rotation.x=-0.4+0.2*q;
        if(u.torso){ u.torso.rotation.y=-0.3+0.3*q; u.torso.rotation.x=0.25-0.75*q; }
        if(u.neck)u.neck.rotation.x=-0.13+0.33*q;
        if(u.legR){ u.legR.rotation.x=0.4-0.8*q; }
        if(u.legL){ u.legL.rotation.x=-0.25+0.55*q; }
        if(u.kneeR)u.kneeR.rotation.x=0.2+0.4*q;
        if(u.kneeL)u.kneeL.rotation.x=0.1+0.3*q;
        B.mesh.rotation.y=B.yaw-0.3+0.3*q;
        B.mesh.rotation.x=0.18-0.48*q;
        B.mesh.position.y=-0.2+Math.sin(Math.min(1,q)*Math.PI)*0.3;
        if(!B.strikeDone&&q>0.55){ B.strikeDone=true; showSlash(B.pos,B.yaw,true,0xff4422); sfx.heavySwing(); bossDealMelee(24,4.0,1.4); spawnShockwave(B.pos,{maxR:5,speed:8,dmg:12}); shake(0.35,0.55); burst(bossHitPos(),16,0xff6622,4,5,0.7); }
        if(B.t<=0){ B.state='recover'; B.t=0.7; }
      }
      break; }
    case 'recover': faceP(4); easeBossPose(dt,5); if(B.t<=0){ B.state='idle'; B.t=rand(0.25,B.phase===2?0.4:0.7); } break;
  }
}
function aiGolem(dt,d,faceP,step,spdMul){
  const B=boss;
  const showTele=(r,dur)=>{ telegraphRing.scale.setScalar(r/4.5); telegraphRing.position.set(B.pos.x,0.05,B.pos.z); telegraphRing.visible=true; };
  switch(B.state){
    case 'idle': faceP(3); easeBossPose(dt,5); if(B.t<=0){B.state='chase';B.t=1;} break;
    case 'chase':
      faceP(4); step(player.pos.x,player.pos.z,B.speed*spdMul); easeBossPose(dt,5);
      // ponderous arm-sway while marching: fists swing like wrecking balls
      { const u=B.mesh.userData, sw2=Math.sin(B.walkT*0.5);
        if(u.armR){ u.armR.rotation.x+=(-0.25*sw2-u.armR.rotation.x)*Math.min(1,6*dt); u.armR.rotation.z+=(0.3-u.armR.rotation.z)*Math.min(1,6*dt); }
        if(u.armL){ u.armL.rotation.x+=(0.25*sw2-u.armL.rotation.x)*Math.min(1,6*dt); u.armL.rotation.z+=(-0.3-u.armL.rotation.z)*Math.min(1,6*dt); }
        if(u.fistR){ u.fistR.position.y+=(1.0+0.15*sw2-u.fistR.position.y)*Math.min(1,6*dt); }
        if(u.fistL){ u.fistL.position.y+=(1.0-0.15*sw2-u.fistL.position.y)*Math.min(1,6*dt); }
      }
      if(uStepSfx(dt))sfx.step();
      if(d<3.6){ Math.random()<0.5?setAtk('smash',1.05):setAtk('swipe',0.7); }
      else if(d<13&&B.specialCD<=0){ setAtk(Math.random()<0.5?'rocks':'stomp',0.9); B.specialCD=B.phase===2?3:5; }
      else if(B.t<=0){ B.state='idle'; B.t=0.4; }
      B.specialCD-=dt; break;
    case 'windup': {
      faceP(2);
      const p=windupP(), u=B.mesh.userData;
      if(B.atkName==='smash'||B.atkName==='stomp')showTele(B.atkName==='smash'?4.5:7,1);
      setWGlow(u,p*0.9,0xff6611);
      if(!B.teleShown){
        B.teleShown=true;
        if(B.atkName==='swipe')showMeleeTele(B.pos,B.yaw,4.4,150);
      } else if(teleArc.visible){ teleArc.position.set(B.pos.x,0.06,B.pos.z); teleArc.rotation.y=B.yaw; }
      if(B.atkName==='smash'){
        // SKYFALL: golem rears onto tiptoes, both fists eclipse the moon
        const rise=p;
        if(u.armR){ u.armR.position.y=2.2+rise*1.6; u.armR.rotation.x=-2.7*rise; u.armR.rotation.z=0.35*rise; }
        if(u.armL){ u.armL.rotation.x=-2.7*rise; u.armL.rotation.z=-0.35*rise; }
        if(u.fistL)u.fistL.position.y=1.0+rise*2.2;
        if(u.fistR)u.fistR.position.y=1.0+rise*2.2;
        if(u.core){ u.core.scale.setScalar(1+rise*0.9); }
        if(u.legL){ u.legL.rotation.x=0.35*rise; } if(u.legR){ u.legR.rotation.x=0.35*rise; }
        B.mesh.rotation.x=0.16*rise; B.mesh.position.y=-0.15+rise*0.55;
        // full-charge tremble: the mountain is about to fall on you
        if(p>0.72){ B.mesh.position.x+=rand(-1,1)*0.09; B.mesh.position.z+=rand(-1,1)*0.09; B.mesh.rotation.y=B.yaw+rand(-1,1)*0.03; }
        if(Math.random()<dt*(8+p*18))burst(V3(B.pos.x+rand(-1,1),3.5,B.pos.z+rand(-1,1)),1,0xff5a1a,1,1,0.3,0);
      }
      else if(B.atkName==='stomp'){
        // EARTHQUAKE: right knee cranks up, arms spread for balance
        if(u.legR){ u.legR.rotation.x=-1.5*p; }
        if(u.legL){ u.legL.rotation.x=0.2*p; }
        if(u.armR){ u.armR.rotation.z=1.2*p; u.armR.rotation.x=-0.3*p; }
        if(u.armL){ u.armL.rotation.z=-1.2*p; u.armL.rotation.x=-0.3*p; }
        if(u.core){ u.core.scale.setScalar(1+p*0.5); }
        B.mesh.rotation.x=-0.08*p; B.mesh.position.y=0.25*p;
        if(Math.random()<dt*10)burst(V3(B.pos.x,0.2,B.pos.z),1,0x8a7a66,2,1,0.3);
      }
      else if(B.atkName==='swipe'){
        // WINDMILL: torso coils almost backwards, fist drags sparks
        const coil=p;
        if(u.armL){ u.armL.rotation.z=1.9*coil; u.armL.rotation.x=-0.6*coil; }
        if(u.armR){ u.armR.rotation.z=-0.5*coil; u.armR.rotation.x=-0.4*coil; }
        if(u.torso){ u.torso.rotation.y=-0.45*coil; }
        B.mesh.rotation.y=B.yaw-0.95*coil;
        B.mesh.rotation.x=0.08*coil;
        if(Math.random()<dt*16)burst(V3(B.pos.x-1.6,0.6,B.pos.z),2,0xffcc66,2,1,0.3,-2);
      }
      else if(B.atkName==='rocks'){
        // RIP & THROW: golem digs its right fist into the ground behind itself
        if(u.armR){ u.armR.rotation.x=1.2*p; u.armR.position.y=2.2-p*1.2; }
        if(u.armL){ u.armL.rotation.x=-0.8*p; }
        if(u.torso){ u.torso.rotation.y=0.5*p; }
        B.mesh.rotation.x=-0.1*p; B.mesh.position.y=-0.35*p;
        if(Math.random()<dt*12)burst(V3(B.pos.x+1.6,0.3,B.pos.z),2,0x8a7a66,2,2,0.4);
      }
      if(B.t<=0){ hideMeleeTele(); B.state='strike'; B.t=0.5; B.strikeDone=false;
        setWGlow(u,1.4,0xff7711);
        if(B.atkName==='rocks'){ for(let k=-1;k<=1;k++){ const a=angleTo(B.pos,player.pos)+k*0.14; const tp=V3(player.pos.x+Math.sin(a)*2,1.2,player.pos.z+Math.cos(a)*2); spawnProj(V3(B.pos.x,3,B.pos.z),tp,{speed:13,dmg:17,color:0xff6a2a,size:1.4}); } sfx.roar(); }
      } break; }
    case 'strike': {
      const u=B.mesh.userData;
      if(B.atkName==='smash'){
        // WORLD-BREAKER: fists fall like meteors, torso folds over the impact
        const q=1-Math.max(0,B.t)/0.5;
        const fall=q*q;
        if(u.armR){u.armR.rotation.x=-2.7+fall*4.1; u.armR.position.y=3.8-fall*2.6;}
        if(u.armL){u.armL.rotation.x=-2.7+fall*4.1;}
        if(u.fistL)u.fistL.position.y=3.2-fall*2.9;
        if(u.fistR)u.fistR.position.y=3.2-fall*2.9;
        if(u.torso)u.torso.rotation.x=fall*0.35;
        B.mesh.rotation.x=0.16-fall*0.45; B.mesh.position.y=0.4-fall*0.55;
        if(!B.strikeDone&&q>0.62){ B.strikeDone=true; telegraphRing.visible=false;
          showSlash(B.pos,B.yaw,true,0xff6622); sfx.heavySwing(); bossDealMelee(30,4.8,1.5);
          const ip=V3(B.pos.x+Math.sin(B.yaw)*3,0.3,B.pos.z+Math.cos(B.yaw)*3);
          burst(ip,24,0xff6622,5,5,0.8); burst(ip,10,0xffffff,3,3,0.4); shake(0.5,0.75);
          setWGlow(u,1.2,0xff7711);
          if(B.phase===2)spawnPool(V3(B.pos.x+Math.sin(B.yaw)*3,0,B.pos.z+Math.cos(B.yaw)*3),{r:2.6,dps:14,life:5});
        }
      }
      if(B.atkName==='stomp'){
        // foot comes down like a piston, fists hammer down with it
        const q=1-Math.max(0,B.t)/0.5;
        const fall=q*q;
        if(u.legR){ u.legR.rotation.x=-1.5+fall*2.1; }
        if(u.legL){ u.legL.rotation.x=0.2-fall*0.2; }
        if(u.armR){ u.armR.rotation.z=1.2-fall*2.0; u.armR.rotation.x=-0.3+fall*1.1; }
        if(u.armL){ u.armL.rotation.z=-1.2+fall*2.0; u.armL.rotation.x=-0.3+fall*1.1; }
        B.mesh.position.y=0.25-fall*0.45; B.mesh.rotation.x=-0.08+fall*0.12;
        if(!B.strikeDone&&q>0.62){ B.strikeDone=true; telegraphRing.visible=false;
          const fp=V3(B.pos.x+Math.sin(B.yaw)*1.2,0.3,B.pos.z+Math.cos(B.yaw)*1.2);
          spawnShockwave(B.pos,{maxR:9,speed:B.phase===2?11:8,dmg:20});
          burst(fp,26,0xc9a06a,5,4,0.8); burst(B.pos,14,0xff6622,4,4,0.6);
          shake(0.55,0.75); sfx.hit();
        }
      }
      if(B.atkName==='swipe'){
        // TWIN MILLS: full-torso ~190° sweeps, fists level houses
        const q=1-Math.max(0,B.t)/0.35;
        const sw=Math.sin(Math.min(1,q)*Math.PI);
        if(!B.secondSwipe){
          if(u.armL){u.armL.rotation.z=1.9-q*3.8; u.armL.rotation.x=-0.6;}
          if(u.armR){u.armR.rotation.z=-0.5+q*0.5; u.armR.rotation.x=-0.4;}
          if(u.torso){u.torso.rotation.y=-0.45+q*0.9;}
          if(u.fistL){u.fistL.position.y=1.0+sw*0.6;}
          B.mesh.rotation.y=B.yaw-0.95+q*1.9;
        } else {
          if(u.armR){u.armR.rotation.z=-1.9+q*3.8; u.armR.rotation.x=-0.6;}
          if(u.armL){u.armL.rotation.z=1.9-q*1.9; u.armL.rotation.x=-0.4;}
          if(u.torso){u.torso.rotation.y=0.45-q*0.9;}
          if(u.fistR){u.fistR.position.y=1.0+sw*0.6;}
          B.mesh.rotation.y=B.yaw+0.95-q*1.9;
        }
        B.mesh.rotation.x=-0.1;
        if(Math.random()<dt*20)burst(V3(B.pos.x+rand(-2,2),1.0,B.pos.z+rand(-2,2)),2,0xffcc66,3,2,0.35);
        if(!B.strikeDone&&q>0.45){B.strikeDone=true;showSlash(B.pos,B.yaw+(B.secondSwipe?0.7:-0.7),true,0xff8833);sfx.swing();bossDealMelee(19,4.4,1.6);shake(0.25,0.45);setWGlow(u,1.0,0xff7711);}
        if(B.t<=0){ if(!B.secondSwipe){B.secondSwipe=true;B.strikeDone=false;B.t=0.35;} else {B.state='recover';B.t=0.8;B.secondSwipe=false;} }
      }
      if(B.atkName==='rocks'){
        // HURL: whole torso uncoils like a catapult, lunging step forward
        const q=1-Math.max(0,B.t)/0.5;
        if(u.armR){u.armR.rotation.x=1.2-q*3.0; u.armR.position.y=1.0+q*1.8;}
        if(u.armL){u.armL.rotation.x=-0.8+q*0.8;}
        if(u.torso){u.torso.rotation.y=0.5-q*1.3;}
        if(u.fistR){u.fistR.position.y=1.0+q*1.4;}
        B.mesh.rotation.x=-0.1-q*0.1; B.mesh.position.y=-0.35+q*0.45;
        B.mesh.rotation.y=B.yaw;
        B.pos.x+=Math.sin(B.yaw)*2.0*q*dt; B.pos.z+=Math.cos(B.yaw)*2.0*q*dt;
        B.mesh.position.copy(B.pos); B.mesh.position.y+=-0.35+q*0.45;
        if(!B.strikeDone&&q>0.25){B.strikeDone=true;burst(V3(B.pos.x,2.5,B.pos.z),12,0x8a7a66,3,4,0.5);shake(0.2,0.3);}
      }
      if(B.atkName==='rocks'||B.atkName==='stomp'){ if(B.t<=0){B.state='recover';B.t=B.phase===2?0.6:1.0;} }
      else if(B.t<=0&&B.atkName!=='swipe'){ B.state='recover'; B.t=B.phase===2?0.6:1.0; }
      break; }
    case 'recover': telegraphRing.visible=false; easeBossPose(dt,4); faceP(3); if(B.t<=0){B.state='idle';B.t=rand(0.3,0.8);} break;
  }
}
let stepAcc=0;
function uStepSfx(dt){ stepAcc+=dt; if(stepAcc>0.5){stepAcc=0;return true;} return false; }
function aiSaint(dt,d,faceP,step,spdMul){
  const B=boss;
  B.mesh.position.y=Math.sin(performance.now()*0.002)*0.25+0.2; B.pos.y=0;
  B.teleportCD-=dt; B.orbCD-=dt; B.meteorCD-=dt;
  switch(B.state){
    case 'idle': faceP(5); easeBossPose(dt,6); if(B.t<=0){B.state='chase';B.t=1;} break;
    case 'chase': {
      faceP(6); easeBossPose(dt,6);
      if(d>6)step(player.pos.x,player.pos.z,B.speed*spdMul);
      else if(d<2.5)step(B.pos.x*2-player.pos.x,B.pos.z*2-player.pos.z,B.speed*0.8);
      if(B.teleportCD<=0&&(d>12||Math.random()<dt*0.25)){ setAtk('teleport',0.5); break; }
      if(B.orbCD<=0){ setAtk('orbs',0.7); B.orbCD=B.phase===2?2.5:4; break; }
      if(B.meteorCD<=0&&d>4){ setAtk('meteor',0.9); B.meteorCD=B.phase===2?4:6; break; }
      if(d<3.4){ setAtk('spear',0.5); B.comboLeft=B.phase===2?4:3; break; }
      if(d<9&&Math.random()<dt*0.7){ setAtk('beam',0.9); break; }
      if(B.t<=0){B.state='idle';B.t=0.3;}
      break; }
    case 'windup': {
      faceP(4);
      const p=windupP(), u=B.mesh.userData;
      setWGlow(u,p*0.8,0xffc855);
      if(!B.teleShown){
        B.teleShown=true;
        if(B.atkName==='spear')showMeleeTele(B.pos,B.yaw,4.2,75);
      } else if(teleArc.visible){ teleArc.position.set(B.pos.x,0.06,B.pos.z); teleArc.rotation.y=B.yaw; }
      if(B.atkName==='spear'){
        // SERPENT'S KISS: saint sinks low, staff drawn back like a piston
        B.mesh.position.y+=((0.2+Math.sin(performance.now()*0.002)*0.25-0.35)-B.mesh.position.y)*Math.min(1,8*dt);
        if(u.armR){ u.armR.rotation.x=0.9*p; }
        if(u.armL){ u.armL.rotation.x=0.7*p; }
        if(u.sword){ u.sword.rotation.x=1.5*p; u.sword.position.z=0.55-0.9*p; u.sword.position.x=0.25; }
        if(u.orb){ u.orb.scale.setScalar(1+p*0.5); }
        B.mesh.rotation.x=0.14*p;
        if(Math.random()<dt*14)burst(V3(B.pos.x,1.5,B.pos.z),1,0xffd88a,1.5,2,0.3,0);
      } else {
        // CANTICLE: saint rises, BOTH hands lift the staff skyward, orb drinks the light
        const lift=(B.atkName==='meteor'||B.atkName==='orbs'||B.atkName==='beam')?p*0.9:p*0.35;
        B.mesh.position.y+=((0.2+Math.sin(performance.now()*0.002)*0.25+0.2+lift)-B.mesh.position.y)*Math.min(1,8*dt);
        if(u.armR){ u.armR.rotation.x=-0.4-2.2*p; }
        if(u.armL){ u.armL.rotation.x=-0.3-1.7*p; }
        if(u.sword){ u.sword.rotation.x=-2.4*p; u.sword.position.y=2.3+p*0.5; u.sword.position.x=0.25; }
        if(u.orb){ u.orb.scale.setScalar(1+p*0.6); }
        if(u.halo){ u.halo.rotation.z+=dt*(1.5+p*6); }
        // cast-ready: golden ring blooms under the saint + rising chant tone
        if(B.atkName==='orbs'||B.atkName==='meteor'){
          telegraphRing2.scale.setScalar(0.5+p*1.4); telegraphRing2.position.set(B.pos.x,0.06,B.pos.z); telegraphRing2.visible=true;
          telegraphRing2.material.opacity=0.35+p*0.45;
          if(!B.chanted){ B.chanted=true; sfx.charge(); }
          if(Math.random()<dt*22){ const a=rand(0,Math.PI*2); burst(V3(B.pos.x+Math.sin(a)*2.2,rand(0.5,2.5),B.pos.z+Math.cos(a)*2.2),1,0xffd88a,0.4,0.6,0.4,0); }
        }
        if(Math.random()<dt*(8+p*16))burst(V3(B.pos.x,2.8,B.pos.z),1,0xffd88a,1.5,2,0.35,0);
      }
      if(B.atkName==='beam'){ telegraphRing2.scale.setScalar(0.55); telegraphRing2.position.set(player.pos.x,0.06,player.pos.z); telegraphRing2.visible=true; }
      if(B.atkName==='meteor'&&!B.meteorSpots){ B.meteorSpots=[]; for(let k=0;k<(B.phase===2?6:4);k++){ const p2=V3(player.pos.x+rand(-5,5),0,player.pos.z+rand(-5,5)); const r=makeRing(2.2,0xff8833); r.position.set(p2.x,0.05,p2.z); r.visible=true; B.meteorSpots.push({p:p2,r,t:1.0}); } }
      if(B.t<=0){ hideMeleeTele(); telegraphRing2.visible=false; B.state='strike'; B.t=B.atkName==='spear'?1.2:0.6; B.strikeDone=false; B.strikeN=0; B.thrustN=0;
        setWGlow(u,1.3,0xffc855);
        if(B.atkName==='teleport'){ burst(B.pos,24,0xb48aff,3,4,0.6); const a=rand(0,Math.PI*2); B.pos.set(clamp(player.pos.x+Math.sin(a)*7,-ARENA_R+2,ARENA_R-2),0,clamp(player.pos.z+Math.cos(a)*7,-ARENA_R+2,ARENA_R-2)); B.mesh.position.copy(B.pos); burst(B.pos,24,0xb48aff,3,4,0.6); tone(200,0.4,'sine',0.2,300); B.teleportCD=B.phase===2?4:7; }
        if(B.atkName==='orbs'){ const n=B.phase===2?5:3; for(let k=0;k<n;k++){ setTimeout(()=>{ if(boss===B&&state==='fight'){ const a=(k/n)*Math.PI*2; spawnProj(V3(B.pos.x,2.6,B.pos.z),V3(player.pos.x+Math.sin(a)*1.5,1.2,player.pos.z+Math.cos(a)*1.5),{speed:8,dmg:13,color:0xffd88a,homing:3.2,life:5,size:0.9}); sfx.beam(); } },k*160); } }
        if(B.atkName==='beam'){ telegraphRing2.visible=false; B.beamDir=angleTo(B.pos,player.pos); B.beamT=0.7; sfx.beam(); shake(0.4,0.6); }
      } } break;
    case 'strike': {
      const u=B.mesh.userData;
      if(B.atkName==='teleport'){ easeBossPose(dt,6); if(B.t<=0){B.state='idle';B.t=0.2;} }
      else if(B.atkName==='orbs'){
        // cast follow-through: staff sweeps down with both hands
        if(u.armR)u.armR.rotation.x=-2.6+(0.6-Math.max(0,B.t))*3.0;
        if(u.armL)u.armL.rotation.x=-2.0+(0.6-Math.max(0,B.t))*2.4;
        if(u.sword)u.sword.rotation.x=-2.4+(0.6-Math.max(0,B.t))*3.0;
        if(B.t<=0){B.state='recover';B.t=0.7;}
      }
      else if(B.atkName==='spear'){
        // piston thrusts with BOTH hands: staff punches 2m forward + lunging step
        B.strikeN+=dt; const hitEvery=0.28;
        const cyc=(B.strikeN/hitEvery)%1;
        const ext=Math.sin(Math.min(1,cyc)*Math.PI); // 0->1->0 punch envelope
        const side=(B.thrustN%2===0)?1:-1;
        if(u.sword){ u.sword.position.z=0.55+ext*1.8; u.sword.position.x=0.25+side*ext*0.35; u.sword.rotation.x=1.5-ext*0.2; }
        if(u.armR){ u.armR.rotation.x=0.9-ext*1.7; u.armR.rotation.z=side*ext*0.3; }
        if(u.armL){ u.armL.rotation.x=0.7-ext*1.4; u.armL.rotation.z=-side*ext*0.3; }
        if(u.orb){ u.orb.scale.setScalar(1+ext*0.5); }
        B.mesh.rotation.x=0.14-ext*0.3;
        B.mesh.rotation.y=B.yaw;
        // lunging footwork: glide toward the player on every thrust
        const fw=angleTo(B.pos,player.pos);
        B.pos.x+=Math.sin(fw)*5.5*ext*dt; B.pos.z+=Math.cos(fw)*5.5*ext*dt;
        B.mesh.position.copy(B.pos);
        if(Math.random()<dt*18)burst(V3(B.pos.x+Math.sin(B.yaw)*1.5,1.4,B.pos.z+Math.cos(B.yaw)*1.5),1,0xffd88a,1,1,0.25,0);
        if(B.strikeN>hitEvery){
          B.strikeN=0; B.thrustN++;
          showSlash(B.pos,B.yaw+side*0.25,false,0xffd88a); sfx.swing();
          bossDealMelee(15,3.8,1.4); shake(0.14,0.28);
          burst(V3(B.pos.x+Math.sin(B.yaw)*2,1.5,B.pos.z+Math.cos(B.yaw)*2),8,0xffd88a,2,3,0.4);
          B.comboLeft--;
        }
        faceP(9);
        if(B.comboLeft<=0){B.state='recover';B.t=B.phase===2?0.4:0.8;}
      }
      else if(B.atkName==='beam'){
        // beam: staff levelled at player with both hands, body braced
        B.beamT-=dt;
        if(u.sword){ u.sword.rotation.x=1.4; u.sword.position.z=0.9; u.sword.position.x=0.25; }
        if(u.armR){ u.armR.rotation.x=-1.4; }
        if(u.armL){ u.armL.rotation.x=-1.1; }
        B.mesh.rotation.x=-0.15;
        burst(V3(B.pos.x+Math.sin(B.beamDir)*3,1.4,B.pos.z+Math.cos(B.beamDir)*3),3,0xffd88a,1,1,0.2,0);
        // beam hit: distance point-line
        const px=player.pos.x-B.pos.x,pz=player.pos.z-B.pos.z; const dx=Math.sin(B.beamDir),dz=Math.cos(B.beamDir);
        const along=px*dx+pz*dz; const perp=Math.abs(px*dz-pz*dx);
        if(along>0&&along<16&&perp<1.3&&!B.strikeDone){ B.strikeDone=true; damagePlayer(Math.round(26*B.dmgMul),B.pos,true); }
        if(B.beamT<=0){B.state='recover';B.t=0.9;}
      }
      else if(B.atkName==='meteor'){
        let done=true;
        for(const s of B.meteorSpots){ s.t-=dt; s.r.material.opacity=0.4+Math.sin(performance.now()*0.02)*0.3; if(s.t<=0&&!s.done){ s.done=true; scene.remove(s.r); burst(s.p,22,0xff6a2a,4,6,0.8); sfx.hit(); shake(0.3,0.4); if(dist2D(player.pos,s.p)<2.6)damagePlayer(Math.round(22*B.dmgMul),s.p); spawnShockwave(s.p,{maxR:3.5,speed:7,dmg:8}); } if(!s.done)done=false; }
        if(done){ B.meteorSpots=null; B.state='recover'; B.t=0.8; }
      }
      break; }
    case 'recover': faceP(4); easeBossPose(dt,6); if(B.t<=0){B.state='idle';B.t=rand(0.2,B.phase===2?0.35:0.6);} break;
  }
}

/* ---------- floaters / toast / hud ---------- */
const dmgLayer=$('dmg-layer');
function spawnFloat(worldPos,text,cls=''){
  const d=document.createElement('div'); d.className='dmg-num '+cls; d.textContent=text;
  const v=worldPos.clone(); v.y+=2.2; v.project(camera);
  d.style.left=((v.x*0.5+0.5)*innerWidth+rand(-12,12))+'px'; d.style.top=((-v.y*0.5+0.5)*innerHeight)+'px';
  dmgLayer.appendChild(d);
  requestAnimationFrame(()=>{ d.style.transform='translate(-50%,-90px)'; d.style.opacity='0'; });
  setTimeout(()=>d.remove(),850);
  while(dmgLayer.children.length>24)dmgLayer.firstChild.remove();
}
let toastT=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.add('hidden'),1600); }
function updateHUD(){
  $('hp-bar').style.width=(player.hp/player.maxHp*100)+'%';
  $('hp-ghost').style.width=(player.hp/player.maxHp*100)+'%';
  document.querySelector('.hp-bg')?.classList.toggle('low',player.hp<30);
  $('st-bar').style.width=(player.st/player.maxSt*100)+'%';
  document.querySelector('.st-bg')?.classList.toggle('low',player.st<25);
  const er=$('estus-row'); er.innerHTML=''; for(let i=0;i<3;i++){ const f=document.createElement('div'); f.className='flask'+(i<player.flasks?'':' spent'); er.appendChild(f); }
  updateBossBar();
}
let bossGhost=1;
function updateBossBar(){ if(!boss)return; const pct=Math.max(0,boss.hp/boss.maxHp*100); $('boss-bar').style.width=pct+'%'; bossGhost=Math.max(pct/100,bossGhost); }
function updatePostureBar(){
  if(!boss)return;
  const pct=clamp(boss.posture/boss.postureMax*100,0,100);
  $('posture-bar').style.width=pct+'%';
  $('posture-bg').classList.toggle('full',pct>=85);
}
setInterval(()=>{ if(!boss)return; const pct=boss.hp/boss.maxHp; if(bossGhost>pct){bossGhost=Math.max(pct,bossGhost-0.02); $('boss-bar-ghost').style.width=(bossGhost*100)+'%';} },80);

/* ---------- camera ---------- */
let camYaw=Math.PI, camPitch=0.42, camDist=7.2, shakeT=0, shakeAmp=0;
function shake(t,a){ shakeT=Math.max(shakeT,t); shakeAmp=Math.max(shakeAmp,a); }
function hitstop(t){ freezeT=Math.max(freezeT,t); }
let freezeT=0;
function updateCamera(dt){
  camYaw-=mouseDX*0.0026; camPitch=clamp(camPitch+mouseDY*0.0022,0.08,1.25); mouseDX=0; mouseDY=0;
  if(keys['KeyQ']&&false){} // handled on press
  let target, look;
  if(lockedOn&&boss&&!boss.dead&&state==='fight'){
    const mid=V3((player.pos.x+boss.pos.x)/2,(2), (player.pos.z+boss.pos.z)/2);
    const d=dist2D(player.pos,boss.pos);
    camDist+= ((clamp(d*0.7+4,5,10))-camDist)*Math.min(1,3*dt);
    const fwd=angleTo(player.pos,boss.pos);
    camYaw+=angDiff(fwd,camYaw)*Math.min(1,2.2*dt);
    target=V3(player.pos.x-Math.sin(camYaw)*camDist, 2.4+camPitch*3.2, player.pos.z-Math.cos(camYaw)*camDist);
    look=V3((player.pos.x*0.6+boss.pos.x*0.4),1.7,(player.pos.z*0.6+boss.pos.z*0.4));
  } else {
    if(keys['ArrowLeft'])camYaw+=1.8*dt; if(keys['ArrowRight'])camYaw-=1.8*dt;
    target=V3(player.pos.x-Math.sin(camYaw)*camDist, 2.2+camPitch*3.4, player.pos.z-Math.cos(camYaw)*camDist);
    look=V3(player.pos.x+Math.sin(camYaw)*2,1.6,player.pos.z+Math.cos(camYaw)*2);
  }
  camera.position.lerp(target,Math.min(1,12*dt));
  // keep out of floor
  if(camera.position.y<0.6)camera.position.y=0.6;
  // keep out of the boss body (dash-throughs shouldn't blind the player)
  if(boss&&!boss.dead){
    const bx=camera.position.x-boss.pos.x, bz=camera.position.z-boss.pos.z;
    const bd=Math.hypot(bx,bz);
    if(bd<2.4){ const l=bd||1, push=2.4-bd; camera.position.x+=bx/l*push; camera.position.z+=bz/l*push; if(camera.position.y<2.1)camera.position.y=2.1; }
  }
  let sx=0,sy=0;
  if(shakeT>0){ shakeT-=dt; sx=rand(-1,1)*shakeAmp*shakeT*4; sy=rand(-1,1)*shakeAmp*shakeT*4; if(shakeT<=0)shakeAmp=0; }
  camera.lookAt(look.x+sx,look.y+sy,look.z);
}
function toggleLock(){
  if(!boss||boss.dead)return;
  lockedOn=!lockedOn; sfx.ui();
  $('lock-indicator').classList.toggle('hidden',!lockedOn);
  toast(lockedOn?'LOCK-ON':'LOCK OFF');
}

/* ---------- player update ---------- */
function getMoveDir(){
  let f=0,s=0;
  if(keys['KeyW'])f+=1; if(keys['KeyS'])f-=1; if(keys['KeyA'])s-=1; if(keys['KeyD'])s+=1;
  const l=Math.hypot(f,s)||1; f/=Math.max(1,Math.hypot(f,s)); s/=Math.max(1,Math.hypot(f,s)); void l;
  // camera-relative: forward = +camYaw direction? camYaw is behind player, forward = camYaw+PI? Let's define forward as away from camera:
  const fw={x:Math.sin(camYaw+Math.PI),z:Math.cos(camYaw+Math.PI)};
  const rt={x:Math.sin(camYaw+Math.PI-Math.PI/2),z:Math.cos(camYaw+Math.PI-Math.PI/2)};
  // Actually simpler: forward vector from camera to player projected:
  const cx=camera.position, px=player.pos;
  let fwdx=px.x-cx.x, fwdz=px.z-cx.z; const fl=Math.hypot(fwdx,fwdz)||1; fwdx/=fl; fwdz/=fl;
  const rtx=-fwdz, rtz=fwdx;
  return V3(fwdx*f+rtx*s,0,fwdz*f+rtz*s);
}
function updatePlayer(dt){
  player.animT+=dt;
  if(player.iframes>0)player.iframes-=dt;
  if(player.rollCD>0)player.rollCD-=dt;
  if(player.comboWin>0)player.comboWin-=dt;
  if(player.parryT>0)player.parryT-=dt;
  if(player.parryCD>0)player.parryCD-=dt;
  // stamina regen
  if(player.stDelay>0)player.stDelay-=dt;
  else { const rate=blocking?6:30; player.st=Math.min(player.maxSt,player.st+rate*dt); }
  if(state!=='fight'){ // idle anim on title
    player.mesh.rotation.y+=dt*0.3;
  }
  if(state!=='fight'&&state!=='intro')return;
  if(player.dead)return;
  const u=player.mesh.userData;
  // flask
  if(player.drinkT>0){
    player.drinkT-=dt;
    u.armL.rotation.x=-2.2+Math.sin((1.15-player.drinkT)*6)*0.2;
    if(player.drinkT<0.45&&!player.drinkHealed){ player.drinkHealed=true; player.hp=Math.min(player.maxHp,player.hp+62); spawnFloat(player.pos,'+62','heal'); burst(player.pos,16,0x66ff66,2,3,0.7); updateHUD(); }
    if(player.drinkT<=0)player.drinkHealed=false;
  }
  // attack progress — full-body swing animation per combo step
  if(player.atkT<1){
    player.atkT+=dt/player.atkDur;
    const k=Math.min(1,player.atkT);
    const w=clamp(k/0.35,0,1), s=clamp((k-0.35)/0.25,0,1), r=clamp((k-0.6)/0.4,0,1);
    const ease=(a,b,t)=>a+(b-a)*t;
    // reset sword offset each frame
    u.sword.position.set(0.48,1.05,0.15);
    if(player.heavy){
      // HEAVY: deep crouch, blade overhead, then crushing chop + leap
      u.armR.rotation.set(ease(0,-2.9,w)+s*3.9-r*1.0, 0, 0);
      u.sword.rotation.set(ease(Math.PI/2.3,-2.6,w)+s*4.0, 0, 0);
      u.armL.rotation.set(ease(0,-1.2,w)+s*1.6, 0, 0.4);
      player.mesh.rotation.x=ease(0,0.28,w)-s*0.5+r*0.22;
      player.mesh.rotation.y=player.yaw;
    } else if(player.combo===0){
      // 1st: horizontal RIGHT -> LEFT slash, torso coils then uncoils
      u.armR.rotation.set(ease(0,-0.7,w)+s*0.4, 0, ease(0,1.35,w)-s*2.9+r*1.55);
      u.sword.rotation.set(ease(Math.PI/2.3,0.35,w), 0, ease(0,1.7,w)-s*3.4+r*1.7);
      u.armL.rotation.set(0,0,0.2*w);
      player.mesh.rotation.x=ease(0,0.12,w)-s*0.22+r*0.1;
      player.mesh.rotation.y=player.yaw+ease(0,-0.5,w)+s*1.0-r*0.5;
    } else if(player.combo===1){
      // 2nd: backhand LEFT -> RIGHT
      u.armR.rotation.set(ease(0,-0.7,w)+s*0.4, 0, ease(0,-1.35,w)+s*2.9-r*1.55);
      u.sword.rotation.set(ease(Math.PI/2.3,0.35,w), 0, ease(0,-1.7,w)+s*3.4-r*1.7);
      u.armL.rotation.set(0,0,-0.2*w);
      player.mesh.rotation.x=ease(0,0.12,w)-s*0.22+r*0.1;
      player.mesh.rotation.y=player.yaw+ease(0,0.5,w)-s*1.0+r*0.5;
    } else {
      // 3rd: overhead vertical chop
      u.armR.rotation.set(ease(0,-2.7,w)+s*3.5-r*0.8, 0, 0);
      u.sword.rotation.set(ease(Math.PI/2.3,-2.2,w)+s*3.4, 0, 0);
      u.armL.rotation.set(ease(0,-0.9,w)+s*1.2, 0, 0);
      player.mesh.rotation.x=ease(0,0.22,w)-s*0.45+r*0.23;
      player.mesh.rotation.y=player.yaw;
    }
    if(!player.didHit&&player.atkT>0.45){
      player.didHit=true;
      if(boss&&!boss.dead){
        const d=dist2D(player.pos,boss.pos);
        const want=angleTo(player.pos,boss.pos);
        const range=player.heavy?3.4:3.0;
        if(d<range+ (boss.kind===1?1:0) && Math.abs(angDiff(want,player.yaw))<1.1){
          const base=player.heavy?34:(player.combo===2?26:18);
          const dmg=Math.round(base*rand(0.92,1.1));
          bossTakeDamage(dmg,player.heavy?3:(player.combo===2?2:1));
          showSlash(boss.pos,player.yaw,player.heavy);
          burst(bossHitPos(),player.heavy?18:10,player.heavy?0xff8833:0xfff2c9,3,4,0.5);
          shake(player.heavy?0.3:0.14,player.heavy?0.5:0.25);
          // small lunge
          player.pos.x+=Math.sin(player.yaw)*0.6; player.pos.z+=Math.cos(player.yaw)*0.6;
        }
      }
    }
    if(player.atkT>=1){ u.sword.rotation.set(0,0,0); u.sword.rotation.x=Math.PI/2.3; u.sword.position.set(0.48,1.05,0.15); u.armR.rotation.set(0,0,0); u.armL.rotation.set(0,0,0); player.mesh.rotation.x=0; }
    // lock movement during attack (slight forward drift)
    player.pos.x+=Math.sin(player.yaw)*dt*(player.heavy?1.2:2.0)*(1-player.atkT);
    player.pos.z+=Math.cos(player.yaw)*dt*(player.heavy?1.2:2.0)*(1-player.atkT);
  }
  // roll — tuck, lean and burst of dust (readable dodge, no clipping)
  if(player.rollT>0){
    player.rollT-=dt;
    const sp=11;
    const p=clamp(1-player.rollT/0.46,0,1);
    player.pos.x+=player.rollDir.x*sp*dt; player.pos.z+=player.rollDir.z*sp*dt;
    player.mesh.rotation.x=-Math.sin(p*Math.PI)*0.85;
    player.mesh.rotation.y=Math.atan2(player.rollDir.x,player.rollDir.z);
    u.armR.rotation.set(-1.2,0,0.8); u.armL.rotation.set(-1.2,0,-0.8);
    u.sword.rotation.set(0.4,0,1.2);
    u.legL.rotation.x=-1.1; u.legR.rotation.x=0.9;
    burst(player.pos,1,0x888888,1,1,0.3,-2);
    if(player.rollT<=0){ player.mesh.rotation.x=0; u.armR.rotation.set(0,0,0); u.armL.rotation.set(0,0,0); u.sword.rotation.x=Math.PI/2.3; u.sword.rotation.z=0; }
  } else if(player.atkT>=1&&player.drinkT<=0){
    // normal locomotion
    const mv=getMoveDir();
    const moving=mv.lengthSq()>0.01;
    player.sprinting=!!keys['ShiftLeft']&&moving&&player.st>1&&!blocking;
    const spd=blocking?2.4:(player.sprinting?7.2:5.2);
    if(player.sprinting){ player.st=Math.max(0,player.st-11*dt); player.stDelay=Math.max(player.stDelay,0.25); if(player.st<=0)player.sprinting=false; }
    if(moving){
      player.pos.x+=mv.x*spd*dt; player.pos.z+=mv.z*spd*dt;
      const want=Math.atan2(mv.x,mv.z);
      if(!lockedOn||true)player.yaw+=angDiff(want,player.yaw)*Math.min(1,12*dt);
      if(lockedOn&&boss&&!boss.dead)player.yaw=angleTo(player.pos,boss.pos);
      player.stepT+=dt*spd; if(player.stepT>2.2){player.stepT=0; sfx.step();}
      u.legL.rotation.x=Math.sin(player.animT*11)*0.7; u.legR.rotation.x=-Math.sin(player.animT*11)*0.7;
      u.armL.rotation.x=-Math.sin(player.animT*11)*0.4; if(player.atkT>=1)u.armR.rotation.x=Math.sin(player.animT*11)*0.4;
    } else {
      // idle: ease limbs out of attack/parry poses back to neutral
      u.legL.rotation.x*=0.85; u.legR.rotation.x*=0.85;
      u.armR.rotation.x*=0.8; u.armR.rotation.z*=0.8;
      u.armL.rotation.x*=0.8; u.armL.rotation.z*=0.8;
      u.sword.position.x+=(0.48-u.sword.position.x)*0.2; u.sword.position.y+=(1.05-u.sword.position.y)*0.2; u.sword.position.z+=(0.15-u.sword.position.z)*0.2;
      u.sword.rotation.x+=((Math.PI/2.3)-u.sword.rotation.x)*0.2; u.sword.rotation.z+=(0-u.sword.rotation.z)*0.2;
      player.mesh.rotation.x*=0.8;
      if(lockedOn&&boss&&!boss.dead)player.yaw+=angDiff(angleTo(player.pos,boss.pos),player.yaw)*Math.min(1,10*dt);
    }
    player.mesh.rotation.y=player.yaw;
    // SEKIRO deflect stance: body bladed sideways, blade cocked up-back,
    // shield tucked across torso, weight sunk — held for the whole window
    if(player.parryT>0){
      const hold=clamp(player.parryT/PARRY_WINDOW,0,1); // 1 at press -> 0 at expiry
      const snap=clamp((PARRY_WINDOW-player.parryT)/0.08,0,1); // fast settle-in
      u.sword.position.set(0.62-0.15*snap,1.05+0.75*snap,0.15+0.1*snap);
      u.sword.rotation.set(0.4-2.3*snap,0,-1.15*snap);
      u.armR.rotation.set(-2.1*snap,0,-0.7*snap);
      u.armL.rotation.set(-0.9*snap,0,0.85*snap);
      u.shield.position.set(-0.62+0.5*snap,1.25+0.15*snap,0.15+0.3*snap);
      u.legL.rotation.x=-0.55*snap; u.legR.rotation.x=0.4*snap;
      player.mesh.rotation.y=player.yaw+0.55*snap;
      player.mesh.rotation.x=0.16*snap;
      player.mesh.userData.glow.intensity=2+5*hold; player.mesh.userData.glow.color.setHex(0xffe9a8);
      if(hold>0.92&&!player.parryFlashed){
        player.parryFlashed=true;
        burst(V3(player.pos.x,1.4,player.pos.z),10,0xffe9a8,2.5,2.5,0.35,0);
        tone(880,0.12,'triangle',0.12,220);
      }
    }
    // block pose
    else if(blocking){ u.shield.position.set(-0.45,1.3,0.45); u.armL.rotation.x=-1.4; player.mesh.userData.glow.intensity=2; player.mesh.userData.glow.color.setHex(0x4466ff); }
    else { u.shield.position.set(-0.62,1.25,0.15); player.mesh.userData.glow.intensity=0; }
  }
  // clamp arena
  // body collision: the living wall — nobody walks through the boss.
  // (rolling / i-frames slip through on purpose: dodge THROUGH the attack)
  if(boss&&!boss.dead&&(state==='fight'||state==='intro')&&player.rollT<=0&&player.iframes<=0&&!player.dead){
    const minD=boss.kind===1?2.3:1.55;
    const dx=player.pos.x-boss.pos.x, dz=player.pos.z-boss.pos.z;
    const d=Math.hypot(dx,dz);
    if(d<minD){ const l=d||0.001; player.pos.x=boss.pos.x+dx/l*minD; player.pos.z=boss.pos.z+dz/l*minD; }
  }
  const r=Math.hypot(player.pos.x,player.pos.z);
  if(r>ARENA_R-0.6){ player.pos.x*=(ARENA_R-0.6)/r; player.pos.z*=(ARENA_R-0.6)/r; }
  // fire pools damage
  for(const p of pools){ if(dist2D(player.pos,p.mesh.position)<p.r&&player.iframes<=0){ player.hp-=p.dps*dt; updateHUD(); if(Math.random()<dt*6)burst(player.pos,2,0xff4400,2,3,0.4); if(player.hp<=0){player.hp=0;playerDie();} } }
  // cloak flutter
  if(u.cloak)u.cloak.rotation.x=0.15+Math.sin(player.animT*3)*0.08;
  player.mesh.position.copy(player.pos);
  if(player.rollT>0){ const p=clamp(1-player.rollT/0.46,0,1); player.mesh.position.y+=Math.sin(p*Math.PI)*0.45; }
  if(player.parryT>0&&player.atkT>=1&&player.rollT<=0)player.mesh.position.y-=0.18;
  if(player.rollT<=0&&player.atkT>=1&&player.parryT<=0)player.mesh.rotation.y=player.yaw;
  // iframes blink
  player.mesh.traverse(o=>{ if(o.isMesh){ o.material.transparent=player.iframes>0; o.material.opacity=player.iframes>0?0.55:1; } });
  // slash fade
  if(slashT<1){ slashT+=dt*4.5; slashMesh.material.opacity=Math.max(0,0.65*(1-slashT)); }
}

/* ---------- projectiles / waves / pools update ---------- */
let frameNo=0;
function updateHazards(dt){
  frameNo++;
  for(let i=projectiles.length-1;i>=0;i--){ const p=projectiles[i]; p.life-=dt;
    if(p.homing&&state==='fight'&&!player.dead){ const want=V3(player.pos.x-p.mesh.position.x,0,player.pos.z-p.mesh.position.z).normalize().multiplyScalar(p.homing); p.vel.addScaledVector(want,dt); const sp=p.vel.length(); const max=11; if(sp>max)p.vel.multiplyScalar(max/sp); }
    p.mesh.position.addScaledVector(p.vel,dt); p.mesh.position.y+=Math.sin(performance.now()*0.01+i)*dt*0.6;
    if(((frameNo+i)&1)===0)burst(p.mesh.position,1,p.color,0.4,0.4,0.25,0);
    if(dist2D(player.pos,p.mesh.position)<0.9&&Math.abs(player.pos.y+1-p.mesh.position.y)<1.8){ damagePlayer(p.dmg,p.mesh.position); scene.remove(p.mesh); projectiles.splice(i,1); continue; }
    if(p.life<=0||Math.hypot(p.mesh.position.x,p.mesh.position.z)>ARENA_R+4){ burst(p.mesh.position,8,p.color,2,3,0.4); scene.remove(p.mesh); projectiles.splice(i,1); }
  }
  for(let i=shockwaves.length-1;i>=0;i--){ const s=shockwaves[i]; s.r+=s.speed*dt; s.mesh.scale.setScalar(s.r); s.mesh.material.opacity=Math.max(0,0.9*(1-s.r/s.maxR));
    if(!s.hitDone){ const d=dist2D(player.pos,s.mesh.position); if(Math.abs(d-s.r)<0.9){ s.hitDone=true; damagePlayer(s.dmg,s.mesh.position); } }
    if(s.r>=s.maxR){ scene.remove(s.mesh); shockwaves.splice(i,1); }
  }
  for(let i=pools.length-1;i>=0;i--){ const p=pools[i]; p.t-=dt; p.mesh.material.opacity=0.3+Math.sin(performance.now()*0.008)*0.15; if(p.t<=0){scene.remove(p.mesh);pools.splice(i,1);} }
}

/* ---------- flow ---------- */
function startRun(){
  audio(); sfx.ui();
  ngPlus=+$('victory-screen').dataset.ng||0;
  bossIndex=0; deaths=0; runTime=0; lockedOn=false; $('lock-indicator').classList.add('hidden');
  $('title-screen').classList.add('hidden'); $('victory-screen').classList.add('hidden'); $('death-screen').classList.add('hidden'); $('felled-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  playerReset(); makeBoss(0); bossGhost=1; updateHUD();
  beginIntro();
}
function beginIntro(){
  state='intro';
  player.pos.set(0,0,10); player.yaw=Math.PI; player.mesh.rotation.set(0,Math.PI,0);
  camYaw=Math.PI; camPitch=0.38;
  camera.position.set(0,4.5,18);
  boss.pos.set(0,0,-9); boss.yaw=0; boss.mesh.position.copy(boss.pos); boss.mesh.rotation.set(0,0,0); boss.state='idle'; boss.t=2.6;
  sfx.roar(); shake(0.5,0.4);
  const def=BOSS_DEFS[bossIndex];
  $('boss-intro-sub').textContent='GREAT ENEMY · '+['I','II','III'][bossIndex];
  $('boss-intro-name').textContent=def.name;
  $('boss-intro').classList.remove('hidden');
  $('boss-bar').style.width='100%'; $('boss-bar-ghost').style.width='100%';
  setTimeout(()=>$('boss-intro').classList.add('hidden'),3400);
  setTimeout(()=>{ if(state==='intro'){ state='fight'; toast(def.name+' — FIGHT!'); } },2200);
  updateHUD();
}
function safeStart(){
  try{ startRun(); }
  catch(e){ console.error(e); toast('FAILED TO START — reload the page'); const n=$('loading-note'); if(n){ n.textContent='start failed: '+(e&&e.message||e); n.style.opacity=1; } }
}
$('btn-start').onclick=safeStart;
$('btn-respawn').onclick=()=>{ audio(); sfx.ui(); $('death-screen').classList.add('hidden'); playerReset(); makeBoss(bossIndex); bossGhost=1; beginIntro(); };
$('btn-next').onclick=()=>{ audio(); sfx.ui(); $('felled-screen').classList.add('hidden'); bossIndex++; player.hp=player.maxHp; player.st=player.maxSt; player.flasks=3; player.pos.set(0,0,10); projectiles.forEach(p=>scene.remove(p.mesh));projectiles.length=0; shockwaves.forEach(s=>scene.remove(s.mesh));shockwaves.length=0; pools.forEach(p=>scene.remove(p.mesh));pools.length=0; makeBoss(bossIndex); bossGhost=1; beginIntro(); };
$('btn-again').onclick=()=>{ audio(); ngPlus++; $('victory-screen').dataset.ng=ngPlus; $('victory-screen').classList.add('hidden'); bossIndex=0; deaths=0; runTime=0; playerReset(); makeBoss(0); bossGhost=1; beginIntro(); $('hud').classList.remove('hidden'); toast('NEW GAME+'+ngPlus+' — enemies empowered'); };

/* ---------- main loop ---------- */
const clock=new THREE.Clock();
function banner(text,color='#e8d5a3',dur=1800){ const b=$('center-banner'); b.textContent=text; b.style.color=color; b.classList.remove('hidden'); clearTimeout(b._t); b._t=setTimeout(()=>b.classList.add('hidden'),dur); }
function loop(){
  requestAnimationFrame(loop);
  let dt=Math.min(0.05,clock.getDelta());
  if(freezeT>0){ freezeT-=dt; dt*=0.08; }
  if(state==='fight')runTime+=dt;
  updatePlayer(dt); updateBoss(dt); updateHazards(dt); updateParticles(dt); updateCamera(dt);
  // flames flicker
  const t=performance.now()*0.008;
  flames.forEach((f,i)=>{ f.scale.setScalar(1+Math.sin(t+i*2)*0.18); });
  brazierLights.forEach((l,i)=>{ l.intensity=26+Math.sin(t*1.3+i*2)*6; });
  // boss bar ghost handled by interval
  // timer text
  if(state==='fight'||state==='intro'){$('run-timer').textContent=fmtTime(runTime); $('deaths').textContent='☠ '+deaths;}
  // clamp boss inside arena
  if(boss){ const r=Math.hypot(boss.pos.x,boss.pos.z); if(r>ARENA_R-1){boss.pos.x*=(ARENA_R-1)/r;boss.pos.z*=(ARENA_R-1)/r;} }
  // telegraph follows golem
  if(state!=='fight'&&state!=='intro'){ telegraphRing.visible=false; telegraphRing2.visible=false; hideMeleeTele(); }
  else if(boss&&boss.kind===1&&boss.state==='windup'&&(boss.atkName==='smash'||boss.atkName==='stomp')){ const rad=boss.atkName==='smash'?4.5:7; telegraphRing.scale.setScalar(rad/4.5); telegraphRing.position.set(boss.pos.x,0.05,boss.pos.z); telegraphRing.visible=true; }
  else telegraphRing.visible=false;
  if(!(boss&&boss.kind===2&&boss.state==='windup'&&(boss.atkName==='beam'||boss.atkName==='orbs'||boss.atkName==='meteor')))telegraphRing2.visible=false;
  // low-hp heartbeat vignette
  $('vignette').style.boxShadow=player.hp<30?`inset 0 0 ${120+Math.sin(t)*40}px rgba(160,10,10,.8)`:'none';
  // drink anim cleanup
  renderer.render(scene,camera);
}
loop();
makeBoss(0); bossGhost=1; updateHUD();
$('loading-note').textContent='arena forged · desync the flame';
setTimeout(()=>$('loading-note').style.opacity=0.4,500);

// victory check hook (bossDie timeout handles felled; final victory override)
const _bossDie=bossDie;
// expose for debug
window.__ashfall={player,get boss(){return boss;},state:()=>state,startRun,damagePlayer,addBossPosture,doDeathblow,tryParry};

// patch: when last boss felled -> victory instead of felled screen
setInterval(()=>{
  if(state==='felled'&&bossIndex===2){
    if(!$('felled-screen').classList.contains('hidden')&&!window._victoryShown){
      window._victoryShown=true;
      setTimeout(()=>{
        $('felled-screen').classList.add('hidden');
        state='victory';
        const isBest=!bestTime||runTime<bestTime;
        if(isBest){bestTime=runTime;store.set('ashfall_best',String(runTime));}
        $('victory-sub').textContent=`the cinder fades · ${fmtTime(runTime)} · deaths ${deaths}${ngPlus?' · NG+'+ngPlus:''}`;
        $('victory-stats').innerHTML=`TIME <b>${fmtTime(runTime)}</b> · DEATHS <b>${deaths}</b> · BEST <b>${fmtTime(bestTime)}</b>${isBest?'<br>★ NEW BEST ★':''}`;
        $('victory-screen').classList.remove('hidden'); document.exitPointerLock?.(); sfx.felled();
      },2600);
    }
  }
  if(state!=='felled')window._victoryShown=false;
},500);

function flashDamage(){ const f=$('damage-flash'); f.style.opacity=1; setTimeout(()=>f.style.opacity=0,140); }
