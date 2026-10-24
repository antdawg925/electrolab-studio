import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const host=document.getElementById('three');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0e1422);
const cam=new THREE.PerspectiveCamera(45,1,0.1,100);cam.position.set(5,4,6);
const ren=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});ren.setPixelRatio(Math.min(2,devicePixelRatio));host.appendChild(ren.domElement);
const ctl=new OrbitControls(cam,ren.domElement);ctl.enableDamping=true;ctl.target.set(0,0.8,0);
scene.add(new THREE.HemisphereLight(0xcfe8ff,0x202030,1.1));const dl=new THREE.DirectionalLight(0xffffff,1.6);dl.position.set(5,8,4);scene.add(dl);
scene.add(new THREE.GridHelper(12,24,0x38bdf8,0x1f2a40));
const M=c=>new THREE.MeshStandardMaterial({color:c,metalness:.3,roughness:.5});
const mats=[];const mm=c=>{const m=M(c);mats.push(m);return m;};
let root=new THREE.Group();scene.add(root);let joints=null;
const box=(w,h,d,c,x=0,y=0,z=0,p=root)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mm(c));m.position.set(x,y,z);p.add(m);return m;};
const cyl=(r,h,c,p=root)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),mm(c));p.add(m);return m;};
const BOM={rover:[['Arduino Uno R3',1],['L298N dual H-bridge',1],['TT gear motor + encoder',2],['65 mm wheel',2],['Caster ball',1],['HC-SR04 ultrasonic',1],['2S 18650 pack (7.4 V)',1],['Acrylic chassis 200×130 mm',1]],
 arm:[['ESP32 DevKit V1',1],['MG996R servo',3],['PCA9685 PWM driver',1],['Aluminum brackets',4],['5 V 5 A supply',1],['Base bearing 6806',1]],
 box:[['NEMA 4X enclosure 12×10×6"',1],['DIN rail 35 mm',1],['2-pole 20 A breaker',1],['24 VDC PSU',1],['Micro PLC / ESP32 controller',1],['Terminal blocks',12],['Wire duct 1×2"',2],['Cable glands PG13.5',4]]};
function build(kind){scene.remove(root);root=new THREE.Group();scene.add(root);mats.length=0;joints=null;
 document.getElementById('armCtl').style.display=kind==='arm'?'flex':'none';
 if(kind==='rover'){box(2.6,.08,1.7,0x334155,0,.7,0);box(2.6,.08,1.7,0x334155,0,1.25,0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([x,z])=>{const s=cyl(.04,.55,0xcbd5e1);s.position.set(x*1.1,.98,z*.7);});
  [-1,1].forEach(s=>{const w=cyl(.45,.22,0x111111);w.rotation.x=Math.PI/2;w.position.set(.5,.45,s*1.02);const hub=cyl(.18,.24,0xf59e0b);hub.rotation.x=Math.PI/2;hub.position.copy(w.position);box(.6,.3,.3,0xfacc15,.5,.62,s*.62);});
  const c=new THREE.Mesh(new THREE.SphereGeometry(.18,24,16),mm(0x94a3b8));c.position.set(-1.05,.2,0);root.add(c);
  box(1,.05,.7,0x0e7490,0,1.32,0);box(.25,.12,.2,0x94a3b8,-.4,1.4,-.2);box(.6,.3,.45,0xb91c1c,.3,.9,0);box(.3,.2,.06,0x2563eb,1.25,1.42,0);
  [-.08,.08].forEach(z=>{const e=cyl(.07,.08,0xe2e8f0);e.rotation.z=Math.PI/2;e.position.set(1.31,1.42,z*2);});box(.9,.35,.5,0x166534,-.6,.9,0);}
 if(kind==='arm'){cyl(.8,.25,0x334155).position.y=.12;const j0=new THREE.Group();j0.position.y=.25;root.add(j0);const b=cyl(.45,.4,0xf59e0b,j0);b.position.y=.2;
  const j1=new THREE.Group();j1.position.y=.45;j0.add(j1);box(.25,1.8,.3,0x38bdf8,0,.9,0,j1);
  const j2=new THREE.Group();j2.position.y=1.8;j1.add(j2);const k=cyl(.2,.4,0xf59e0b,j2);k.rotation.x=Math.PI/2;box(.2,1.4,.25,0x10b981,0,.7,0,j2);
  const g=box(.5,.12,.3,0x94a3b8,0,1.45,0,j2);box(.08,.35,.2,0xcbd5e1,-.2,1.65,0,j2);box(.08,.35,.2,0xcbd5e1,.2,1.65,0,j2);joints=[j0,j1,j2];}
 if(kind==='box'){const sh=new THREE.Mesh(new THREE.BoxGeometry(3,3.6,1.4),new THREE.MeshStandardMaterial({color:0x94a3b8,transparent:true,opacity:.18,metalness:.2}));sh.position.y=1.85;root.add(sh);mats.push(sh.material);
  box(2.7,3.3,.04,0xe2e8f0,0,1.85,-.6);[2.8,1.9,1].forEach(y=>box(2.5,.08,.06,0x9ca3af,0,y,-.55));
  box(.36,.6,.4,0x1e293b,-1,2.8,-.35);box(.36,.6,.4,0x1e293b,-.6,2.8,-.35);box(.8,.6,.4,0x475569,.6,2.8,-.35);box(1.2,.55,.4,0x0e7490,-.5,1.9,-.35);
  for(let i=0;i<10;i++)box(.1,.35,.3,i%2?0x2563eb:0x9ca3af,-.6+i*.13,1,-.4);box(2.5,.25,.25,0x64748b,0,2.35,-.45);box(2.5,.25,.25,0x64748b,0,1.45,-.45);
  [-.9,-.3,.3,.9].forEach(x=>{const g=cyl(.12,.25,0x111827);g.position.set(x,.0,0);});}
 const tb=document.querySelector('#bom tbody');tb.innerHTML=BOM[kind].map(r=>`<tr><td>${r[0]}</td><td class="mono">×${r[1]}</td></tr>`).join('');
 setWire();setJoints();}
function setWire(){const w=document.getElementById('wire').checked;mats.forEach(m=>m.wireframe=w);}
function setJoints(){if(!joints)return;const d=v=>+document.getElementById(v).value*Math.PI/180;joints[0].rotation.y=d('j0');joints[1].rotation.z=d('j1');joints[2].rotation.z=d('j2');}
['j0','j1','j2'].forEach(j=>document.getElementById(j).oninput=setJoints);document.getElementById('wire').onchange=setWire;
document.getElementById('model').onchange=e=>build(e.target.value);
function size(){const w=host.clientWidth||800,h=host.clientHeight||540;ren.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();}
window.addEventListener('resize',size);build('rover');size();
(function loop(){requestAnimationFrame(loop);if(document.getElementById('spin').checked)root.rotation.y+=0.004;ctl.update();ren.render(scene,cam);})();
