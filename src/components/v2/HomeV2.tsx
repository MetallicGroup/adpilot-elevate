import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { tkClickButton } from "@/lib/tiktok-pixel";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { initHomeMotion } from "./home-motion";

const NICHES = [
  "Saloane de înfrumusețare", "Școli de șoferi", "Cabinete stomatologice", "Service auto",
  "Pizzerii", "Magazine online", "Firme de curățenie", "Clinici", "Agenții imobiliare",
  "Săli de fitness", "Constructori", "Cursuri și traininguri",
];
const GOALS = ["sales", "bookings", "leads", "calls"];

// Inline styles here carry CSS custom properties, which React's typings don't know.
const css = (o: Record<string, string>) => o as CSSProperties;

/** v2 marketing home. Markup is static; all motion lives in home-motion.ts. */
export function HomeV2() {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ref.current) return;
    return initHomeMotion(ref.current);
  }, []);

  // One delegated handler: every CTA carries data-go, in-page links stay native.
  function onClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const go = target.closest<HTMLElement>("[data-go]");
    if (go) {
      e.preventDefault();
      tkClickButton(`home-v2-${go.textContent?.trim().slice(0, 40) ?? "cta"}`);
      const login = go.dataset.mode === "login";
      const inGoals = !!go.closest("#obiectiv");
      const goal = inGoals ? GOALS[Number(ref.current?.dataset.goal ?? 1)] : undefined;
      navigate({ to: "/auth", search: { mode: login ? "signin" : "signup", ...(goal ? { goal } : {}) } });
      return;
    }
    const home = target.closest<HTMLAnchorElement>('a[href="#home"]');
    if (home) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="v2" ref={ref} onClick={onClick}>

<header className="nav" id="nav"><div className="in">
  <a className="brand" href="#home"><span className="logo"></span>AdPilot</a>
  <nav className="links"><a href="#cum">Cum funcționează</a><a href="#obiectiv">Obiective</a><a href="#preturi">Prețuri</a><a href="#faq">Întrebări</a></nav>
  <span className="sp"></span>
  <button className="login btn btn-s btn-o dark" data-go="signup" data-mode="login">Intră în cont</button>
  <button className="btn btn-s btn-w" data-go="signup">Începe gratuit</button>
</div></header>

<section className="band dark hero" id="hero">
  <canvas className="ribbon" data-ribbon></canvas><div className="grain"></div>
  <div className="wrap">
    <div className="hero-copy">
      <div className="pill"><i>Nou</i>7 zile gratuite, fără card</div>
      <h1 className="d1">Reclamele tale, pornite <span style={css({ whiteSpace: "nowrap" })}>dintr‑un</span> <span className="gtext">mesaj.</span></h1>
      <p className="lead">Îi scrii lui AdPilot pe WhatsApp ce vrei să obții. El creează reclama, o lansează pe Facebook și Instagram și îți trimite clienții direct în conversație.</p>
      <div className="cta">
        <button className="btn btn-w" data-go="signup">Începe gratuit 7 zile <span className="arr">→</span></button>
        <a className="btn btn-o" href="#cum">Vezi cum funcționează</a>
      </div>
      <div className="facts"><span>Fără card</span><span>Fără agenție</span><span>Gata în 5 minute</span></div>
    </div>
    <div className="stage" id="stage">
      <div className="cap" id="cap"><i id="capN">1/4</i><span id="capT">Îi scrii pe WhatsApp</span></div>
      <div className="float f1" data-p=".12"><div className="in"><div className="live">LIVE</div><div className="n" style={css({ marginTop: "8px" })} id="reach">12.480</div><div className="l">oameni au văzut reclama</div></div></div>
      <div className="float f2" data-p="-.1"><div className="in row"><span className="av">AM</span><div><b>Andreea M.</b><div className="l" style={css({ margin: "0" })}>„Aveți liber sâmbătă?”</div></div></div></div>
      <div className="float f3" data-p=".2"><div className="in"><div className="l" style={css({ margin: "0 0 4px" })}>Cost pe client</div><div className="n">1,75 <small style={css({ fontSize: "14px", color: "#a9a6c0" })}>lei</small></div></div></div>
      <div className="hero-ph" data-p=".06"><div className="tilt"><div className="iph"><div className="bz"><div className="scr s-wa" id="hscr"></div></div></div></div></div>
    </div>
  </div>
</section>

<div className="mq" aria-hidden="true"><div className="t">{[...NICHES, ...NICHES].map((n, i) => <span key={i}>{n}</span>)}</div></div>

<section className="band light" id="ce">
  <div className="wrap">
    <p className="ey" data-r>Ce face AdPilot</p>
    <p className="two" data-r style={css({ maxWidth: "24ch", margin: "18px 0 0" })}><b>Tu conduci afacerea. AdPilot conduce reclamele.</b> Scrie textele, face poza, alege publicul, pornește campania și îți spune în fiecare dimineață ce a ieșit.</p>
    <div className="bento">
      <div className="cell c3" data-r>
        <h3>Vorbești ca pe WhatsApp</h3><p>Fără Ads Manager și fără meniuri. Scrii în română ce vrei, AdPilot face restul.</p>
        <div className="viz wsviz"><div className="wawin wa" id="wawin"></div></div>
      </div>
      <div className="cell c3" data-r style={css({ "--d": ".08s" })}>
        <h3>Poza o face AI-ul</h3><p>Nu ai poză bună? Descrii ce vrei sau trimiți una de referință și primești varianta pentru reclamă într-un minut.</p>
        <div className="viz"><div className="aigen"><div className="aiph" id="aiA" style={css({ backgroundImage: "var(--img-salon)" })}></div><div className="aiph top" id="aiB"></div><i className="scanl" id="aiS"></i><span className="aibadge" id="aiBadge">Generat cu AI · 41 s</span></div><div className="aiprompt"><span className="sp">✦</span><span className="tp" id="aiP">femeie cu păr lung coafat, salon modern, lumină caldă</span></div></div>
      </div>
      <div className="cell c2" data-r>
        <h3>Clienții vin în conversație</h3><p>Fiecare om care completează formularul ajunge la tine pe WhatsApp, cu nume și telefon.</p>
        <div className="viz"><div className="wawin sm wa" id="waLeads"></div></div>
      </div>
      <div className="cell c2" data-r style={css({ "--d": ".08s" })}>
        <h3>Bugetul îl decizi tu</h3><p>Îl plătești direct către Meta. AdPilot îl mută singur spre reclamele care merg.</p>
        <div className="viz"><div className="wawin sm wa" id="waBudget"></div></div>
      </div>
      <div className="cell c2" data-r style={css({ "--d": ".16s" })}>
        <h3>Raport în fiecare dimineață</h3><p>Câți clienți, cât a costat fiecare, ce s-a schimbat față de ieri.</p>
        <div className="viz"><div className="wawin sm wa" id="waReport"></div></div>
      </div>
    </div>
  </div>
</section>

<section className="band dark pin" id="cum">
  <div className="track" id="track">
    <div className="stick">
      <div className="steps">
        <p className="ey" style={css({ margin: "0 0 18px" })}>Cum funcționează</p>
        <div className="step on"><span className="k">PASUL 1</span><h3>Conectezi Facebook</h3><p>Un singur buton. Contul de reclame rămâne al tău, pe numele tău.</p></div>
        <div className="step"><span className="k">PASUL 2</span><h3>Spui ce vrei să obții</h3><p>Vânzări, programări, clienți potențiali sau apeluri. Scrii orașul și bugetul.</p></div>
        <div className="step"><span className="k">PASUL 3</span><h3>AdPilot face reclama</h3><p>Text, poză, public, formular. Tu doar confirmi cu „da”.</p></div>
        <div className="step"><span className="k">PASUL 4</span><h3>Clienții îți scriu</h3><p>Primești fiecare contact pe WhatsApp, în secunda în care apare.</p></div>
      </div>
      <div className="iph"><div className="bz"><div className="scr" id="pinScr"></div></div></div>
      <div className="pside" id="pside">
        <div className="card on"><div className="live">CONECTAT</div><h3 className="d3" style={css({ marginTop: "12px" })}>Pagina „Salon Eleganza”</h3><p style={css({ color: "var(--mut)", margin: "8px 0 0", fontSize: "14px" })}>Cont de reclame și card verificate.</p></div>
        <div className="card"><p className="ey">Obiectiv ales</p><h3 className="d3" style={css({ marginTop: "10px" })}>Mai multe programări</h3><div className="chips" style={css({ marginTop: "14px" })}><span className="chip">Cluj-Napoca + 15 km</span><span className="chip">50 lei pe zi</span></div></div>
        <div className="card"><p className="ey">Reclamă generată</p><div style={css({ height: "150px", marginTop: "12px", borderRadius: "14px", background: "var(--img-salon) center 30%/cover" })}></div><p style={css({ margin: "12px 0 0", fontSize: "14px" })}><b>Tuns și coafat cu 20% reducere</b><br /><span style={css({ color: "var(--mut)" })}>Programează-te în 30 de secunde.</span></p></div>
        <div className="card"><div className="live">LEAD NOU</div><div className="row" style={css({ display: "flex", gap: "12px", alignItems: "center", marginTop: "14px" })}><span className="av">IP</span><div><b>Ioana P.</b><div style={css({ color: "var(--mut)", fontSize: "13px" })}>0740 ··· 579 · acum 4 secunde</div></div></div></div>
      </div>
      <div className="progress"><i id="pinBar"></i></div>
    </div>
  </div>
</section>

<section className="band light" id="rezultat">
  <div className="wrap">
    <p className="ey" data-r>Așa arată în flux</p>
    <h2 className="d2" data-r style={css({ maxWidth: "17ch", marginTop: "16px" })}>Reclame care arată ca făcute de o agenție.</h2>
    <p className="lead" data-r style={css({ marginTop: "22px" })}>Text, imagine și buton, gata de publicat pe Facebook și Instagram. Tu doar confirmi.</p>
    <div className="ads">
      <article className="fbp" data-r data-p=".04" style={css({ "--d": "0s" })}>
        <div className="fbh"><b>facebook</b><span><i><svg viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.4" strokeLinecap="round"><circle cx="10.500" cy="10.500" r="6.500"/><path d="M15.500 15.500L20 20"/></svg></i><i><svg viewBox="0 0 24 24" fill="#050505"><path d="M12 3C6.900 3 3 6.700 3 11.400c0 2.600 1.200 4.900 3.100 6.400V21l3-1.600c.900.200 1.900.400 2.900.400 5.100 0 9-3.700 9-8.400S17.100 3 12 3zm.900 11.200l-2.300-2.400-4.400 2.400 4.900-5.200 2.300 2.400 4.400-2.400-4.900 5.200z"/></svg></i></span></div>
        <div className="top"><span className="pa" style={css({ "--a": "linear-gradient(140deg,#ffb86b,#ff5fa2)" })}>SE</span><div><b>Salon Eleganza</b><small>Sponsorizat · 🌐</small></div><span className="mn">···</span></div>
        <div className="tx">Părul tău merită o pauză. Programează-te în 30 de secunde și ai 20% reducere la prima vizită.</div>
        <div className="adimg" role="img" aria-label="Femeie cu părul proaspăt coafat într-un salon" style={css({ "--ph": "var(--img-salon)" })}></div>
        <div className="lk"><b>Programează-te azi</b><em>Rezervă acum</em></div>
        <div className="rx"><span className="re"><u><span style={css({ background: "#0866ff" })}>👍</span><span style={css({ background: "#f33e58" })}>❤️</span><span style={css({ background: "#ffd766" })}>😮</span></u>104</span><span>14 comentarii</span></div><div className="ac"><span><svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-7c1.500 0 2.500 1 2.500 2.500V10H19a2 2 0 012 2.300l-1 6a2 2 0 01-2 1.700H7"/></svg>Îmi place</span><span><svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4 3.500V17H5a2 2 0 01-2-2V7a2 2 0 012-2z"/></svg>Comentează</span><span><svg viewBox="0 0 24 24"><path d="M14 5l7 6.500-7 6.500v-4c-5 0-8 1.500-10 5 0-6 3-10 10-10z"/></svg>Distribuie</span></div>
      </article>
      <article className="fbp" data-r data-p="-.05" style={css({ "--d": "0.1s" })}>
        <div className="fbh"><b>facebook</b><span><i><svg viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.4" strokeLinecap="round"><circle cx="10.500" cy="10.500" r="6.500"/><path d="M15.500 15.500L20 20"/></svg></i><i><svg viewBox="0 0 24 24" fill="#050505"><path d="M12 3C6.900 3 3 6.700 3 11.400c0 2.600 1.200 4.900 3.100 6.400V21l3-1.600c.900.200 1.900.400 2.900.400 5.100 0 9-3.700 9-8.400S17.100 3 12 3zm.900 11.200l-2.300-2.400-4.400 2.400 4.900-5.200 2.300 2.400 4.400-2.400-4.900 5.200z"/></svg></i></span></div>
        <div className="top"><span className="pa" style={css({ "--a": "#0866ff" })}><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round"><path d="M12 5.500c-1.500-1.200-4.500-1.800-6 .300-1.500 2.200-.500 5.700.500 8.700.700 2.200 1 4.500 2.200 4.500 1.500 0 1.300-4.500 3.300-4.500s1.800 4.500 3.300 4.500c1.200 0 1.500-2.300 2.200-4.500 1-3 2-6.500.500-8.700-1.500-2.100-4.500-1.500-6-.300z"/></svg></span><div><b>Clinica DentaSmile</b><small>Sponsorizat · 🌐</small></div><span className="mn">···</span></div>
        <div className="tx">Ai grijă de zâmbetul tău. Programează un consult și află ce tratament ți se potrivește.</div>
        <div className="adimg" role="img" aria-label="Medic stomatolog și pacientă zâmbind în cabinet" style={css({ "--ph": "var(--img-dental)" })}></div>
        <div className="lk"><b>Un zâmbet sănătos începe aici</b><em>Programează-te</em></div>
        <div className="rx"><span className="re"><u><span style={css({ background: "#0866ff" })}>👍</span><span style={css({ background: "#f33e58" })}>❤️</span><span style={css({ background: "#ffd766" })}>😮</span></u>96</span><span>12 comentarii</span></div><div className="ac"><span><svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-7c1.500 0 2.500 1 2.500 2.500V10H19a2 2 0 012 2.300l-1 6a2 2 0 01-2 1.700H7"/></svg>Îmi place</span><span><svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4 3.500V17H5a2 2 0 01-2-2V7a2 2 0 012-2z"/></svg>Comentează</span><span><svg viewBox="0 0 24 24"><path d="M14 5l7 6.500-7 6.500v-4c-5 0-8 1.500-10 5 0-6 3-10 10-10z"/></svg>Distribuie</span></div>
      </article>
      <article className="fbp" data-r data-p=".07" style={css({ "--d": "0.2s" })}>
        <div className="fbh"><b>facebook</b><span><i><svg viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.4" strokeLinecap="round"><circle cx="10.500" cy="10.500" r="6.500"/><path d="M15.500 15.500L20 20"/></svg></i><i><svg viewBox="0 0 24 24" fill="#050505"><path d="M12 3C6.900 3 3 6.700 3 11.400c0 2.600 1.200 4.900 3.100 6.400V21l3-1.600c.900.200 1.900.400 2.900.400 5.100 0 9-3.700 9-8.400S17.100 3 12 3zm.900 11.200l-2.300-2.400-4.400 2.400 4.900-5.200 2.300 2.400 4.400-2.400-4.900 5.200z"/></svg></i></span></div>
        <div className="top"><span className="pa" style={css({ "--a": "#14274e" })}>AC</span><div><b>Acasă Imobiliare</b><small>Sponsorizat · 🌐</small></div><span className="mn">···</span></div>
        <div className="tx">Cauți un apartament în București? Descoperă ofertele noastre și programează o vizionare.</div>
        <div className="adimg" role="img" aria-label="Living luminos într-un apartament cu vedere spre oraș" style={css({ "--ph": "var(--img-imob)" })}></div>
        <div className="lk"><b>Găsește-ți noua casă</b><em>Programează o vizionare</em></div>
        <div className="rx"><span className="re"><u><span style={css({ background: "#0866ff" })}>👍</span><span style={css({ background: "#f33e58" })}>❤️</span><span style={css({ background: "#ffd766" })}>😮</span></u>128</span><span>18 comentarii</span></div><div className="ac"><span><svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-7c1.500 0 2.500 1 2.500 2.500V10H19a2 2 0 012 2.300l-1 6a2 2 0 01-2 1.700H7"/></svg>Îmi place</span><span><svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4 3.500V17H5a2 2 0 01-2-2V7a2 2 0 012-2z"/></svg>Comentează</span><span><svg viewBox="0 0 24 24"><path d="M14 5l7 6.500-7 6.500v-4c-5 0-8 1.500-10 5 0-6 3-10 10-10z"/></svg>Distribuie</span></div>
      </article>
    </div>
    <p className="ey" data-r>Rezultat real · școală de șoferi</p>
    <h2 className="d2" data-r style={css({ maxWidth: "16ch", marginTop: "16px" })}>126 de lei cheltuiți. 72 de oameni care au cerut detalii.</h2>
    <div className="proof">
      <div data-r><div className="n" data-count="72">72</div><div className="l">clienți potențiali</div></div>
      <div data-r style={css({ "--d": ".1s" })}><div className="n"><span data-count="1.75" data-dec="2">1,75</span><span style={css({ fontSize: ".35em", letterSpacing: "0" })}> lei</span></div><div className="l">costul pentru fiecare</div></div>
      <div data-r style={css({ "--d": ".2s" })}><div className="n"><span data-count="126">126</span><span style={css({ fontSize: ".35em", letterSpacing: "0" })}> lei</span></div><div className="l">buget total de reclame</div></div>
    </div>
  </div>
</section>

<section className="band dark" id="obiectiv">
  <div className="wrap">
    <p className="ey" data-r>Începe de aici</p>
    <h2 className="d2" data-r style={css({ marginTop: "16px" })}>Tu ce vrei să obții?</h2>
    <div className="goals" id="goals">
      <button className="goal" data-r aria-pressed="false" data-g="0" style={css({ "--c": "#2f6bff" })}><span className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l-1.2 11H6.2L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg></span><h3>Mai multe vânzări</h3><p>Magazin online sau produse fizice</p></button>
      <button className="goal" data-r aria-pressed="true" data-g="1" style={css({ "--c": "#6b3dff", "--d": ".07s" })}><span className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg></span><h3>Mai multe programări</h3><p>Salon, clinică, service, consultanță</p></button>
      <button className="goal" data-r aria-pressed="false" data-g="2" style={css({ "--c": "#e13ad4", "--d": ".14s" })}><span className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M17 11v6M14 14h6"/></svg></span><h3>Mai mulți clienți potențiali</h3><p>Servicii, imobiliare, educație</p></button>
      <button className="goal" data-r aria-pressed="false" data-g="3" style={css({ "--c": "#1fbf5f", "--d": ".21s" })}><span className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h3l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v3a3 3 0 01-3 3C10 21 3 14 3 6a3 3 0 013-3z"/></svg></span><h3>Mai multe apeluri</h3><p>Vrei clienți care sună direct</p></button>
    </div>
    <div className="goal-out" data-r><p id="goalText"></p><button className="btn btn-w" data-go="signup">Creează campania mea <span className="arr">→</span></button></div>
  </div>
</section>

<section className="band light" id="preturi">
  <div className="wrap">
    <p className="ey" data-r>Prețuri</p>
    <h2 className="d2" data-r style={css({ marginTop: "16px", maxWidth: "15ch" })}>Primele 7 zile sunt gratuite. Fără card.</h2>
    <p className="lead" data-r style={css({ marginTop: "22px" })}>Alegi planul la înscriere și îl folosești complet 7 zile, fără să plătești nimic. Bugetul de reclame îl plătești separat, direct către Meta.</p>
    <div className="plans">
      <div className="plan" data-r><span className="tag">7 zile gratuite pe lună</span><div className="nm">Starter</div><div className="pr"><span className="z">0 lei</span></div><div className="then">gratuit mereu, 7 zile de rulare pe lună</div>
        <ul><li>Asistent AdPilot pe WhatsApp</li><li>Campanii pe Facebook și Instagram</li><li>O campanie activă, 7 zile în fiecare lună</li></ul>
        <button className="btn btn-o" data-go="signup" style={css({ justifyContent: "center" })}>Începe gratuit</button></div>
      <div className="plan hot" data-r style={css({ "--d": ".08s" })}><span className="tag">Cel mai ales · gratis primele 7 zile</span><div className="nm">Pro</div><div className="pr"><span className="z">0 lei</span> <s>495 lei</s></div><div className="then">primele 7 zile, apoi 495 lei pe lună</div>
        <ul><li>Campanii nelimitate, care rulează non-stop</li><li>10 poze generate cu AI pe lună</li><li>Asistent AdPilot pe WhatsApp</li><li>Suport prioritar</li></ul>
        <button className="btn btn-w" data-go="signup" style={css({ justifyContent: "center" })}>Începe gratuit 7 zile</button></div>
      <div className="plan" data-r style={css({ "--d": ".16s" })}><span className="tag">Gratis primele 7 zile</span><div className="nm">Premium</div><div className="pr"><span className="z">0 lei</span> <s>995 lei</s></div><div className="then">primele 7 zile, apoi 995 lei pe lună</div>
        <ul><li>Tot ce are Pro</li><li>Poze generate cu AI, nelimitat</li><li>Manager dedicat</li></ul>
        <button className="btn btn-k" data-go="signup" style={css({ justifyContent: "center" })}>Începe gratuit 7 zile</button></div>
    </div>
    <div className="agency" data-r><div><p className="ey" style={css({ color: "#a5a2bc" })}>Pentru agenții</p><h3 className="d3" style={css({ marginTop: "10px" })}>Toți clienții tăi, într-un singur cont.</h3><p>995 lei pe lună cu 2 afaceri incluse, apoi 249 lei pentru fiecare afacere în plus. Clienții se conectează singuri, printr-un link.</p></div><button className="btn btn-w" data-go="signup">AdPilot pentru agenții <span className="arr">→</span></button></div>
  </div>
</section>

<section className="band light" id="faq" style={css({ paddingTop: "0" })}>
  <div className="wrap">
    <h2 className="d2" data-r>Întrebări</h2>
    <div className="faq" data-r>
      <details open><summary>Ce se întâmplă după cele 7 zile?</summary><p>Pe Starter rămâi gratuit, cu 7 zile de rulare în fiecare lună. Pe Pro sau Premium primești pe WhatsApp un link de plată. Plătești cu cardul și contul continuă fără întrerupere.</p></details>
      <details><summary>Am nevoie de experiență cu reclame?</summary><p>Nu. Răspunzi la câteva întrebări despre afacere și obiectiv, iar AdPilot creează și lansează campania.</p></details>
      <details><summary>Prețul include bugetul de reclame?</summary><p>Nu. Abonamentul acoperă platforma. Bugetul îl plătești direct către Meta, din contul tău de reclame.</p></details>
      <details><summary>Al cui este contul de reclame?</summary><p>Al tău. Contul Meta rămâne pe numele tău și poți retrage accesul AdPilot oricând.</p></details>
      <details><summary>Pot anula oricând?</summary><p>Da, din cont, în orice moment. Accesul continuă până la finalul perioadei plătite.</p></details>
    </div>
  </div>
</section>

<section className="band dark final fin">
  <canvas className="ribbon" data-ribbon style={css({ top: "auto", bottom: "-40%" })}></canvas><div className="grain"></div>
  <div className="wrap">
    <h2 className="d1" data-r>Prima reclamă,<br />în 5 minute.</h2>
    <div className="cta" data-r><button className="btn btn-w" data-go="signup">Începe gratuit 7 zile <span className="arr">→</span></button></div>
    
  </div>
</section>

      <SiteFooter />
    </div>
  );
}
