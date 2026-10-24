// ElectroLab Studio - Anthony Early
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.panel').forEach(e=>e.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active');window.dispatchEvent(new Event('resize'));});
const $=id=>document.getElementById(id);
const fmt=(v,u)=>{const a=Math.abs(v);if(a===0)return '0 '+u;if(a<1e-3)return (v*1e6).toFixed(2)+' µ'+u;if(a<1)return (v*1e3).toFixed(3)+' m'+u;if(a>=1e3)return (v/1e3).toFixed(3)+' k'+u;return v.toFixed(3)+' '+u;};

/* ================= 1. SCHEMATIC + MNA ================= */
const G=25,svg=$('svg'),NS='http://www.w3.org/2000/svg';
let parts=[],tool='R',pending=null,uid=1;
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tool').forEach(x=>x.classList.remove('active'));b.classList.add('active');tool=b.dataset.t;pending=null;draw();});
const key=p=>p[0]+','+p[1];
function terms(p){if(p.t==='O')return [[p.x-2,p.y-1],[p.x-2,p.y+1],[p.x+2,p.y]];if(p.t==='G')return [[p.x,p.y]];return [p.a,p.b];}
function el(tag,at,parent=svg){const e=document.createElementNS(NS,tag);for(const k in at)e.setAttribute(k,at[k]);parent.appendChild(e);return e;}
function solve(){
  // union-find nodes
  const par={};const f=k=>{if(!(k in par))par[k]=k;while(par[k]!==k){par[k]=par[par[k]];k=par[k];}return k;};const u=(a,b)=>{par[f(a)]=f(b);};
  parts.forEach(p=>terms(p).forEach(t=>f(key(t))));
  parts.filter(p=>p.t==='W').forEach(p=>u(key(p.a),key(p.b)));
  const gnd=parts.filter(p=>p.t==='G');if(!gnd.length)return {err:'Add a Ground symbol to set the 0 V reference.'};
  gnd.forEach(g=>u(key([g.x,g.y]),'GND'));f('GND');
  const roots=[...new Set(Object.keys(par).map(f))].filter(r=>r!==f('GND'));
  const idx={};roots.forEach((r,i)=>idx[r]=i);const n=roots.length;
  const vs=parts.filter(p=>p.t==='V'||p.t==='O');const N=n+vs.length;
  if(!N)return {err:'Nothing to solve.'};
  const A=Array.from({length:N},()=>new Array(N).fill(0)),z=new Array(N).fill(0);
  const ni=t=>{const r=f(key(t));return r===f('GND')?-1:idx[r];};
  parts.forEach(p=>{if(p.t==='R'){const g=1/p.v,a=ni(p.a),b=ni(p.b);if(a>=0)A[a][a]+=g;if(b>=0)A[b][b]+=g;if(a>=0&&b>=0){A[a][b]-=g;A[b][a]-=g;}}
    if(p.t==='I'){const a=ni(p.a),b=ni(p.b);/* current flows a->b through source, i.e. leaves node a into source, enters b */ if(a>=0)z[a]-=p.v;if(b>=0)z[b]+=p.v;}});
  vs.forEach((p,k)=>{const r=n+k;if(p.t==='V'){const a=ni(p.a),b=ni(p.b);/* b is + terminal */ if(b>=0){A[b][r]+=1;A[r][b]+=1;}if(a>=0){A[a][r]-=1;A[r][a]-=1;}z[r]=p.v;}
    else{const [m,pl,o]=terms(p).map(ni);if(o>=0)A[o][r]+=1;if(pl>=0)A[r][pl]+=1;if(m>=0)A[r][m]-=1;z[r]=0;}});
  // gaussian elimination
  const M=A.map((row,i)=>[...row,z[i]]);
  for(let c=0;c<N;c++){let pv=c;for(let r=c+1;r<N;r++)if(Math.abs(M[r][c])>Math.abs(M[pv][c]))pv=r;if(Math.abs(M[pv][c])<1e-12)return {err:'Singular circuit: check for floating nodes, open op-amp outputs, or voltage-source loops.'};[M[c],M[pv]]=[M[pv],M[c]];
    for(let r=0;r<N;r++)if(r!==c){const k=M[r][c]/M[c][c];if(k)for(let j=c;j<=N;j++)M[r][j]-=k*M[c][j];}}
  const x=M.map((r,i)=>r[N]/r[i]);
  const V=t=>{const i=ni(t);return i<0?0:x[i];};
  const names={};roots.forEach((r,i)=>names[r]='N'+(i+1));names[f('GND')]='GND';
  return {V,x,n,vs,nodeName:t=>names[f(key(t))],roots,idx,f};
}
function draw(){
  svg.innerHTML='';const w=svg.clientWidth||900,h=520;
  for(let x=G;x<w;x+=G)for(let y=G;y<h;y+=G)el('circle',{cx:x,cy:y,r:1.2,fill:'#2a3550'});
  const s=solve();const C={R:'#f59e0b',V:'#38bdf8',I:'#a78bfa',W:'#94a3b8',O:'#10b981',G:'#94a3b8'};
  parts.forEach(p=>{const g=el('g',{});const col=C[p.t];
    if(p.t==='G'){const X=p.x*G,Y=p.y*G;el('line',{x1:X,y1:Y,x2:X,y2:Y+8,stroke:col,'stroke-width':2},g);[14,9,4].forEach((l,i)=>el('line',{x1:X-l/2*1.4,y1:Y+8+i*4,x2:X+l/2*1.4,y2:Y+8+i*4,stroke:col,'stroke-width':2},g));}
    else if(p.t==='O'){const X=p.x*G,Y=p.y*G;el('path',{d:`M${X-G*1.4},${Y-G*1.6} L${X-G*1.4},${Y+G*1.6} L${X+G*1.4},${Y} Z`,fill:'rgba(16,185,129,.08)',stroke:col,'stroke-width':2},g);
      el('line',{x1:X-2*G,y1:Y-G,x2:X-1.4*G,y2:Y-G,stroke:col,'stroke-width':2},g);el('line',{x1:X-2*G,y1:Y+G,x2:X-1.4*G,y2:Y+G,stroke:col,'stroke-width':2},g);el('line',{x1:X+1.4*G,y1:Y,x2:X+2*G,y2:Y,stroke:col,'stroke-width':2},g);
      const t1=el('text',{x:X-1.2*G,y:Y-G+5,fill:col,'font-size':14},g);t1.textContent='−';const t2=el('text',{x:X-1.2*G,y:Y+G+5,fill:col,'font-size':14},g);t2.textContent='+';}
    else{const [x1,y1]=p.a.map(v=>v*G),[x2,y2]=p.b.map(v=>v*G);const L=Math.hypot(x2-x1,y2-y1)||1,ux=(x2-x1)/L,uy=(y2-y1)/L,mx=(x1+x2)/2,my=(y1+y2)/2;
      if(p.t==='W')el('line',{x1,y1,x2,y2,stroke:col,'stroke-width':2},g);
      else{const bl=Math.min(18,L/2-2);el('line',{x1,y1,x2:mx-ux*bl,y2:my-uy*bl,stroke:col,'stroke-width':2},g);el('line',{x1:mx+ux*bl,y1:my+uy*bl,x2,y2,stroke:col,'stroke-width':2},g);
        const ang=Math.atan2(uy,ux)*180/Math.PI,b=el('g',{transform:`translate(${mx},${my}) rotate(${ang})`},g);
        if(p.t==='R'){let d=`M${-bl},0`;const seg=bl*2/6;for(let k=0;k<6;k++)d+=` L${-bl+seg*(k+.5)},${k%2?6:-6}`;d+=` L${bl},0`;el('path',{d,fill:'none',stroke:col,'stroke-width':2},b);}
        else{el('circle',{cx:0,cy:0,r:bl,fill:'#0e1422',stroke:col,'stroke-width':2},b);if(p.t==='V'){const t=el('text',{x:bl-11,y:4,fill:col,'font-size':12,transform:''},b);t.textContent='+';const t2=el('text',{x:-bl+4,y:4,fill:col,'font-size':12},b);t2.textContent='−';}else el('path',{d:`M-9,0 L7,0 M2,-5 L8,0 L2,5`,stroke:col,fill:'none','stroke-width':2},b);}
        const lab=el('text',{x:mx-uy*24,y:my+ux*24+4,fill:'#f8fafc','font-size':12,'text-anchor':'middle',style:'cursor:pointer;font-family:JetBrains Mono'},g);
        lab.textContent=p.t==='R'?fmt(p.v,'Ω').replace(' ',''):p.t==='V'?p.v+'V':p.v*1e3+'mA';
        lab.onclick=e=>{e.stopPropagation();const nv=prompt('Value ('+(p.t==='R'?'Ω':p.t==='V'?'V':'A')+'):',p.v);if(nv!==null&&!isNaN(parseFloat(nv))&&(p.t!=='R'||parseFloat(nv)>0)){p.v=parseFloat(nv);draw();}};
        // current arrow
        if(!s.err){let i=null;if(p.t==='R')i=(s.V(p.a)-s.V(p.b))/p.v;if(p.t==='I')i=p.v;
          if(i!==null&&Math.abs(i)>1e-12){const d=i>0?1:-1,ax=mx+uy*14,ay=my-ux*14;el('path',{d:`M${ax-ux*d*10},${ay-uy*d*10} L${ax+ux*d*10},${ay+uy*d*10}`,stroke:'#f87171','stroke-width':2,'marker-end':'url(#arr)'},g);
            const ti=el('text',{x:mx+uy*30,y:my-ux*30+4,fill:'#f87171','font-size':11,'text-anchor':'middle','font-family':'JetBrains Mono'},g);ti.textContent=fmt(Math.abs(i),'A');}}}}
    g.style.cursor=tool==='X'?'pointer':'';g.onclick=e=>{if(tool==='X'){e.stopPropagation();parts=parts.filter(q=>q!==p);draw();}};});
  const defs=el('defs',{});const mk=el('marker',{id:'arr',markerWidth:8,markerHeight:8,refX:6,refY:4,orient:'auto'},defs);el('path',{d:'M0,0 L8,4 L0,8 Z',fill:'#f87171'},mk);
  // node labels
  const out=$('solOut');
  if(s.err){out.innerHTML='<span class="warn">'+s.err+'</span>';}
  else{const seen={};parts.forEach(p=>terms(p).forEach(t=>{const nm=s.nodeName(t);if(nm==='GND'||seen[nm])return;seen[nm]=1;const tx=el('text',{x:t[0]*G+5,y:t[1]*G-6,fill:'#38bdf8','font-size':11,'font-family':'JetBrains Mono'});tx.textContent=nm+'='+s.V(t).toFixed(3)+'V';}));
    let h='<b>Node voltages</b><br>';Object.keys(seen).sort((a,b)=>+a.slice(1)-+b.slice(1)).forEach(nm=>{const r=s.roots[+nm.slice(1)-1];h+=nm+' = '+s.x[s.idx[r]].toFixed(4)+' V<br>';});
    h+='<br><b>Branch currents</b> (direction shown by red arrows)<br>';let ri=1,vi=0;
    parts.forEach(p=>{if(p.t==='R'){const i=(s.V(p.a)-s.V(p.b))/p.v;const A=s.nodeName(p.a),B=s.nodeName(p.b);h+=`R${ri++} ${fmt(p.v,'Ω')}: ${fmt(Math.abs(i),'A')} ${i>=0?A+'→'+B:B+'→'+A}<br>`;}});
    s.vs.forEach((p,k)=>{const i=s.x[s.n+k];h+=(p.t==='V'?`V source ${p.v} V `:'Op-amp output ')+(-i>=0?'sources ':'sinks ')+fmt(Math.abs(i),'A')+'<br>';});
    out.innerHTML=h;}
  if(pending){el('circle',{cx:pending[0]*G,cy:pending[1]*G,r:5,fill:'#f59e0b'});}
}
svg.onclick=e=>{const r=svg.getBoundingClientRect();const p=[Math.round((e.clientX-r.left)/G),Math.round((e.clientY-r.top)/G)];
  if(tool==='X')return;if(tool==='G'){parts.push({t:'G',x:p[0],y:p[1]});draw();return;}if(tool==='O'){parts.push({t:'O',x:p[0],y:p[1]});draw();return;}
  if(!pending){pending=p;draw();return;}if(key(pending)===key(p)){pending=null;draw();return;}
  parts.push({t:tool,a:pending,b:p,v:tool==='R'?1000:tool==='V'?5:0.001});pending=null;draw();};
function exInv(){parts=[{t:'V',a:[4,10],b:[4,6],v:2},{t:'G',x:4,y:10},{t:'R',a:[4,6],b:[10,6],v:1000},{t:'W',a:[10,6],b:[12,6]},{t:'W',a:[10,6],b:[10,3]},{t:'R',a:[10,3],b:[18,3],v:4700},{t:'W',a:[18,3],b:[18,7]},
  {t:'O',x:14,y:7},{t:'W',a:[12,8],b:[12,10]},{t:'G',x:12,y:10},{t:'W',a:[16,7],b:[18,7]},{t:'W',a:[18,7],b:[22,7]},{t:'R',a:[22,7],b:[22,11],v:10000},{t:'G',x:22,y:11}];draw();}
function exDiv(){parts=[{t:'V',a:[4,12],b:[4,4],v:12},{t:'G',x:4,y:12},{t:'R',a:[4,4],b:[12,4],v:2000},{t:'R',a:[12,4],b:[12,12],v:3000},{t:'R',a:[12,4],b:[20,4],v:1000},{t:'R',a:[20,4],b:[20,12],v:2000},{t:'I',a:[28,12],b:[28,4],v:0.002},{t:'W',a:[20,4],b:[28,4]},{t:'W',a:[4,12],b:[12,12]},{t:'W',a:[12,12],b:[20,12]},{t:'W',a:[20,12],b:[28,12]}];draw();}
$('exInv').onclick=exInv;$('exDiv').onclick=exDiv;$('clr').onclick=()=>{parts=[];draw();};window.addEventListener('resize',()=>{if($('sch').classList.contains('active'))draw();});
exInv();

/* ================= 2. ARDUINO / ESP32 + PID ================= */
const BOARDS={uno:{name:'Arduino Uno',pins:{D2:'Digital, INT0',D3:'Digital, PWM, INT1',D4:'Digital',D5:'Digital, PWM',D6:'Digital, PWM',D7:'Digital',D8:'Digital',D9:'Digital, PWM',D10:'Digital, PWM, SS',D11:'Digital, PWM, MOSI',D12:'Digital, MISO',D13:'Digital, SCK, LED',A0:'Analog in',A1:'Analog in',A2:'Analog in',A3:'Analog in',A4:'Analog, SDA',A5:'Analog, SCL'}},
 esp32:{name:'ESP32 DevKit',pins:{GPIO2:'Digital, PWM, LED',GPIO4:'Digital, PWM, ADC2',GPIO5:'Digital, PWM, SS',GPIO13:'Digital, PWM, ADC2',GPIO14:'Digital, PWM',GPIO16:'Digital, PWM, UART2 RX',GPIO17:'Digital, PWM, UART2 TX',GPIO18:'Digital, PWM, SCK',GPIO19:'Digital, PWM, MISO',GPIO21:'Digital, PWM, SDA',GPIO22:'Digital, PWM, SCL',GPIO23:'Digital, PWM, MOSI',GPIO25:'Digital, PWM, DAC1',GPIO26:'Digital, PWM, DAC2',GPIO27:'Digital, PWM',GPIO32:'Digital, PWM, ADC1',GPIO33:'Digital, PWM, ADC1',GPIO34:'Input only, ADC1',GPIO35:'Input only, ADC1'}}};
const DEVS={'Motor PWM (L298N ENA)':'PWM','Motor DIR1 (IN1)':'OUT','Motor DIR2 (IN2)':'OUT','Encoder A':'INT','Encoder B':'IN','Potentiometer':'ADC','Servo':'PWM','Ultrasonic TRIG':'OUT','Ultrasonic ECHO':'IN','Status LED':'OUT','I2C SDA (IMU)':'SDA','I2C SCL (IMU)':'SCL'};
let assign=[];
function fillPins(){const b=BOARDS[$('board').value];$('pin').innerHTML=Object.keys(b.pins).map(p=>`<option>${p}</option>`).join('');}
$('dev').innerHTML=Object.keys(DEVS).map(d=>`<option>${d}</option>`).join('');
function defaultAssign(){assign=$('board').value==='uno'?[['Motor PWM (L298N ENA)','D5'],['Motor DIR1 (IN1)','D7'],['Motor DIR2 (IN2)','D8'],['Encoder A','D2'],['Encoder B','D4'],['Potentiometer','A0'],['Status LED','D13']]:
 [['Motor PWM (L298N ENA)','GPIO25'],['Motor DIR1 (IN1)','GPIO26'],['Motor DIR2 (IN2)','GPIO27'],['Encoder A','GPIO34'],['Encoder B','GPIO35'],['Potentiometer','GPIO32'],['Status LED','GPIO2']];}
$('board').onchange=()=>{fillPins();defaultAssign();renderPins();};
$('addPin').onclick=()=>{assign=assign.filter(a=>a[0]!==$('dev').value);assign.push([$('dev').value,$('pin').value]);renderPins();};
function pinOk(dev,pin){const cap=BOARDS[$('board').value].pins[pin]||'',need=DEVS[dev];
  if(need==='PWM'&&!/PWM/.test(cap))return 'needs a PWM pin';if(need==='ADC'&&!/Analog|ADC/.test(cap))return 'needs an analog/ADC pin';if(need==='INT'&&$('board').value==='uno'&&!/INT/.test(cap))return 'Uno interrupts only on D2/D3';
  if(need==='OUT'&&/Input only/.test(cap))return 'pin is input-only';if(need==='SDA'&&!/SDA/.test(cap))return 'use the SDA pin';if(need==='SCL'&&!/SCL/.test(cap))return 'use the SCL pin';if(need==='ADC'&&/ADC2/.test(cap))return 'ADC2 is unusable while Wi-Fi is on';return '';}
function renderPins(){const b=BOARDS[$('board').value];const warns=[];const used={};
  $('pinTbl').querySelector('tbody').innerHTML=assign.map((a,i)=>{const w=pinOk(a[0],a[1]);if(used[a[1]])warns.push(`${a[1]} used twice`);used[a[1]]=1;if(w)warns.push(`${a[0]} on ${a[1]}: ${w}`);
   return `<tr><td>${a[0]}</td><td class="mono">${a[1]}</td><td class="small">${b.pins[a[1]]}</td><td><button class="x" data-i="${i}">✕</button></td></tr>`;}).join('');
  $('pinTbl').querySelectorAll('.x').forEach(x=>x.onclick=()=>{assign.splice(+x.dataset.i,1);renderPins();});
  $('pinWarn').innerHTML=warns.length?'⚠ '+warns.join('<br>⚠ '):'<span class="ok">✓ No pin conflicts</span>';genIno();}
const pid={};
function simPID(){const kp=+$('kp').value,ki=+$('ki').value,kd=+$('kd').value,sp=+$('sp').value;Object.assign(pid,{kp,ki,kd,sp});
 ['kp','ki','kd','sp'].forEach(k=>$(k+'v').textContent=pid[k]);
 const dt=0.01,T=4,tau=0.25,K=3;let th=0,w=0,I=0,pe=sp;const ys=[],us=[];
 for(let t=0;t<T;t+=dt){const e=sp-th;let D=(e-pe)/dt;pe=e;let u=kp*e+ki*I+kd*D;const us0=u;u=Math.max(-255,Math.min(255,u));if(u===us0)I+=e*dt;
  w+=dt*(K*u-w)/tau;th+=w*dt;ys.push(th);us.push(u);}
 const c=$('pidPlot'),x=c.getContext('2d'),W=c.width,H=c.height;x.fillStyle='#0e1422';x.fillRect(0,0,W,H);
 const ymax=Math.max(sp*1.6,...ys)*1.05,ymin=Math.min(0,...ys);const Y=v=>H-25-(v-ymin)/(ymax-ymin)*(H-45),X=i=>40+i/ys.length*(W-50);
 x.strokeStyle='#1f2a40';x.fillStyle='#94a3b8';x.font='11px JetBrains Mono';for(let k=0;k<=4;k++){const v=ymin+(ymax-ymin)*k/4;x.beginPath();x.moveTo(40,Y(v));x.lineTo(W-10,Y(v));x.stroke();x.fillText(v.toFixed(0),4,Y(v)+4);}
 for(let s=0;s<=T;s++)x.fillText(s+'s',X(s/dt)-6,H-8);
 x.setLineDash([6,4]);x.strokeStyle='#f59e0b';x.beginPath();x.moveTo(40,Y(sp));x.lineTo(W-10,Y(sp));x.stroke();x.setLineDash([]);
 x.strokeStyle='rgba(167,139,250,.6)';x.beginPath();us.forEach((u,i)=>{const yy=H-25-(u+255)/510*(H-45);i?x.lineTo(X(i),yy):x.moveTo(X(i),yy);});x.stroke();
 x.strokeStyle='#38bdf8';x.lineWidth=2;x.beginPath();ys.forEach((v,i)=>i?x.lineTo(X(i),Y(v)):x.moveTo(X(i),Y(v)));x.stroke();x.lineWidth=1;
 x.fillStyle='#38bdf8';x.fillText('position (deg)',W-130,16);x.fillStyle='#f59e0b';x.fillText('setpoint',W-130,30);x.fillStyle='#a78bfa';x.fillText('PWM effort',W-130,44);
 const peak=Math.max(...ys),os=Math.max(0,(peak-sp)/sp*100);let ts=null;for(let i=ys.length-1;i>=0;i--)if(Math.abs(ys[i]-sp)>0.02*sp){ts=(i+1)*dt;break;}
 const rise=ys.findIndex(v=>v>=0.9*sp)*dt;
 $('pidStats').innerHTML=`Overshoot: <b class="${os>15?'bad':'ok'}">${os.toFixed(1)}%</b> · Rise (0→90%): ${rise>0?rise.toFixed(2)+' s':'n/a'} · 2% settle: ${ts===null?'0 s':ts>=T-dt?'not settled':ts.toFixed(2)+' s'} · Final error: ${(sp-ys[ys.length-1]).toFixed(2)}°`;genIno();}
['kp','ki','kd','sp'].forEach(k=>$(k).oninput=simPID);
function genIno(){const g=n=>{const a=assign.find(a=>a[0].startsWith(n));return a?a[1].replace('GPIO',''):'/*unassigned*/0';};const esp=$('board').value==='esp32';
 const code=`// ElectroLab Studio - PID motor position control
// Board: ${BOARDS[$('board').value].name}  |  generated ${new Date().toISOString().slice(0,10)}
const int PIN_PWM  = ${g('Motor PWM')};
const int PIN_IN1  = ${g('Motor DIR1')};
const int PIN_IN2  = ${g('Motor DIR2')};
const int PIN_ENCA = ${g('Encoder A')};
const int PIN_ENCB = ${g('Encoder B')};
const int PIN_LED  = ${g('Status LED')};

float Kp = ${pid.kp}, Ki = ${pid.ki}, Kd = ${pid.kd};
float setpointDeg = ${pid.sp};
const float COUNTS_PER_DEG = 1.0;   // encoder CPR / 360
volatile long encCount = 0;
float integral = 0, prevErr = 0;
unsigned long lastMs = 0;

void ${esp?'IRAM_ATTR ':''}onEncA() {
  encCount += digitalRead(PIN_ENCB) ? -1 : 1;
}

void setMotor(int u) {
  u = constrain(u, -255, 255);
  digitalWrite(PIN_IN1, u >= 0);
  digitalWrite(PIN_IN2, u < 0);
  ${esp?'analogWrite(PIN_PWM, abs(u));   // ESP32 core 3.x LEDC':'analogWrite(PIN_PWM, abs(u));'}
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_IN1, OUTPUT); pinMode(PIN_IN2, OUTPUT); pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_ENCA, INPUT${esp?'':'_PULLUP'}); pinMode(PIN_ENCB, INPUT${esp?'':'_PULLUP'});
  attachInterrupt(digitalPinToInterrupt(PIN_ENCA), onEncA, RISING);
  lastMs = millis();
}

void loop() {
  unsigned long now = millis();
  if (now - lastMs < 10) return;          // 100 Hz control loop
  float dt = (now - lastMs) / 1000.0; lastMs = now;
  noInterrupts(); long c = encCount; interrupts();
  float pos = c / COUNTS_PER_DEG;
  float err = setpointDeg - pos;
  float deriv = (err - prevErr) / dt; prevErr = err;
  float u = Kp * err + Ki * integral + Kd * deriv;
  if (u > -255 && u < 255) integral += err * dt;   // anti-windup
  setMotor((int)u);
  digitalWrite(PIN_LED, fabs(err) < 2.0);
  Serial.print(setpointDeg); Serial.print(','); Serial.println(pos);
}
`;$('ino').textContent=code;}
$('dlIno').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([$('ino').textContent],{type:'text/plain'}));a.download='electrolab_pid.ino';a.click();};
fillPins();defaultAssign();simPID();renderPins();

/* ================= 3. NEC PANEL + CONDUIT ================= */
const STD=[15,20,25,30,35,40,45,50,60,70,80,90,100,110,125,150];
const WIRE={15:'14 AWG',20:'12 AWG',25:'10 AWG',30:'10 AWG',35:'8 AWG',40:'8 AWG',45:'8 AWG',50:'8 AWG',60:'6 AWG',70:'4 AWG',80:'4 AWG',90:'3 AWG',100:'3 AWG',110:'2 AWG',125:'1 AWG',150:'1/0 AWG'};
let ckts=[];
function exPanel(){ckts=[['Kitchen SABC #1',1500,1,'Cont? no'],['Kitchen SABC #2',1500,1,'no'],['Bedroom lighting/recep',1200,1,'cont'],['Living room recep',1440,1,'no'],['Bathroom GFCI',1500,1,'no'],['Laundry',1500,1,'no'],['Dishwasher',1200,1,'no'],['Microwave',1500,1,'no'],['Range',8000,2,'no'],['Electric dryer',5000,2,'no'],['Water heater',4500,2,'cont'],['Heat pump / AC',5760,2,'cont'],['EV charger (Level 2)',7680,2,'cont']].map(c=>({name:c[0],va:c[1],poles:c[2],cont:c[3]==='cont'}));renderPanel();}
function renderPanel(){let A=0,B=0,tot=0,slot=1;
 const rows=ckts.map((c,i)=>{const V=c.poles===2?240:120;let amps=c.va/V*(c.cont?1.25:1);const brk=STD.find(s=>s>=amps)||'>150';const wire=WIRE[brk]||'Calc.';
  let ph;if(c.poles===2){A+=c.va/2;B+=c.va/2;ph='A+B';}else{if(A<=B){A+=c.va;ph='A';}else{B+=c.va;ph='B';}}tot+=c.va;const sl=c.poles===2?`${slot},${slot+2}`:slot;slot+=c.poles===2?4:2;if(slot>40)slot=2;
  return `<tr><td class="mono">${sl}</td><td><input data-i="${i}" data-k="name" value="${c.name}"></td><td><input type="number" data-i="${i}" data-k="va" value="${c.va}" style="width:70px"></td><td><select data-i="${i}" data-k="poles"><option ${c.poles==1?'selected':''}>1</option><option ${c.poles==2?'selected':''}>2</option></select></td><td><select data-i="${i}" data-k="cont"><option value="0">Non-cont.</option><option value="1" ${c.cont?'selected':''}>Cont. 125%</option></select></td><td class="mono">${brk}A ${c.poles}P</td><td class="mono">${wire}</td><td class="mono">${ph}</td><td><button class="x" data-i="${i}">✕</button></td></tr>`;}).join('');
 $('cktTbl').querySelector('tbody').innerHTML=rows;
 $('cktTbl').querySelectorAll('input,select').forEach(e=>e.onchange=()=>{const c=ckts[+e.dataset.i];const k=e.dataset.k;c[k]=k==='name'?e.value:k==='cont'?e.value==='1':+e.value;renderPanel();});
 $('cktTbl').querySelectorAll('.x').forEach(x=>x.onclick=()=>{ckts.splice(+x.dataset.i,1);renderPanel();});
 // simplified demand per 220.82 optional method (first 10 kVA @100%, remainder 40%)
 const dem=tot<=10000?tot:10000+(tot-10000)*0.4;const main=+$('mainA').value;const Ia=A/120,Ib=B/120,dA=dem/240;
 const imb=Math.abs(A-B)/Math.max(A,B,1)*100;
 $('panelSum').innerHTML=`Connected load: <b>${(tot/1000).toFixed(2)} kVA</b> · Phase A ${(A/1000).toFixed(2)} kVA (${Ia.toFixed(1)} A) · Phase B ${(B/1000).toFixed(2)} kVA (${Ib.toFixed(1)} A)<br>Phase imbalance: <b class="${imb>10?'bad':'ok'}">${imb.toFixed(1)}%</b> · Demand (220.82-style): <b>${(dem/1000).toFixed(2)} kVA → ${dA.toFixed(1)} A @ 240 V</b><br>Main ${main} A: <b class="${dA<=main*0.8?'ok':'bad'}">${(dA/main*100).toFixed(0)}% loaded ${dA<=main*0.8?'✓ OK':'⚠ consider upsizing service'}</b>`;}
$('addCkt').onclick=()=>{ckts.push({name:'New circuit',va:1000,poles:1,cont:false});renderPanel();};$('exPanel').onclick=exPanel;$('mainA').onchange=renderPanel;
const THHN={'14':.0097,'12':.0133,'10':.0211,'8':.0366,'6':.0507,'4':.0824,'3':.0973,'2':.1158,'1':.1562,'1/0':.1855,'2/0':.2223,'3/0':.2679,'4/0':.3237};
const COND={EMT:{'1/2"':.304,'3/4"':.533,'1"':.864,'1-1/4"':1.496,'1-1/2"':2.036,'2"':3.356},'PVC-40':{'1/2"':.285,'3/4"':.508,'1"':.832,'1-1/4"':1.453,'1-1/2"':1.986,'2"':3.291}};
let wires=[['12',3],['12',1]];
$('wSize').innerHTML=Object.keys(THHN).map(k=>`<option>${k}</option>`).join('');$('wSize').value='12';
function fillSizes(){$('cSize').innerHTML=Object.keys(COND[$('cType').value]).map(k=>`<option>${k}</option>`).join('');$('cSize').value='3/4"';}
function renderFill(){const area=COND[$('cType').value][$('cSize').value];let n=0,a=0;
 $('wTbl').querySelector('tbody').innerHTML=wires.map((w,i)=>{n+=w[1];a+=w[1]*THHN[w[0]];return `<tr><td>#${w[0]}</td><td>${w[1]}</td><td class="mono">${(w[1]*THHN[w[0]]).toFixed(4)}</td><td><button class="x" data-i="${i}">✕</button></td></tr>`;}).join('');
 $('wTbl').querySelectorAll('.x').forEach(x=>x.onclick=()=>{wires.splice(+x.dataset.i,1);renderFill();});
 const lim=n===1?53:n===2?31:40,pct=a/area*100;const ok=pct<=lim;
 let rec='';for(const[s,ar] of Object.entries(COND[$('cType').value]))if(a/ar*100<=lim){rec=s;break;}
 $('fillBar').style.width=Math.min(100,pct/lim*100)+'%';$('fillBar').style.background=ok?(pct>lim*.85?'#f59e0b':'#10b981'):'#f87171';
 const derate=n>3?(n<=6?'80%':n<=9?'70%':n<=20?'50%':'45%'):'none';
 $('fillOut').innerHTML=`${n} conductors · ${a.toFixed(4)} in² of ${area} in²<br>Fill: <b class="${ok?'ok':'bad'}">${pct.toFixed(1)}%</b> (limit ${lim}%) ${ok?'✓ PASS':'✕ OVERFILLED'}<br>Smallest compliant ${$('cType').value}: <b>${rec||'> 2"'}</b><br>310.15(C)(1) ampacity adj. (current-carrying): ${derate}`;}
$('addW').onclick=()=>{const q=Math.max(1,+$('wQty').value|0);wires.push([$('wSize').value,q]);renderFill();};$('cType').onchange=()=>{fillSizes();renderFill();};$('cSize').onchange=renderFill;
fillSizes();exPanel();renderFill();
