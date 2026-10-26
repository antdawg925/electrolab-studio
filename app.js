// ElectroLab Studio - Anthony Early
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.panel').forEach(e=>e.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active');window.dispatchEvent(new Event('resize'));});
const $=id=>document.getElementById(id);
const fmtc=(v,u)=>{const a=Math.abs(v);const [d,s]=a===0?[1,'']:a<1e-3?[1e-6,'µ']:a<1?[1e-3,'m']:a>=1e6?[1e6,'M']:a>=1e3?[1e3,'k']:[1,''];return (+(v/d).toPrecision(4))+' '+s+u;};
const fmt=(v,u)=>{const a=Math.abs(v);if(a===0)return '0 '+u;if(a<1e-3)return (v*1e6).toFixed(2)+' µ'+u;if(a<1)return (v*1e3).toFixed(3)+' m'+u;if(a>=1e3)return (v/1e3).toFixed(3)+' k'+u;return v.toFixed(3)+' '+u;};

/* ================= 1. SCHEMATIC + MNA ================= */
const SI={p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,m:1e-3,k:1e3,K:1e3,M:1e6,meg:1e6};
function parseSI(t){const m=String(t).trim().replace(/\s|Ω|ohms?|[VvAa]$/g,'').match(/^(-?\d*\.?\d+(?:e-?\d+)?)(meg|[pnuµmkKM])?$/);return m?parseFloat(m[1])*(m[2]?SI[m[2]]:1):NaN;}
let hist=[];const snap=()=>{hist.push(JSON.stringify(parts));if(hist.length>100)hist.shift();};
function undo(){if(hist.length){parts=JSON.parse(hist.pop());pending=null;draw();}}
const SVGH=440,G=25,svg=$('svg'),NS='http://www.w3.org/2000/svg';
let parts=[],tool='R',pending=null,uid=1;
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tool').forEach(x=>x.classList.remove('active'));b.classList.add('active');tool=b.dataset.t;pending=null;draw();});
const key=p=>p[0]+','+p[1];
// local->world for op-amp / ground: flip (fx: mirror x, fy: mirror y) then rotate rot*90° clockwise
function xf(p,lx,ly){if(p.fx)lx=-lx;if(p.fy)ly=-ly;for(let k=0;k<((p.rot||0)&3);k++){const t=lx;lx=-ly;ly=t;}return [p.x+lx,p.y+ly];}
function terms(p){if(p.t==='O')return [xf(p,-2,-1),xf(p,-2,1),xf(p,2,0)];if(p.t==='G')return [[p.x,p.y]];return [p.a,p.b];}
function rotatePart(p){if(p.a){const cx=Math.round((p.a[0]+p.b[0])/2),cy=Math.round((p.a[1]+p.b[1])/2);const r=q=>[cx-(q[1]-cy),cy+(q[0]-cx)];p.a=r(p.a);p.b=r(p.b);}else p.rot=((p.rot||0)+1)&3;}
function flipPart(p,vert){if(p.a){if(vert){const s2=p.a[1]+p.b[1];p.a=[p.a[0],s2-p.a[1]];p.b=[p.b[0],s2-p.b[1]];}else{const s2=p.a[0]+p.b[0];p.a=[s2-p.a[0],p.a[1]];p.b=[s2-p.b[0],p.b[1]];}}
  else{/* screen mirror: Mx∘R^k = R^-k∘Mx, My = R^2∘Mx */p.fx=!p.fx;p.rot=((vert?2:0)-(p.rot||0)+4)&3;}}
let hover=null;
function el(tag,at,parent=svg){const e=document.createElementNS(NS,tag);for(const k in at)e.setAttribute(k,at[k]);parent.appendChild(e);return e;}
function solve(){let sat=new Map();for(let it=0;it<8;it++){const r=solveLin(sat);if(r.err)return r;let ch=false;
  r.vs.forEach(p=>{if(p.t!=='O'||sat.has(p))return;const vo=r.V(terms(p)[2]),hi=p.vp??15,lo=p.vn??-15;if(vo>hi+1e-9){sat.set(p,hi);ch=true;}else if(vo<lo-1e-9){sat.set(p,lo);ch=true;}});
  if(!ch){r.sat=sat;return r;}}return solveLin(sat);}
function solveLin(sat){
  // union-find nodes
  const par={};const f=k=>{if(!(k in par))par[k]=k;while(par[k]!==k){par[k]=par[par[k]];k=par[k];}return k;};const u=(a,b)=>{par[f(a)]=f(b);};
  parts.forEach(p=>terms(p).forEach(t=>f(key(t))));
  const pts=[];parts.forEach(p=>terms(p).forEach(t=>pts.push(t)));
  parts.filter(p=>p.t==='W').forEach(p=>{u(key(p.a),key(p.b));const [ax,ay]=p.a,[bx,by]=p.b;pts.forEach(t=>{const cr=(bx-ax)*(t[1]-ay)-(by-ay)*(t[0]-ax);if(cr===0&&t[0]>=Math.min(ax,bx)&&t[0]<=Math.max(ax,bx)&&t[1]>=Math.min(ay,by)&&t[1]<=Math.max(ay,by))u(key(t),key(p.a));});});
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
    else{const [m,pl,o]=terms(p).map(ni);if(o>=0)A[o][r]+=1;if(sat.has(p)){if(o>=0)A[r][o]+=1;else A[r][r]+=1;z[r]=sat.get(p);}else{if(pl>=0)A[r][pl]+=1;if(m>=0)A[r][m]-=1;z[r]=0;}}});
  for(const p of parts)if(p.t==='V'&&ni(p.a)===ni(p.b))return {err:`Voltage source (${p.v} V) is shorted: both terminals are on the same node. Remove the wire across it.`};
  for(let i=0;i<n;i++)A[i][i]+=1e-12; // gmin: lets floating parts solve instead of crashing
  // gaussian elimination
  const M=A.map((row,i)=>[...row,z[i]]);
  for(let c=0;c<N;c++){let pv=c;for(let r=c+1;r<N;r++)if(Math.abs(M[r][c])>Math.abs(M[pv][c]))pv=r;if(Math.abs(M[pv][c])<1e-12)return {err:parts.some(p=>p.t==='O')?'Cannot solve: each op-amp needs negative feedback (a path from its output back to the − input) and its inputs wired into the circuit. Also check for two sources forcing the same node.':'Cannot solve: two voltage sources fight over the same node (parallel sources or a source loop).'};[M[c],M[pv]]=[M[pv],M[c]];
    for(let r=0;r<N;r++)if(r!==c){const k=M[r][c]/M[c][c];if(k)for(let j=c;j<=N;j++)M[r][j]-=k*M[c][j];}}
  const x=M.map((r,i)=>r[N]/r[i]);
  const adj={};const link=(a,b)=>{(adj[a]=adj[a]||[]).push(b);(adj[b]=adj[b]||[]).push(a);};parts.forEach(p=>{const ts=terms(p).map(t=>f(key(t)));for(let k=1;k<ts.length;k++)link(ts[0],ts[k]);});
  const reach=new Set([f('GND')]),st=[f('GND')];while(st.length){const c=st.pop();(adj[c]||[]).forEach(d=>{if(!reach.has(d)){reach.add(d);st.push(d);}});}
  const floating=roots.filter(r=>!reach.has(r));
  const V=t=>{const i=ni(t);return i<0?0:x[i];};
  const names={};roots.forEach((r,i)=>names[r]='N'+(i+1));names[f('GND')]='GND';
  return {floating,V,x,n,vs,nodeName:t=>names[f(key(t))],roots,idx,f};
}
function draw(){
  svg.innerHTML='';const w=svg.clientWidth||900,h=SVGH;
  for(let x=G;x<w;x+=G)for(let y=G;y<h;y+=G)el('circle',{cx:x,cy:y,r:1.2,fill:'#2a3550'});
  const s=solve();let C={R:'#f59e0b',V:'#38bdf8',I:'#a78bfa',W:'#94a3b8',O:'#10b981',G:'#94a3b8'};
  parts.forEach(p=>{const g=el('g',{});let col=C[p.t];
    if(p.t==='G'){const X=p.x*G,Y=p.y*G;const gg=el('g',{transform:`translate(${X},${Y}) rotate(${(p.rot||0)*90})`},g);el('line',{x1:0,y1:0,x2:0,y2:8,stroke:col,'stroke-width':2},gg);[14,9,4].forEach((l,i)=>el('line',{x1:-l/2*1.4,y1:8+i*4,x2:l/2*1.4,y2:8+i*4,stroke:col,'stroke-width':2},gg));}
    else if(p.t==='O'){const X=p.x*G,Y=p.y*G;const sv=s.sat&&s.sat.has(p)?s.sat.get(p):null;if(sv!==null)col='#f87171';
      const og=el('g',{transform:`translate(${X},${Y}) rotate(${(p.rot||0)*90}) scale(${p.fx?-1:1},${p.fy?-1:1})`,class:'opamp'+(sv!==null?' sat':'')},g);
      el('path',{d:`M${-G*1.4},${-G*1.6} L${-G*1.4},${G*1.6} L${G*1.4},0 Z`,fill:sv!==null?'rgba(248,113,113,.15)':'rgba(16,185,129,.08)',stroke:col,'stroke-width':2},og);
      el('line',{x1:-2*G,y1:-G,x2:-1.4*G,y2:-G,stroke:col,'stroke-width':2},og);el('line',{x1:-2*G,y1:G,x2:-1.4*G,y2:G,stroke:col,'stroke-width':2},og);el('line',{x1:1.4*G,y1:0,x2:2*G,y2:0,stroke:col,'stroke-width':2},og);
      [[-1,'−'],[1,'+']].forEach(([sy,ch])=>{const [tx,ty]=xf(p,-1.55,sy*1);const t=el('text',{x:tx*G-p.x*G+X,y:ty*G-p.y*G+Y+5,fill:col,'font-size':14,'text-anchor':'middle'},g);t.textContent=ch;});
      const rl=el('text',{x:X,y:Y+G*2.4,fill:'#f8fafc','font-size':11,'text-anchor':'middle',style:'cursor:pointer;font-family:JetBrains Mono',class:'oplab'},g);rl.textContent=`rails +${+(p.vp??15).toPrecision(4)}/${+(p.vn??-15).toPrecision(4)}V`;el('title',{},rl).textContent='Click to set supply rails';
      rl.onclick=e=>{if(tool==='X'||tool==='M'||tool==='T'||tool==='F')return;e.stopPropagation();const nv=prompt('Supply rails "+V, -V" (e.g. 15, -15 or 12,0):',`${p.vp??15}, ${p.vn??-15}`);if(nv===null)return;const [a,b]=nv.split(/[,\s]+/).filter(Boolean).map(parseSI);if(isNaN(a)||isNaN(b)||a<=b){alert('Enter two numbers with +V greater than −V, e.g. 15, -15.');return;}snap();p.vp=a;p.vn=b;draw();};
      if(sv!==null){const st=el('text',{x:X,y:Y-G*2,fill:'#f87171','font-size':12,'font-weight':'bold','text-anchor':'middle',class:'satlab'},g);st.textContent=`⚠ SATURATED ${sv>0?'+':''}${+sv.toPrecision(4)} V`;}}
    else{const [x1,y1]=p.a.map(v=>v*G),[x2,y2]=p.b.map(v=>v*G);const L=Math.hypot(x2-x1,y2-y1)||1,ux=(x2-x1)/L,uy=(y2-y1)/L,mx=(x1+x2)/2,my=(y1+y2)/2;
      if(p.t==='W')el('line',{x1,y1,x2,y2,stroke:col,'stroke-width':2},g);
      else{const bl=Math.min(18,L/2-2);el('line',{x1,y1,x2:mx-ux*bl,y2:my-uy*bl,stroke:col,'stroke-width':2},g);el('line',{x1:mx+ux*bl,y1:my+uy*bl,x2,y2,stroke:col,'stroke-width':2},g);
        const ang=Math.atan2(uy,ux)*180/Math.PI,b=el('g',{transform:`translate(${mx},${my}) rotate(${ang})`},g);
        if(p.t==='R'){let d=`M${-bl},0`;const seg=bl*2/6;for(let k=0;k<6;k++)d+=` L${-bl+seg*(k+.5)},${k%2?6:-6}`;d+=` L${bl},0`;el('path',{d,fill:'none',stroke:col,'stroke-width':2},b);}
        else{el('circle',{cx:0,cy:0,r:bl,fill:'#0e1422',stroke:col,'stroke-width':2},b);if(p.t==='V'){const t=el('text',{x:bl-11,y:4,fill:col,'font-size':12,transform:''},b);t.textContent='+';const t2=el('text',{x:-bl+4,y:4,fill:col,'font-size':12},b);t2.textContent='−';}else el('path',{d:`M-9,0 L7,0 M2,-5 L8,0 L2,5`,stroke:col,fill:'none','stroke-width':2},b);}
        const vert=Math.abs(uy)>Math.abs(ux);const lab=el('text',{x:vert?mx-uy*16:mx-uy*24,y:my+ux*24+4,fill:'#f8fafc','font-size':12,'text-anchor':vert?(uy>0?'end':'start'):'middle',class:'vlab',style:'cursor:pointer;font-family:JetBrains Mono'},g);
        lab.textContent=p.t==='R'?fmtc(p.v,'Ω'):p.t==='V'?(+p.v.toPrecision(6))+' V':fmt(p.v,'A');const tt=el('title',{},lab);tt.textContent='Click to edit value';
        lab.onclick=e=>{if(tool==='X'||tool==='M'||tool==='T'||tool==='F')return;e.stopPropagation();const u=p.t==='R'?'Ω':p.t==='V'?'V':'A';const nv=prompt(`New value in ${u} (SI suffixes OK: 4.7k, 2m, 1meg):`,p.v);if(nv===null)return;const v=parseSI(nv);if(isNaN(v)||(p.t==='R'&&v<=0)){alert(p.t==='R'?'Resistance must be a positive number, e.g. 1k or 470.':'Enter a number, e.g. 5 or 2m.');return;}snap();p.v=v;draw();};
        // current arrow
        if(!s.err){let i=null;if(p.t==='R')i=(s.V(p.a)-s.V(p.b))/p.v;if(p.t==='I')i=p.v;
          if(i!==null&&Math.abs(i)>1e-12){const d=i>0?1:-1,ax=mx+uy*14,ay=my-ux*14;el('path',{d:`M${ax-ux*d*10},${ay-uy*d*10} L${ax+ux*d*10},${ay+uy*d*10}`,stroke:'#f87171','stroke-width':2,'marker-end':'url(#arr)'},g);
            const ti=el('text',{x:vert?mx+uy*26:mx+uy*30,y:my-ux*30+4,fill:'#f87171','font-size':11,'text-anchor':vert?(uy>0?'start':'end'):'middle','font-family':'JetBrains Mono'},g);ti.textContent=fmtc(Math.abs(i),'A');}}}}
    g.style.cursor=tool==='X'?'not-allowed':tool==='M'?'move':(tool==='T'||tool==='F')?'pointer':'';g.onclick=e=>{if(tool==='X'){e.stopPropagation();snap();parts=parts.filter(q=>q!==p);draw();}else if(tool==='T'){e.stopPropagation();snap();rotatePart(p);draw();}else if(tool==='F'){e.stopPropagation();snap();flipPart(p,e.shiftKey);draw();}};
    g.onpointerenter=()=>{hover=p;};g.onpointerleave=()=>{if(hover===p)hover=null;};
    g.oncontextmenu=e=>{e.preventDefault();snap();parts=parts.filter(q=>q!==p);draw();};
    g.onpointerdown=e=>{if(tool!=='M')return;e.stopPropagation();e.preventDefault();snap();drag={p,x0:e.clientX,y0:e.clientY,orig:JSON.stringify(p)};};
    // fat invisible hit area
    if(!p.a)el('circle',{cx:p.x*G,cy:p.y*G,r:p.t==='O'?G*1.6:G*0.7,fill:'transparent'},g);if(p.a)el('line',{x1:p.a[0]*G,y1:p.a[1]*G,x2:p.b[0]*G,y2:p.b[1]*G,stroke:'transparent','stroke-width':14},g);});
  const defs=el('defs',{});const mk=el('marker',{id:'arr',markerWidth:8,markerHeight:8,refX:6,refY:4,orient:'auto'},defs);el('path',{d:'M0,0 L8,4 L0,8 Z',fill:'#f87171'},mk);
  // node labels
  const out=$('solOut');
  if(!parts.length){out.innerHTML='<span class="small">Empty canvas. Load an example from the toolbar, or pick a part (shortcut keys R V I W G O; hover a part and press R to rotate, F / Shift+F to flip) and click two grid points to place it. Add a Ground, then results appear here.</span>';}
  else if(s.err){out.innerHTML='<span class="warn">'+s.err+'</span>';}
  else{const seen={};parts.forEach(p=>terms(p).forEach(t=>{const nm=s.nodeName(t);if(nm==='GND'||seen[nm])return;seen[nm]=1;const tx=el('text',{x:t[0]*G+5,y:t[1]*G-6,fill:'#38bdf8','font-size':11,'font-family':'JetBrains Mono'});tx.textContent=nm+' '+(+s.V(t).toFixed(3))+' V';}));
    let h='<b>Node voltages</b><br>';Object.keys(seen).sort((a,b)=>+a.slice(1)-+b.slice(1)).forEach(nm=>{const r=s.roots[+nm.slice(1)-1];h+=nm+' = '+s.x[s.idx[r]].toFixed(4)+' V<br>';});
    h+='<br><b>Branch currents</b> (direction shown by red arrows)<br>';let ri=1,vi=0;
    parts.forEach(p=>{if(p.t==='R'){const i=(s.V(p.a)-s.V(p.b))/p.v;const A=s.nodeName(p.a),B=s.nodeName(p.b);h+=`R${ri++} ${fmt(p.v,'Ω')}: ${fmt(Math.abs(i),'A')} ${i>=0?A+'→'+B:B+'→'+A}<br>`;}});
    s.vs.forEach((p,k)=>{const i=s.x[s.n+k];if(p.t==='O'&&s.sat.has(p))h+=`<span class="bad">⚠ Op-amp output saturated at ${s.sat.get(p)} V rail (clipped; inputs no longer equal). </span>`;h+=(p.t==='V'?`V source ${p.v} V `:'Op-amp output ')+(-i>=0?'sources ':'sinks ')+fmt(Math.abs(i),'A')+'<br>';});
    if(s.floating.length)h='<div class="warn">⚠ '+s.floating.length+' node(s) not connected to ground; parts there are floating (shown as ~0 V, no current). Wire them into the circuit.</div>'+h;
    out.innerHTML=h;}
  if(pending){el('circle',{cx:pending[0]*G,cy:pending[1]*G,r:5,fill:'#f59e0b'});}
}
svg.onclick=e=>{const r=svg.getBoundingClientRect();const p=[Math.round((e.clientX-r.left)/G),Math.round((e.clientY-r.top)/G)];
  if(tool==='X'||tool==='M'||tool==='T'||tool==='F'||justDragged){justDragged=false;return;}snap();if(tool==='G'){parts.push({t:'G',x:p[0],y:p[1]});draw();return;}if(tool==='O'){parts.push({t:'O',x:p[0],y:p[1]});draw();return;}
  if(!pending){hist.pop();pending=p;draw();return;}if(key(pending)===key(p)){hist.pop();pending=null;draw();return;}
  parts.push({t:tool,a:pending,b:p,v:tool==='R'?1000:tool==='V'?5:0.001});pending=null;draw();};
function exInv(){parts=[{t:'V',a:[4,10],b:[4,6],v:2},{t:'G',x:4,y:10},{t:'R',a:[4,6],b:[10,6],v:1000},{t:'W',a:[10,6],b:[12,6]},{t:'W',a:[10,6],b:[10,3]},{t:'R',a:[10,3],b:[18,3],v:4700},{t:'W',a:[18,3],b:[18,7]},
  {t:'O',x:14,y:7},{t:'W',a:[12,8],b:[12,10]},{t:'G',x:12,y:10},{t:'W',a:[16,7],b:[18,7]},{t:'W',a:[18,7],b:[22,7]},{t:'R',a:[22,7],b:[22,11],v:10000},{t:'G',x:22,y:11}];draw();}
function exDiv(){parts=[{t:'V',a:[4,12],b:[4,4],v:12},{t:'G',x:4,y:12},{t:'R',a:[4,4],b:[12,4],v:2000},{t:'R',a:[12,4],b:[12,12],v:3000},{t:'R',a:[12,4],b:[20,4],v:1000},{t:'R',a:[20,4],b:[20,12],v:2000},{t:'I',a:[28,12],b:[28,4],v:0.002},{t:'W',a:[20,4],b:[28,4]},{t:'W',a:[4,12],b:[12,12]},{t:'W',a:[12,12],b:[20,12]},{t:'W',a:[20,12],b:[28,12]}];draw();}
$('exInv').onclick=()=>{snap();exInv();};$('exDiv').onclick=()=>{snap();exDiv();};$('clr').onclick=()=>{if(parts.length){snap();parts=[];pending=null;draw();}};$('undo').onclick=undo;
let drag=null,justDragged=false;
window.addEventListener('pointermove',e=>{if(!drag)return;const dx=Math.round((e.clientX-drag.x0)/G),dy=Math.round((e.clientY-drag.y0)/G);const o=JSON.parse(drag.orig),p=drag.p;if(o.a){p.a=[o.a[0]+dx,o.a[1]+dy];p.b=[o.b[0]+dx,o.b[1]+dy];}else{p.x=o.x+dx;p.y=o.y+dy;}draw();});
window.addEventListener('pointerup',()=>{if(drag){if(drag.orig===JSON.stringify(drag.p))hist.pop();drag=null;justDragged=true;setTimeout(()=>justDragged=false,0);}});
function setTool(t){document.querySelectorAll('.tool').forEach(x=>x.classList.toggle('active',x.dataset.t===t));tool=t;pending=null;draw();}
document.addEventListener('keydown',e=>{if(!$('sch').classList.contains('active')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const k=e.key;
  if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='z'){e.preventDefault();undo();return;}if(e.ctrlKey||e.metaKey||e.altKey)return;
  const hp=hover&&parts.includes(hover)?hover:null;
  if(hp&&k.toLowerCase()==='r'){e.preventDefault();snap();rotatePart(hp);draw();return;}
  if(hp&&k.toLowerCase()==='f'){e.preventDefault();snap();flipPart(hp,e.shiftKey);draw();return;}
  const m={t:'T',f:'F',r:'R',v:'V',i:'I',w:'W',g:'G',o:'O',m:'M',x:'X',delete:'X',backspace:'X'}[k.toLowerCase()];if(m){e.preventDefault();setTool(m);}if(k==='Escape'){pending=null;draw();}});window.addEventListener('resize',()=>{if($('sch').classList.contains('active'))draw();});
exInv();
{const ix=$('intro');let gone=false;try{gone=localStorage.getItem('elIntro')==='x';}catch(e){}if(gone)ix.remove();else $('introX').onclick=()=>{ix.remove();try{localStorage.setItem('elIntro','x');}catch(e){}};}

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
 const c=$('pidPlot'),dpr=Math.min(2,window.devicePixelRatio||1),W=c.clientWidth||640,H=300;c.width=W*dpr;c.height=H*dpr;c.style.height=H+'px';const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle='#0e1422';x.fillRect(0,0,W,H);
 const ymax=Math.max(sp*1.6,...ys)*1.05,ymin=Math.min(0,...ys);const Y=v=>H-25-(v-ymin)/(ymax-ymin)*(H-45),X=i=>40+i/ys.length*(W-50);
 x.strokeStyle='#1f2a40';x.fillStyle='#94a3b8';x.font='12px JetBrains Mono';for(let k=0;k<=4;k++){const v=ymin+(ymax-ymin)*k/4;x.beginPath();x.moveTo(40,Y(v));x.lineTo(W-10,Y(v));x.stroke();x.fillText(v.toFixed(0),4,Y(v)+4);}
 for(let s=0;s<=T;s++)x.fillText(s+'s',X(s/dt)-6,H-8);
 x.setLineDash([6,4]);x.strokeStyle='#f59e0b';x.beginPath();x.moveTo(40,Y(sp));x.lineTo(W-10,Y(sp));x.stroke();x.setLineDash([]);
 x.strokeStyle='rgba(167,139,250,.6)';x.beginPath();us.forEach((u,i)=>{const yy=H-25-(u+255)/510*(H-45);i?x.lineTo(X(i),yy):x.moveTo(X(i),yy);});x.stroke();
 x.strokeStyle='#38bdf8';x.lineWidth=2;x.beginPath();ys.forEach((v,i)=>i?x.lineTo(X(i),Y(v)):x.moveTo(X(i),Y(v)));x.stroke();x.lineWidth=1;
 [['#38bdf8','Position (deg)'],['#f59e0b','Setpoint'],['#a78bfa','PWM effort (scaled)']].forEach(([cl,t],k)=>{x.fillStyle=cl;x.fillRect(W-170,10+k*17,10,3);x.fillText(t,W-154,16+k*17);});
 const peak=Math.max(...ys),os=Math.max(0,(peak-sp)/sp*100);let ts=null;for(let i=ys.length-1;i>=0;i--)if(Math.abs(ys[i]-sp)>0.02*sp){ts=(i+1)*dt;break;}
 const rise=ys.findIndex(v=>v>=0.9*sp)*dt;
 $('pidStats').innerHTML=`Overshoot: <b class="${os>15?'bad':'ok'}">${os.toFixed(1)}%</b> · Rise (0→90%): ${rise>0?rise.toFixed(2)+' s':'n/a'} · 2% settle: ${ts===null?'0 s':ts>=T-dt?'not settled':ts.toFixed(2)+' s'} · Final error: ${(sp-ys[ys.length-1]).toFixed(2)}°`;genIno();}
['kp','ki','kd','sp'].forEach(k=>$(k).oninput=simPID);window.addEventListener('resize',()=>{if($('ard').classList.contains('active'))simPID();});
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
  let ph;if(c.poles===2){A+=c.va/2;B+=c.va/2;ph='A+B';}else{if(A<=B){A+=c.va;ph='A';}else{B+=c.va;ph='B';}}tot+=c.va;const sl=i+1;
  return `<tr><td class="mono">${sl}</td><td><input data-i="${i}" data-k="name" value="${c.name.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"></td><td><input type="number" data-i="${i}" data-k="va" value="${c.va}" style="width:70px"></td><td><select data-i="${i}" data-k="poles"><option ${c.poles==1?'selected':''}>1</option><option ${c.poles==2?'selected':''}>2</option></select></td><td><select data-i="${i}" data-k="cont"><option value="0">Non-cont.</option><option value="1" ${c.cont?'selected':''}>Cont. 125%</option></select></td><td class="mono">${brk}A ${c.poles}P</td><td class="mono">${wire}</td><td class="mono">${ph}</td><td><button class="x" data-i="${i}">✕</button></td></tr>`;}).join('');
 $('cktTbl').querySelector('tbody').innerHTML=rows||'<tr><td colspan=9 class="small">No circuits. Click + Circuit or Load Example House.</td></tr>';
 $('cktTbl').querySelectorAll('input,select').forEach(e=>e.onchange=()=>{const c=ckts[+e.dataset.i];const k=e.dataset.k;c[k]=k==='name'?e.value:k==='cont'?e.value==='1':+e.value;renderPanel();});
 $('cktTbl').querySelectorAll('.x').forEach(x=>x.onclick=()=>{ckts.splice(+x.dataset.i,1);renderPanel();});
 // simplified demand per 220.82 optional method (first 10 kVA @100%, remainder 40%)
 const dem=tot<=10000?tot:10000+(tot-10000)*0.4;const main=Math.max(1,+$('mainA').value||200);const Ia=A/120,Ib=B/120,dA=dem/240;
 const imb=Math.abs(A-B)/Math.max(A,B,1)*100;
 $('panelSum').innerHTML=`Connected load: <b>${(tot/1000).toFixed(2)} kVA</b> · Phase A ${(A/1000).toFixed(2)} kVA (${Ia.toFixed(1)} A) · Phase B ${(B/1000).toFixed(2)} kVA (${Ib.toFixed(1)} A)<br>Phase imbalance: <b class="${imb>10?'bad':'ok'}">${imb.toFixed(1)}%</b> · Demand (220.82-style): <b>${(dem/1000).toFixed(2)} kVA → ${dA.toFixed(1)} A @ 240 V</b><br>Main ${main} A: <b class="${dA<=main*0.8?'ok':'bad'}">${(dA/main*100).toFixed(0)}% loaded ${dA<=main*0.8?'✓ OK':'⚠ consider upsizing service'}</b>`;}
$('addCkt').onclick=()=>{ckts.push({name:'New circuit',va:1000,poles:1,cont:false});renderPanel();};$('exPanel').onclick=exPanel;$('mainA').onchange=renderPanel;
const THHN={'14':.0097,'12':.0133,'10':.0211,'8':.0366,'6':.0507,'4':.0824,'3':.0973,'2':.1158,'1':.1562,'1/0':.1855,'2/0':.2223,'3/0':.2679,'4/0':.3237};
const COND={EMT:{'1/2"':.304,'3/4"':.533,'1"':.864,'1-1/4"':1.496,'1-1/2"':2.036,'2"':3.356},'PVC-40':{'1/2"':.285,'3/4"':.508,'1"':.832,'1-1/4"':1.453,'1-1/2"':1.986,'2"':3.291}};
let wires=[['12',3],['12',1]];
$('wSize').innerHTML=Object.keys(THHN).map(k=>`<option>${k}</option>`).join('');$('wSize').value='12';
function fillSizes(){$('cSize').innerHTML=Object.keys(COND[$('cType').value]).map(k=>`<option>${k}</option>`).join('');$('cSize').value='3/4"';}
function renderFill(){const area=COND[$('cType').value][$('cSize').value];let n=0,a=0;
 $('wTbl').querySelector('tbody').innerHTML=(wires.length?'':'<tr><td colspan=4 class="small">No conductors yet. Pick a size &amp; qty and click Add THHN.</td></tr>')+wires.map((w,i)=>{n+=w[1];a+=w[1]*THHN[w[0]];return `<tr><td>#${w[0]}</td><td>${w[1]}</td><td class="mono">${(w[1]*THHN[w[0]]).toFixed(4)}</td><td><button class="x" data-i="${i}">✕</button></td></tr>`;}).join('');
 $('wTbl').querySelectorAll('.x').forEach(x=>x.onclick=()=>{wires.splice(+x.dataset.i,1);renderFill();});
 if(!n){$('fillBar').style.width='0';$('fillOut').innerHTML='Add conductors to compute fill.';return;}const lim=n===1?53:n===2?31:40,pct=a/area*100;const ok=pct<=lim;
 let rec='';for(const[s,ar] of Object.entries(COND[$('cType').value]))if(a/ar*100<=lim){rec=s;break;}
 $('fillBar').style.width=Math.min(100,pct/lim*100)+'%';$('fillBar').style.background=ok?(pct>lim*.85?'#f59e0b':'#10b981'):'#f87171';
 const derate=n>3?(n<=6?'80%':n<=9?'70%':n<=20?'50%':'45%'):'none';
 $('fillOut').innerHTML=`${n} conductors · ${a.toFixed(4)} in² of ${area} in²<br>Fill: <b class="${ok?'ok':'bad'}">${pct.toFixed(1)}%</b> (limit ${lim}%) ${ok?'✓ PASS':'✕ OVERFILLED'}<br>Smallest compliant ${$('cType').value}: <b>${rec||'> 2"'}</b><br>310.15(C)(1) ampacity adj. (current-carrying): ${derate}`;}
$('addW').onclick=()=>{const q=Math.max(1,+$('wQty').value|0);wires.push([$('wSize').value,q]);renderFill();};$('cType').onchange=()=>{fillSizes();renderFill();};$('cSize').onchange=renderFill;
fillSizes();exPanel();renderFill();
