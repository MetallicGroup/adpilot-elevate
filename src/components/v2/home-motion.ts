// @ts-nocheck
/**
 * Motion for the v2 marketing home page: scroll reveals, gradient ribbons, hero phone
 * sequence, pinned "how it works" scenes and the looping WhatsApp windows.
 * Imperative on purpose: it drives plain DOM inside containers React leaves empty,
 * so nothing here causes a re-render. Call the returned function to stop everything.
 */
export function initHomeMotion(root: HTMLElement): () => void {
let alive=true;
const ac=new AbortController();
const observers=[];
const IO=(cb,o)=>{const x=new IntersectionObserver(cb,o);observers.push(x);return x};
const $=(s,r=root)=>r.querySelector(s), $$=(s,r=root)=>[...r.querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
// After dispose the promise never resolves, which parks every running sequence.
const sleep=ms=>new Promise(r=>setTimeout(()=>{if(alive)r()},ms));
const ro=n=>String(n).replace('.',',');

/* ---------- reveal (visible at rest; only below-fold items wait) ---------- */
const io=IO(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('r-wait');io.unobserve(e.target);countIn(e.target)}}),{rootMargin:'0px 0px -8% 0px'});
function armReveal(root){ $$('[data-r]',root).forEach(el=>{ if(el._armed)return; el._armed=1;
  if(!RM&&el.getBoundingClientRect().top>innerHeight*.92)el.classList.add('r-wait'); io.observe(el)}) }
function countIn(root){ $$('[data-count]',root).concat(root.matches&&root.matches('[data-count]')?[root]:[]).forEach(el=>{
  if(el._c||RM)return; el._c=1; const to=+el.dataset.count,dec=+(el.dataset.dec||0),t0=performance.now();
  (function f(t){const p=Math.min(1,(t-t0)/1400),e=1-Math.pow(1-p,4);el.textContent=ro((to*e).toFixed(dec));if(p<1)requestAnimationFrame(f)})(t0) }) }

/* ---------- ribbon canvases ---------- */
const ribbons=$$('[data-ribbon]').map(c=>({c,x:c.getContext('2d'),on:false}));
const rio=IO(es=>es.forEach(e=>{const r=ribbons.find(r=>r.c===e.target);if(r)r.on=e.isIntersecting}));
ribbons.forEach(r=>rio.observe(r.c));
function sizeCanvases(){ribbons.forEach(r=>{const b=r.c.getBoundingClientRect();if(b.width){r.c.width=Math.round(b.width/3);r.c.height=Math.round(b.height/3)}})}
const COL=[[47,107,255],[107,61,255],[225,58,212],[255,140,90]];
function drawRibbons(t){
  ribbons.forEach(r=>{ if(!r.on||!r.c.width)return; const {x,c}=r,W=c.width,H=c.height; x.clearRect(0,0,W,H); x.globalCompositeOperation='lighter';
    for(let i=0;i<4;i++){ const g=x.createLinearGradient(0,0,W,0),a=COL[i],b=COL[(i+1)%4];
      g.addColorStop(0,`rgba(${a},0)`);g.addColorStop(.35,`rgba(${a},.55)`);g.addColorStop(.7,`rgba(${b},.6)`);g.addColorStop(1,`rgba(${b},.1)`);
      x.fillStyle=g;x.beginPath();
      const base=H*(.28+i*.12),amp=H*(.12+i*.02),sp=.00022*(i+1.4),ph=i*1.7;
      for(let px=0;px<=W;px+=8){const u=px/W;const y=base+Math.sin(u*4.2+t*sp+ph)*amp+Math.sin(u*9+t*sp*1.7+ph)*amp*.3-u*H*.22;px?x.lineTo(px,y):x.moveTo(px,y)}
      for(let px=W;px>=0;px-=8){const u=px/W;const y=base+H*.16+Math.sin(u*3.4+t*sp*1.3+ph+1)*amp*.9-u*H*.2;x.lineTo(px,y)}
      x.closePath();x.fill(); } });
}

/* ---------- scroll: nav, parallax, pinned steps ---------- */
const nav=$('#nav'),track=$('#track'),steps=$$('.pin .step'),pcards=$$('#pside .card'),pinBar=$('#pinBar');
let pinIdx=-1;
function onScroll(){
  nav.classList.toggle('on',scrollY>30);
  if(!RM&&innerWidth>960)$$('[data-p]').forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom<-200||r.top>innerHeight+200)return;
    const d=(r.top+r.height/2-innerHeight/2)*parseFloat(el.dataset.p);el.style.translate=`0 ${d.toFixed(1)}px`});
  if(track&&innerWidth>900){const r=track.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/(r.height-innerHeight)));
    pinBar.style.width=(p*100)+'%';setPin(Math.min(steps.length-1,Math.floor(p*steps.length)))}
}
function setPin(i){ if(i===pinIdx)return; pinIdx=i;
  steps.forEach((s,k)=>s.classList.toggle('on',k===i)); pcards.forEach((s,k)=>s.classList.toggle('on',k===i)); if(pinVis)pinScene(i,RM); }
window.addEventListener('scroll',onScroll,{passive:true,signal:ac.signal});
window.addEventListener('resize',()=>{sizeCanvases();onScroll()},{signal:ac.signal});

/* ---------- hero pointer parallax ---------- */
const hero=$('#hero');
hero.addEventListener('pointermove',e=>{if(RM)return;const r=hero.getBoundingClientRect();hero.style.setProperty('--mx',((e.clientX-r.left)/r.width-.5).toFixed(3));hero.style.setProperty('--my',((e.clientY-r.top)/r.height-.5).toFixed(3))});

/* ---------- device chrome + hero sequence ---------- */
const SB=`<div class="sbar"><span>9:41</span><span style="display:flex;gap:5px;align-items:center"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="2"/><rect x="24" y="4" width="2" height="4" rx="1" opacity=".5"/></svg></span></div><div class="island"></div>`;
const WAH=`<div class="hd"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><span class="logo"></span><div style="flex:1"><b>AdPilot</b><small>online</small></div><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1C10.7 20 4 13.3 4 5a1 1 0 011-1z"/></svg></div>`;
const WIC=`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5a8.5 8.5 0 00-7.3 12.8L3.5 20.500l4.300-1.100A8.500 8.500 0 1012 3.500z"/><path d="M9 9.500c.300 2.600 2.200 4.700 5 5.300"/></svg>`;
const CRE=`<div class="cre pic" role="img" aria-label="Reclama salonului" style="background:var(--img-salon) center/cover"></div>`;
const hs=$('#hscr');
hs.innerHTML=SB+`<div class="appl wa">${WAH}<div class="body" id="wbody"></div><div class="inp"><div class="f" id="winp"></div><div class="s" id="wsend"><svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l11 2-11 2z"/></svg></div></div></div>
<div class="appl fb"><div class="hd"><b>facebook</b><span><i></i><i></i></span></div><div class="feed"><div class="tr" id="ftr">
<div class="post"><div class="ph"><span class="sk-a"></span><div style="flex:1"><div class="sk" style="width:46%;margin:0 0 6px"></div><div class="sk" style="width:26%;margin:0"></div></div></div><div class="sk" style="width:80%"></div><div class="sk img"></div></div>
<div class="post"><div class="ph"><span class="pa">SE</span><div><b>Salon Eleganza</b><small>Sponsorizat · 🌐</small></div></div><div class="tx">Părul tău merită o pauză. Programează-te în 30 de secunde și ai 20% reducere la prima vizită.</div>${CRE}<div class="lk"><div><b>Programează-te azi</b></div><em>Rezervă acum</em></div><div class="rx"><span>👍❤️ <span id="fbLikes">104</span></span><span>14 comentarii</span></div><div class="ac"><span>Îmi place</span><span>Comentează</span><span>Distribuie</span></div></div>
</div><div class="fly" id="fly"></div></div></div><div class="nts" id="nts"></div><div class="glare"></div>`;
const wbody=$('#wbody'),winp=$('#winp'),wsend=$('#wsend'),ftr=$('#ftr'),nts=$('#nts');
const CAPS=['Îi scrii pe WhatsApp','AdPilot creează reclama','Live pe Facebook, Instagram și TikTok','Clienții îți scriu'];
function cap(i){$('#capN').textContent=(i+1)+'/4';$('#capT').outerHTML=`<span id="capT">${CAPS[i]}</span>`}
function wb(html,dir,cls=''){const d=document.createElement('div');d.className=`wb ${dir} ${cls}`;d.innerHTML=html+'<time>9:41</time>';wbody.append(d);return d}
const CHECK=['📍 Cluj-Napoca, femei 25–45','💰 Buget: 50 lei pe zi','✍️ 3 texte de reclamă','🎬 Clip și poze generate cu AI'];
function waFinal(){ wbody.innerHTML='';wbody.classList.add('static');
  wb('Vreau mai multe programări la salon','out');wb('Mă ocup. Pregătesc campania acum.','in');
  wb(`<div class="wl">${CHECK.map(c=>`<div>${c}</div>`).join('')}</div>`,'in');
  wb(CRE+'<p>Reclama e gata. O lansez?</p>','in','ad');wb('Da 👍','out');
  wb('✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span><span>TikTok</span></div>','in'); }
async function typeSend(t){ winp.classList.add('typing');for(const ch of t){winp.textContent+=ch;await sleep(26)} await sleep(350);
  wsend.classList.add('hit');await sleep(130);wsend.classList.remove('hit');winp.textContent='';winp.classList.remove('typing');wb(t,'out') }
async function botTyping(ms){const t=document.createElement('div');t.className='wtyp';t.innerHTML='<i></i><i></i><i></i>';wbody.append(t);await sleep(ms);t.remove()}
function count(el,to,ms,fmt=v=>v.toLocaleString('ro-RO')){const t0=performance.now();(function f(t){const p=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(to*e));if(p<1)requestAnimationFrame(f)})(t0)}
function react(){const s=document.createElement('span');s.textContent=Math.random()<.5?'👍':'❤️';s.style.left=(12+Math.random()*70)+'%';s.style.setProperty('--rot',(Math.random()*40-20)+'deg');$('#fly').append(s);setTimeout(()=>s.remove(),2000)}
function notif(n,q){const d=document.createElement('div');d.className='nt';d.innerHTML=`<span class="wi">${WIC}</span><div><b>Client nou · ${n}</b>${q}</div><small>acum</small>`;nts.append(d);return d}
async function heroLoop(){
  waFinal(); if(RM)return; await sleep(3000);
  for(;;){
    /* 1 — write */
    cap(0);hs.className='scr s-wa';ftr.style.transform='';wbody.classList.remove('static');wbody.innerHTML='';await sleep(700);
    await typeSend('Vreau mai multe programări la salon');
    await botTyping(900);wb('Mă ocup. Pregătesc campania acum.','in');
    /* 2 — AI builds */
    cap(1);await sleep(500);
    const l=wb('<div class="wl"></div>','in').querySelector('.wl');
    for(const c of CHECK){const d=document.createElement('div');d.textContent=c;l.append(d);await sleep(520)}
    await botTyping(1100);wb(CRE+'<p>Reclama e gata. O lansez?</p>','in','ad');await sleep(1300);
    await typeSend('Da 👍');await botTyping(700);
    wb('✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span><span>TikTok</span></div>','in');await sleep(1500);
    /* 3 — live on Facebook */
    cap(2);hs.className='scr s-fb';$('#fbLikes').textContent='0';await sleep(1000);
    ftr.style.transform='translateY(-168px)';await sleep(900);
    count($('#fbLikes'),104,2600);count($('#reach'),12480,3200);
    for(let i=0;i<9;i++){react();await sleep(300)}
    await sleep(600);
    /* 4 — clients write */
    cap(3);
    const a=notif('Andreea M.','„Aveți liber sâmbătă?”');await sleep(1300);
    const b=notif('Ioana P.','„Cât costă un tuns și coafat?”');await sleep(1300);
    const c=notif('Mihai D.','„Aș vrea o programare mâine.”');await sleep(2600);
    [a,b,c].forEach(n=>n.classList.add('out'));await sleep(600);nts.innerHTML='';
  }
}

/* pinned phone: one animated scene per step = the real onboarding, in order */
const PS=$('#pinScr');
const PHOTO=`<div class="cth"><i style="background:var(--img-dental) 22% 30%/cover"></i><i style="background:var(--img-dental) 72% 40%/cover"></i><i style="background:var(--img-dental) 46% 85%/cover"></i></div>`;
const CRED=`<div class="cre pic" role="img" aria-label="Reclama cabinetului" style="background:var(--img-dental) center/cover;aspect-ratio:720/568"></div>`;
const ICO_FB=`<svg viewBox="0 0 24 24" fill="#fff"><path d="M13.500 22v-8h2.700l.400-3.200h-3.100V8.700c0-.900.300-1.600 1.600-1.600h1.700V4.200c-.300 0-1.300-.100-2.500-.100-2.500 0-4.100 1.500-4.100 4.200v2.500H7.400V14h2.800v8h3.300z"/></svg>`;
const ICO_TT=`<svg viewBox="0 0 24 24" fill="#fff"><path d="M16.500 3a4.600 4.600 0 003.500 3.900v3a7.600 7.600 0 01-3.500-1v6.300a5.700 5.700 0 11-5.700-5.700c.300 0 .600 0 .900.100v3.100a2.700 2.700 0 101.800 2.500V3h3z"/></svg>`;
const CLIPSVG=`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11.500-8.600 8.600a5.500 5.500 0 01-7.800-7.800l9-9a3.700 3.700 0 015.200 5.200l-9 9a1.800 1.800 0 01-2.600-2.600l8.300-8.300"/></svg>`;
PS.className='scr s-n';
PS.innerHTML=SB+`
<div class="appl pw" id="pw">
  <div class="pwv on" id="vNum"><span class="pbr"><span class="logo"></span>AdPilot</span><span class="peb">ÎNCEPE GRATUIT</span><h4>Pune numărul tău de <b class="gtext">WhatsApp</b></h4><p class="psub">Acolo primești clipul, pozele și clienții. Fără parolă.</p>
    <div class="pfield"><span class="pre"><i class="ro"></i>+40</span><span class="pval" id="pNum"></span></div>
    <div class="pchk" id="pChk"><i></i><span>Sunt de acord să primesc mesaje pe WhatsApp.</span></div>
    <div class="pbtn" id="pBtn1">Trimite codul pe WhatsApp</div></div>
  <div class="pwv" id="vCode"><span class="pbr"><span class="logo"></span>AdPilot</span><span class="peb">CONFIRMĂ NUMĂRUL</span><h4>Ți-am trimis un <b class="gtext">cod</b></h4><p class="psub">Cele 6 cifre primite pe WhatsApp.</p>
    <div class="pcodes" id="pCodes"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="phint" id="pHint">Verific codul…</div></div>
  <div class="pwv" id="vNiche"><span class="pbr"><span class="logo"></span>AdPilot</span><span class="peb">DESPRE TINE</span><h4>Ce fel de <b class="gtext">afacere</b> ai?</h4><p class="psub">Două-trei cuvinte sunt de ajuns.</p>
    <div class="pfield"><span class="pval" id="pNiche"></span></div>
    <div class="pchips" id="pNicheChips"><span>Service auto</span><span>Salon</span><span>Cabinet stomatologic</span><span>Restaurant</span></div>
    <div class="pbtn" id="pBtn2">Continuă</div></div>
  <div class="pwv" id="vGoal"><span class="pbr"><span class="logo"></span>AdPilot</span><span class="peb">CE ÎȚI DOREȘTI</span><h4>Ce vrei să <b class="gtext">primești</b> din reclame?</h4>
    <div class="pgoals" id="pGoals"><div><b>Apeluri</b><small>Te sună direct</small></div><div><b>Formulare</b><small>Nume și telefon</small></div><div><b>Vizite pe site</b><small>Click-uri</small></div><div><b>Vânzări online</b><small>Comenzi</small></div></div></div>
  <div class="pnts" id="pnts"></div>
</div>
<div class="appl pwc" id="pwc">
  <div class="chd"><span class="av"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 12.500 20 5l-4.500 14-3.500-5.500L4 12.500Zm8 1L20 5"/></svg></span><div><b>Asistent AdPilot</b><small>● online</small></div></div>
  <div class="cbody" id="cBody"></div>
  <div class="cinp"><div class="cptr" id="cPtr">Trimite pozele aici</div><span class="cclip" id="cClip">${CLIPSVG}</span><div class="cf">Scrie mesajul tău…</div></div>
</div>
<div class="appl wa pwa">${WAH}<div class="body" id="pBody"></div><div class="inp"><div class="f" id="pInp"></div><div class="s" id="pSend"><svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l11 2-11 2z"/></svg></div></div></div><div class="glare"></div>`;

const LEAD=(n,t,q)=>['in',`🔔 <b>Client nou · ${n}</b><small>${t} · „${q}”</small>`];
const VID=`<div class="vth"><i></i><span>0:21</span></div>Clipul tău`;
const PH3=`<div class="ph3"><i style="background:var(--img-dental) 22% 30%/cover"></i><i style="background:var(--img-dental) 72% 40%/cover"></i><i style="background:var(--img-dental) 46% 85%/cover"></i></div>Pozele tale`;
const PCHAT={
 5:[
  ['in','<small class="tg">Șablon aprobat</small>Salut! Aici AdPilot. Clipul și pozele tale pentru <b>cabinet stomatologic</b> sunt gata. Apasă butonul de mai jos și ți le trimit imediat.<div class="wbtn"><span>Trimite-mi materialele</span></div>'],
  ['tap','Trimite-mi materialele'],
  ['in',VID],['in',PH3],
  ['in','Vrei să pornesc și o reclamă cu ele? Conturile tale de Facebook, Instagram și TikTok sunt deja conectate.<div class="wbtn two"><span>Da, pornim</span><span>Nu acum</span></div>'],
  ['tap','Da, pornim'],
  ['in','În ce oraș și ce vârstă are clientul tău ideal?'],['out','Cluj, 25–45 de ani'],
  ['in','Ce folosim în reclamă?<div class="wbtn two"><span>Clipul</span><span>Pozele</span></div>'],['tap','Clipul'],
  ['ad',CRED+'<p>Am pregătit reclama ta. O lansez?</p>'],['out','Da 👍'],
  ['in','✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span><span>TikTok</span></div>']
 ],
 6:[LEAD('Andreea M.','0740 ··· 579','Aveți liber sâmbătă?'),LEAD('Ioana P.','0722 ··· 201','Cât costă un implant?'),LEAD('Mihai D.','0746 ··· 099','Aș vrea o programare mâine.'),LEAD('Elena R.','0755 ··· 859','Lucrați și duminica?'),['in','4 clienți noi în ultima oră. 📈']]
};
let pinTok=0,pinVis=false;
const view=id=>$$('#pw .pwv').forEach(v=>v.classList.toggle('on',v.id===id));
async function typeEl(el,txt,ms,ok){el.textContent='';for(const ch of txt){el.textContent+=ch;await sleep(ms);if(!ok())return false}return true}
const cB=()=>$('#cBody');
function cadd(html,cls='cm'){const d=document.createElement('div');d.className=cls;d.innerHTML=html;cB().append(d);return d}
async function ctyp(ms,ok){const t=document.createElement('div');t.className='ctyp';t.innerHTML='<i></i><i></i><i></i>';cB().append(t);await sleep(ms);t.remove();return ok()}
const CROW=(k,n,sub,bg,ic,done)=>`<div class="cconn ${done?'done':''}" data-k="${k}"><span class="ic" style="background:${bg}">${ic}</span><span class="t"><b>${n}</b><small>${sub}</small></span><span class="st">${done?'Conectat ✓':'Conectează'}</span></div>`;
const FBROW=d=>CROW('fb','Facebook și Instagram','Pagina și contul de reclame','linear-gradient(135deg,#1877f2,#0a5bd0)',ICO_FB,d);
const TTROW=d=>CROW('tt','TikTok','Contul tău TikTok','linear-gradient(135deg,#111,#2a2a2a)',ICO_TT,d);
async function connect(row,ok){row.classList.add('busy');row.querySelector('.st').innerHTML='<i class="cspin"></i>';await sleep(1000);if(!ok())return false;row.classList.remove('busy');row.classList.add('done');row.querySelector('.st').textContent='Conectat ✓';return true}

async function sc0(ok,ins){
  PS.className='scr s-n';view('vNum');const num=$('#pNum'),chk=$('#pChk'),btn=$('#pBtn1'),nt=$('#pnts'),codes=$$('#pCodes i'),pc=$('#pCodes'),hint=$('#pHint');
  nt.innerHTML='';num.textContent='';chk.classList.remove('ok');btn.classList.remove('hit');codes.forEach(c=>c.textContent='');pc.classList.remove('ok');hint.classList.remove('ok');hint.textContent='Verific codul…';
  const fin=()=>{pc.classList.add('ok');hint.textContent='Număr confirmat ✓';hint.classList.add('ok')};
  if(ins){view('vCode');'482917'.split('').forEach((d,i)=>codes[i].textContent=d);fin();return}
  await sleep(700);if(!ok())return;
  if(!await typeEl(num,'733 682 037',70,ok))return;
  await sleep(300);chk.classList.add('ok');await sleep(550);if(!ok())return;
  btn.classList.add('hit');await sleep(240);btn.classList.remove('hit');await sleep(350);if(!ok())return;
  const n=document.createElement('div');n.className='nt';n.innerHTML=`<span class="wi">${WIC}</span><div><b>AdPilot</b>482 917 este codul de confirmare.</div><small>acum</small>`;nt.append(n);await sleep(1700);if(!ok())return;
  n.classList.add('out');view('vCode');await sleep(550);if(!ok())return;nt.innerHTML='';
  for(let i=0;i<6;i++){codes[i].textContent='482917'[i];await sleep(240);if(!ok())return}
  await sleep(250);fin();
}
async function sc1(ok,ins){
  PS.className='scr s-n';const f=$('#pNiche'),goals=$$('#pGoals div'),chips=$$('#pNicheChips span'),b2=$('#pBtn2');
  f.textContent='';goals.forEach(g=>g.classList.remove('on'));chips.forEach(c=>c.classList.remove('hot'));b2.classList.remove('hit');view('vNiche');
  if(ins){f.textContent='Cabinet stomatologic';view('vGoal');goals[1].classList.add('on');return}
  await sleep(700);if(!ok())return;
  chips[2].classList.add('hot');await sleep(600);if(!ok())return;
  if(!await typeEl(f,'Cabinet stomatologic',55,ok))return;
  await sleep(500);b2.classList.add('hit');await sleep(240);b2.classList.remove('hit');await sleep(350);if(!ok())return;
  view('vGoal');await sleep(1000);if(!ok())return;
  goals[2].classList.add('hov');await sleep(450);goals[2].classList.remove('hov');goals[1].classList.add('on');
}
async function sc2(ok,ins){
  PS.className='scr s-web';cB().innerHTML='';const clip=$('#cClip'),ptr=$('#cPtr');clip.classList.remove('pulse');ptr.classList.remove('on');
  const A=['Salut! Sunt asistentul tău AdPilot. Creez clipuri și reclame care aduc clienți.','Ca să fac primul tău clip am nevoie de <b>2–3 poze</b> cu afacerea ta.'];
  if(ins){A.forEach(t=>cadd(t));cadd(PHOTO,'cm me ph');return}
  await sleep(500);
  for(const t of A){if(!await ctyp(850,ok))return;cadd(t);await sleep(300)}
  clip.classList.add('pulse');ptr.classList.add('on');await sleep(1900);if(!ok())return;
  clip.classList.remove('pulse');ptr.classList.remove('on');cadd(PHOTO,'cm me ph');
}
async function sc3(ok,ins){
  PS.className='scr s-web';const B=cB();B.innerHTML='';const clip=$('#cClip');clip.classList.remove('pulse');$('#cPtr').classList.remove('on');
  cadd(PHOTO,'cm me ph');
  if(ins){cadd('Facebook și Instagram conectate ✓. Doar pe Facebook sau și pe TikTok?');cadd('Și pe TikTok','cm me');cadd('<div class="cacts">'+FBROW(true)+TTROW(true)+'</div>','cx');return}
  if(!await ctyp(800,ok))return;cadd('Am primit pozele. Conectează <b>cel puțin un cont</b>:');await sleep(350);
  const blk=cadd('<div class="cacts">'+FBROW(false)+TTROW(false)+'</div>','cx');await sleep(1100);if(!ok())return;
  const fb=blk.querySelector('[data-k=fb]'),tt=blk.querySelector('[data-k=tt]');tt.classList.add('dim');
  if(!await connect(fb,ok))return;await sleep(500);
  if(!await ctyp(800,ok))return;cadd('Facebook și Instagram conectate ✓. Vrei reclama doar pe ele, sau și pe TikTok?');await sleep(350);
  const ch=cadd('<div class="cbtn">Doar pe Facebook și Instagram</div><div class="cbtn hot">Și pe TikTok</div>','cx cch');await sleep(1300);if(!ok())return;
  ch.remove();cadd('Și pe TikTok','cm me');await sleep(500);
  if(!await ctyp(800,ok))return;cadd('Perfect. Conectează și <b>TikTok</b>:');await sleep(300);
  tt.classList.remove('dim');await sleep(800);if(!ok())return;
  await connect(tt,ok);
}
async function sc4(ok,ins){
  PS.className='scr s-web';const B=cB();B.innerHTML='';$('#cClip').classList.remove('pulse');$('#cPtr').classList.remove('on');
  const STEPS=['Scriu scenariul în română','Creez cadrele din pozele tale','Sincronizez vocea și buzele','Montez subtitrările'];
  const card=`<div class="cgen"><div class="gt"><span id="gLab">${STEPS[0]}</span><b id="gPc">0%</b></div><div class="gb"><i id="gBar"></i></div></div>`;
  if(ins){cadd('Conturile sunt conectate. Încep să creez clipul tău.');cadd('<span class="rd"></span><b>Durează între 10 și 15 minute.</b> Poți ieși de pe pagină: îți trimitem totul pe WhatsApp.','cm warn');cadd(card,'cx');$('#gPc').textContent='100%';$('#gBar').style.width='100%';$('#gLab').textContent='Gata! Clipul și pozele sunt gata ✓';return}
  await sleep(400);if(!await ctyp(800,ok))return;cadd('Conturile sunt conectate. Încep să creez clipul tău.');await sleep(500);
  if(!await ctyp(700,ok))return;cadd('<span class="rd"></span><b>Durează între 10 și 15 minute.</b> Poți ieși de pe pagină: îți trimitem totul pe WhatsApp.','cm warn');await sleep(900);if(!ok())return;
  cadd(card,'cx');const lab=$('#gLab'),pc=$('#gPc'),bar=$('#gBar');
  for(let p=0;p<=100;p+=2){bar.style.width=p+'%';pc.textContent=p+'%';lab.textContent=STEPS[Math.min(3,Math.floor(p/26))];await sleep(120);if(!ok())return}
  lab.textContent='Gata! Clipul și pozele sunt gata ✓';
}
async function scChat(i,ok,ins){
  PS.className='scr s-chat';const B=$('#pBody'),I=$('#pInp'),S=$('#pSend');B.innerHTML='';I.textContent='';I.classList.remove('typing');B.classList.toggle('static',!!ins);
  const add=m=>{const k=m[0]==='tap'?'out':m[0];const d=document.createElement('div');d.className='wb '+(k==='out'?'out':'in')+(k==='ad'?' ad':'');d.innerHTML=m[1]+'<time>9:41</time>';B.append(d)};
  if(ins){PCHAT[i].forEach(add);return}
  await sleep(500);
  for(const m of PCHAT[i]){if(!ok())return;
    if(m[0]==='out'){I.classList.add('typing');for(const ch of m[1]){I.textContent+=ch;await sleep(22);if(!ok())return}
      await sleep(260);S.classList.add('hit');await sleep(120);S.classList.remove('hit');I.textContent='';I.classList.remove('typing');add(m)}
    else if(m[0]==='tap'){await sleep(900);if(!ok())return;add(m);await sleep(450)}
    else{const t=document.createElement('div');t.className='wtyp';t.innerHTML='<i></i><i></i><i></i>';B.append(t);await sleep(m[0]==='ad'?1200:i===6?650:800);t.remove();if(!ok())return;add(m)}
    await sleep(i===6?700:420)}
}
const SCENES=[sc0,sc1,sc2,sc3,sc4,(ok,ins)=>scChat(5,ok,ins),(ok,ins)=>scChat(6,ok,ins)];
async function pinScene(i,instant){
  const my=++pinTok,ok=()=>my===pinTok;
  await SCENES[Math.min(i,SCENES.length-1)](ok,!!instant);
  if(ok()&&innerWidth<=900&&pinVis){await sleep(2600);if(ok())setPin((i+1)%steps.length)}
}
sc0(()=>true,true);
IO(es=>es.forEach(e=>{pinVis=e.isIntersecting;if(pinVis)pinScene(Math.max(0,pinIdx),RM);else pinTok++}),{threshold:.35}).observe(PS);
/* mobil: secțiunea nu e fixată, așa că pașii se schimbă cu atingere pe pas sau swipe pe telefon */
steps.forEach((st,k)=>st.addEventListener('click',()=>{if(innerWidth<=900)setPin(k)},{signal:ac.signal}));
let swX=null,swY=null;
PS.addEventListener('touchstart',e=>{swX=e.touches[0].clientX;swY=e.touches[0].clientY},{passive:true,signal:ac.signal});
PS.addEventListener('touchend',e=>{if(swX===null)return;const dx=e.changedTouches[0].clientX-swX,dy=e.changedTouches[0].clientY-swY;swX=null;
  if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2){const n=steps.length;setPin((Math.max(0,pinIdx)+(dx<0?1:n-1))%n)}},{passive:true,signal:ac.signal});

/* ---------- WhatsApp windows in the bento ---------- */
const DENT=`<div class="cre pic" role="img" aria-label="Reclama clinicii" style="background:var(--img-dental) center/cover;aspect-ratio:720/568"></div>`;
const WSEND='<svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l11 2-11 2z"/></svg>';
function chatWin(host,script,delay=0,time='9:41'){
  host.innerHTML=WAH+'<div class="body"></div><div class="inp"><div class="f"></div><div class="s">'+WSEND+'</div></div>';
  const B=$('.body',host),I=$('.f',host),S=$('.s',host);
  const add=m=>{const d=document.createElement('div');d.className='wb '+(m[0]==='out'?'out':'in')+(m[0]==='ad'?' ad':'');d.innerHTML=m[1]+`<time>${time}</time>`;B.append(d)};
  B.classList.add('static');script.forEach(add); if(RM)return;
  (async()=>{ await sleep(2600+delay);
    for(;;){ if(!host.offsetParent){await sleep(1500);continue}
      B.classList.remove('static');B.innerHTML='';
      for(const m of script){
        if(m[0]==='out'){ await sleep(500);I.classList.add('typing');for(const ch of m[1]){I.textContent+=ch;await sleep(24)}
          await sleep(300);S.classList.add('hit');await sleep(130);S.classList.remove('hit');I.textContent='';I.classList.remove('typing');add(m) }
        else{ const t=document.createElement('div');t.className='wtyp';t.innerHTML='<i></i><i></i><i></i>';B.append(t);await sleep(m[0]==='ad'?1400:850);t.remove();add(m) }
        await sleep(600) }
      await sleep(4200) } })();
}
chatWin($('#wawin'),[['out','Vreau o campanie pentru clinica mea din București'],['in','Sigur. Ce vrei să obții: programări, apeluri sau mesaje?'],['out','Programări. Buget 60 lei pe zi'],['ad',DENT+'<p>Reclama e gata. O lansez?</p>'],['out','Da 👍'],['in','✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span><span>TikTok</span></div>']]);
chatWin($('#waLeads'),[['in','🔔 <b>Client nou · Andreea M.</b><small>0740 ··· 579 · „Aș vrea o programare mâine.”</small>'],['in','🔔 <b>Client nou · Mihai D.</b><small>0746 ··· 099 · „Aveți loc sâmbătă?”</small>'],['out','Câți clienți am azi?'],['in','9 clienți potențiali azi, cu 3 mai mulți decât ieri. 📈']],700);
chatWin($('#waBudget'),[['out','Mărește bugetul la 80 lei pe zi'],['in','✅ Făcut. Bugetul este acum <b>80 lei pe zi</b>.'],['out','Pune pe pauză campania de vară'],['in','⏸️ Campania „Ofertă de vară” e pe pauză. O repornești oricând cu „pornește”.']],1400);
chatWin($('#waReport'),[['in','☀️ <b>Bună dimineața! Raportul de ieri:</b><div class="rep"><div>Cheltuit pe reclame<b>18,00 lei</b></div><div>Clienți noi<b>9</b></div><div>Cost pe client<b>2,00 lei</b></div><div>Cost pe click<b>0,42 lei</b></div></div>'],['in','Cu 3 clienți mai mulți decât alaltăieri. 📈']],2100,'8:00');

/* ---------- AI image cell ---------- */
const AIG=[['salon','femeie cu păr lung coafat, salon modern, lumină caldă',41],['dental','medic stomatolog și pacientă zâmbind, cabinet luminos',38],['imob','living luminos, canapea bej, vedere spre oraș',52]];
(async function aiLoop(){ if(RM)return; const A=$('#aiA'),B=$('#aiB'),S=$('#aiS'),P=$('#aiP'),Bd=$('#aiBadge'); let i=0;
  for(;;){ await sleep(3600); if(!A.offsetParent)continue; i=(i+1)%AIG.length; const g=AIG[i];
    P.textContent='';P.classList.add('caret');for(const ch of g[1]){P.textContent+=ch;await sleep(24)}P.classList.remove('caret');
    Bd.textContent='Se generează…';await sleep(500);
    B.style.backgroundImage=`var(--img-${g[0]})`;B.classList.add('go');S.classList.add('go');await sleep(1700);
    A.style.backgroundImage=`var(--img-${g[0]})`;B.classList.remove('go');S.classList.remove('go');Bd.textContent=`Generat cu AI · ${g[2]} s`; }
})();

/* ---------- goals (tilt + pick) ---------- */
const GT=['AdPilot construiește o campanie de vânzări care duce oamenii direct la produsele tale.','Primești o pagină de programări și reclame optimizate pentru rezervări reale.','AdPilot pornește o campanie cu formular, iar fiecare contact ajunge la tine pe WhatsApp.','Reclamele tale primesc buton de apel și sunt optimizate pentru telefoane care sună.'];
let goalSel=1;
function pick(i){goalSel=i;root.dataset.goal=String(i);$$('#goals .goal').forEach((g,k)=>g.setAttribute('aria-pressed',k===i));$('#goalText').textContent=GT[i]}
$$('#goals .goal').forEach((g,i)=>{g.onclick=()=>pick(i);
  g.addEventListener('pointermove',e=>{if(RM)return;const r=g.getBoundingClientRect();g.style.setProperty('--ry',(((e.clientX-r.left)/r.width-.5)*10)+'deg');g.style.setProperty('--rx',(-((e.clientY-r.top)/r.height-.5)*10)+'deg')});
  g.addEventListener('pointerleave',()=>{g.style.setProperty('--rx','0deg');g.style.setProperty('--ry','0deg')})});
pick(1);

/* ---------- boot ---------- */
function loop(t){if(!alive)return;drawRibbons(t);requestAnimationFrame(loop)}
armReveal(root);
sizeCanvases(); if(RM){ribbons.forEach(r=>r.on=true);drawRibbons(4000)}else requestAnimationFrame(loop);
heroLoop(); onScroll();

return ()=>{alive=false;pinTok++;ac.abort();observers.forEach(o=>o.disconnect())};
}
