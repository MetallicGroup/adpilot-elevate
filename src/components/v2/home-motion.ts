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
    pinBar.style.width=(p*100)+'%';setPin(Math.min(3,Math.floor(p*4)))}
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
const CAPS=['Îi scrii pe WhatsApp','AdPilot creează reclama','Live pe Facebook și Instagram','Clienții îți scriu'];
function cap(i){$('#capN').textContent=(i+1)+'/4';$('#capT').outerHTML=`<span id="capT">${CAPS[i]}</span>`}
function wb(html,dir,cls=''){const d=document.createElement('div');d.className=`wb ${dir} ${cls}`;d.innerHTML=html+'<time>9:41</time>';wbody.append(d);return d}
const CHECK=['📍 Cluj-Napoca, femei 25–45','💰 Buget: 50 lei pe zi','✍️ 3 texte de reclamă','🖼️ Imagine generată'];
function waFinal(){ wbody.innerHTML='';wbody.classList.add('static');
  wb('Vreau mai multe programări la salon','out');wb('Mă ocup. Pregătesc campania acum.','in');
  wb(`<div class="wl">${CHECK.map(c=>`<div>${c}</div>`).join('')}</div>`,'in');
  wb(CRE+'<p>Reclama e gata. O lansez?</p>','in','ad');wb('Da 👍','out');
  wb('✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span></div>','in'); }
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
    wb('✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span></div>','in');await sleep(1500);
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

/* pinned phone: one animated scene per step */
const PS=$('#pinScr');
PS.className='scr s-ob';
PS.innerHTML=SB+`<div class="appl ob"><div class="obz" id="obz"><span class="brand"><span class="logo"></span>AdPilot</span><span class="eb">PASUL 1 DIN 5</span><h4>Conectează pagina ta de Facebook</h4><p>Contul de reclame rămâne al tău, pe numele tău.</p><div class="obc" id="obc"><div><i></i>Pagina de Facebook</div><div><i></i>Contul de Instagram</div><div><i></i>Contul de reclame</div></div><div class="obb" id="obb"></div></div>
<div class="fbsheet" id="fbsheet"><span class="grab"></span><div class="fw">facebook</div><div class="pair"><span class="logo"></span><u>•••</u><span class="fbi">f</span></div><h5>AdPilot solicită acces la:</h5><ul><li>Pagina „Salon Eleganza”</li><li>Contul de Instagram</li><li>Contul de reclame</li></ul><div class="go" id="fbgo">Continuă ca Daniel</div><div class="no">Anulează</div></div><i class="tap" id="ptap"></i></div>
<div class="appl wa pwa">${WAH}<div class="body" id="pBody"></div><div class="inp"><div class="f" id="pInp"></div><div class="s" id="pSend">${'<svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l11 2-11 2z"/></svg>'}</div></div></div><div class="glare"></div>`;
const FBTXT='<svg viewBox="0 0 24 24"><path d="M13.500 22v-8h2.700l.400-3.200h-3.100V8.700c0-.900.300-1.600 1.600-1.600h1.700V4.200c-.300 0-1.300-.100-2.500-.100-2.500 0-4.100 1.500-4.100 4.200v2.500H7.400V14h2.800v8h3.300z"/></svg>Conectează cu Facebook';
const LEAD=(n,t,q)=>['in',`🔔 <b>Client nou · ${n}</b><small>${t} · „${q}”</small>`];
const PCHAT={
 1:[['out','Pornește te rog o reclamă pentru salon'],['in','Sigur! Ce vrei să obții?'],['out','Mai multe programări'],['in','În ce oraș și pe ce rază?'],['out','Cluj, 15 km în jur'],['in','Ce buget ai pe zi?'],['out','50 lei'],['in','Perfect. Pregătesc reclama. ✨']],
 2:[['in','Am pregătit reclama ta:'],['ad',CRE+'<p>O aprobi și o lansez?</p>'],['out','Da 👍'],['in','✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span></div>']],
 3:[LEAD('Andreea M.','0740 ··· 579','Aveți liber sâmbătă?'),LEAD('Ioana P.','0722 ··· 201','Cât costă un tuns?'),LEAD('Mihai D.','0746 ··· 099','Aș vrea o programare mâine.'),LEAD('Elena R.','0755 ··· 859','Lucrați și duminica?'),['in','4 clienți noi în ultima oră. 📈']]
};
let pinTok=0,pinVis=false;
function obReset(done){ $('#obz').classList.remove('zoom');$('#fbsheet').classList.remove('on');$$('#obc div').forEach(d=>d.classList.toggle('ok',!!done));
  const b=$('#obb');b.classList.toggle('done',!!done);b.innerHTML=done?'✓ Cont Meta conectat':FBTXT }
function tapAt(y){const t=$('#ptap');t.style.setProperty('--ty',y);t.classList.remove('go');void t.offsetWidth;t.classList.add('go')}
async function pinScene(i,instant){
  const my=++pinTok,ok=()=>my===pinTok,B=$('#pBody'),I=$('#pInp'),S=$('#pSend');
  if(i===0){ PS.className='scr s-ob'; if(instant){obReset(true);return}
    obReset(false);await sleep(900);if(!ok())return;
    $('#obz').classList.add('zoom');await sleep(1250);if(!ok())return;
    tapAt('92%');$('#obb').classList.add('hit');await sleep(260);$('#obb').classList.remove('hit');await sleep(380);if(!ok())return;
    $('#obz').classList.remove('zoom');$('#fbsheet').classList.add('on');await sleep(1700);if(!ok())return;
    tapAt('86%');$('#fbgo').classList.add('hit');await sleep(260);$('#fbgo').classList.remove('hit');await sleep(350);if(!ok())return;
    $('#fbsheet').classList.remove('on');await sleep(750);if(!ok())return;
    for(const d of $$('#obc div')){d.classList.add('ok');await sleep(380);if(!ok())return}
    const b=$('#obb');b.classList.add('done');b.innerHTML='✓ Cont Meta conectat';
  } else {
    PS.className='scr s-chat';B.innerHTML='';I.textContent='';I.classList.remove('typing');B.classList.toggle('static',!!instant);
    const add=m=>{const d=document.createElement('div');d.className='wb '+(m[0]==='out'?'out':'in')+(m[0]==='ad'?' ad':'');d.innerHTML=m[1]+'<time>9:41</time>';B.append(d)};
    if(instant){PCHAT[i].forEach(add);return}
    await sleep(500);
    for(const m of PCHAT[i]){ if(!ok())return;
      if(m[0]==='out'){ I.classList.add('typing');for(const ch of m[1]){I.textContent+=ch;await sleep(22);if(!ok())return}
        await sleep(260);S.classList.add('hit');await sleep(120);S.classList.remove('hit');I.textContent='';I.classList.remove('typing');add(m) }
      else{ const t=document.createElement('div');t.className='wtyp';t.innerHTML='<i></i><i></i><i></i>';B.append(t);await sleep(m[0]==='ad'?1300:i===3?650:750);t.remove();if(!ok())return;add(m) }
      await sleep(i===3?700:480) }
  }
  if(ok()&&innerWidth<=900&&pinVis){await sleep(2600);if(ok())setPin((i+1)%4)}
}
obReset(false);
IO(es=>es.forEach(e=>{pinVis=e.isIntersecting;if(pinVis)pinScene(Math.max(0,pinIdx),RM);else pinTok++}),{threshold:.35}).observe(PS);

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
chatWin($('#wawin'),[['out','Vreau o campanie pentru clinica mea din București'],['in','Sigur. Ce vrei să obții: programări, apeluri sau mesaje?'],['out','Programări. Buget 60 lei pe zi'],['ad',DENT+'<p>Reclama e gata. O lansez?</p>'],['out','Da 👍'],['in','✅ <b>Campania e live</b><div class="wchips"><span>Facebook</span><span>Instagram</span></div>']]);
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
