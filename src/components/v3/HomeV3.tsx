import { Fragment, useEffect, useRef, type FormEvent } from "react";
import anpcSal from "@/assets/anpc-sal.png";
import anpcSol from "@/assets/anpc-sol.png";
import { openCookiePreferences } from "@/components/CookieConsent";
import { Icon, Logo, help, logoUrl } from "./ui";

const PHOTO = "/v3/foto-cabinet.jpg";

function Words({ text, start }: { text: string; start: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="w" style={{ ["--d" as string]: `${((start + i) * 0.14).toFixed(2)}s` }}>
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

const FAQ: Array<[string, string]> = [
  [
    "Nu am pagină de Facebook sau cont de reclame. Pot folosi AdPilot?",
    "Da. După ce te conectezi, verificăm singuri ce lipsește și îți arătăm pașii. Dacă te blochezi, apeși un buton și îi scrii direct lui Daniel pe WhatsApp, cu problema ta deja descrisă. Te ajută un om.",
  ],
  [
    "De ce plătesc înainte să vină clienți?",
    "Pentru că imediat după plată pornim campania. Dar o vezi completă înainte să plătești: poza, textul, orașul, bugetul. Iar dacă în primele 30 de zile nu vin cel puțin 20 de cereri, lucrăm gratis până vin.",
  ],
  [
    "Cât buget de reclame îmi trebuie?",
    "Recomandăm minimum 30–40 de lei pe zi. Bugetul îl plătești direct la Facebook sau TikTok, de pe cardul tău. AdPilot nu atinge acești bani, iar tu îl schimbi oricând, scriind un mesaj.",
  ],
  [
    "E diferit de butonul „Promovează” de pe Facebook?",
    "Da. „Promovează” doar arată postarea mai multor oameni. AdPilot face o campanie de cereri: oamenii lasă numele și telefonul, iar tu îi primești pe WhatsApp în câteva minute. Campania e urmărită zilnic, iar dacă se oprește ceva, ești anunțat.",
  ],
  [
    "Pot anula oricând?",
    "Da, din cont sau scriind pe WhatsApp. Nu există contract și nicio perioadă minimă.",
  ],
  [
    "Trebuie să mă pricep la reclame?",
    "Nu. Tu spui ce vrei să promovezi și unde. Restul îl face AdPilot.",
  ],
];

export function HomeV3() {
  const fitRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Bara de sus capătă fundal când derulezi.
  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scena din hero: se scalează după lățime și rulează în buclă.
  useEffect(() => {
    const fit = fitRef.current;
    if (!fit) return;
    const st = fit.firstElementChild as HTMLElement;
    const resize = () => {
      const mob = fit.clientWidth < 560;
      const compact = !mob && fit.clientWidth < 860;
      st.classList.toggle("compact", compact);
      st.classList.toggle("mob", mob);
      const W = mob ? 380 : compact ? 640 : 1120;
      const H = mob ? 742 : 600;
      const s = Math.min(1, fit.clientWidth / W);
      st.style.transform = `scale(${s})`;
      fit.style.height = `${H * s}px`;
      st.style.left = `${Math.max(0, (fit.clientWidth - W * s) / 2)}px`;
    };
    resize();
    // Lățimea reală poate veni după primul desen (fonturi, hidratare): urmărim containerul, nu doar fereastra.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(fit);
    window.addEventListener("resize", resize);

    const timers: number[] = [];
    const T = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const $ = (s: string) => st.querySelector(s) as HTMLElement;
    const brief = $("#briefText");
    const ad = $("#heroAd");
    const route = $("#route");
    const dot = $("#routeDot");
    const kpi = $("#kpiFloat");
    const toast = $("#toast");
    const msgs = Array.from(st.querySelectorAll<HTMLElement>(".msg"));
    const steps = Array.from(document.querySelectorAll<HTMLElement>("#stageSteps li"));
    const full = "Implant dentar de la 2.990 lei, în Pitești";
    const kpiSet = (n: number) => {
      $("#kpiN").textContent = String(n);
      $("#kpiC").textContent = n ? "13,20 lei" : "—";
      $("#kpiBar").style.setProperty("--h", `${12 + n * 26}%`);
    };
    const setStep = (i: number) => steps.forEach((li, k) => li.classList.toggle("on", k === i));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      brief.textContent = full;
      [ad, route, kpi].forEach((e) => e.classList.add("on"));
      msgs.forEach((m) => m.classList.add("on"));
      kpiSet(3);
      setStep(2);
    } else {
      const cycle = () => {
        brief.textContent = "";
        [ad, route, dot, kpi, toast].forEach((e) => e.classList.remove("on"));
        msgs.forEach((m) => m.classList.remove("on"));
        kpiSet(0);
        setStep(0);
        let i = 0;
        const showMsg = (k: number) => {
          if (k >= msgs.length) return T(cycle, 5200);
          msgs[k].classList.add("on");
          if (k === 1) {
            toast.classList.add("on");
            T(() => toast.classList.remove("on"), 2600);
          }
          if (k >= 1) kpiSet(k);
          T(() => showMsg(k + 1), 1500);
        };
        const showAd = () => {
          setStep(1);
          ad.classList.add("on");
          T(() => {
            route.classList.add("on");
            dot.classList.add("on");
            kpi.classList.add("on");
          }, 900);
          T(() => {
            setStep(2);
            showMsg(0);
          }, 2000);
        };
        const type = () => {
          brief.textContent = full.slice(0, ++i);
          if (i < full.length) T(type, 40);
          else T(showAd, 600);
        };
        T(type, 1100);
      };
      cycle();
    }
    return () => {
      timers.forEach(clearTimeout);
      ro?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = String(new FormData(e.currentTarget).get("promo") ?? "").trim();
    try {
      if (v) localStorage.setItem("adpilot:v3-promo", v);
    } catch {
      /* fără stocare: mergem mai departe oricum */
    }
    window.location.href = "/cont-nou";
  }

  return (
    <div className="v3">
      <header className="nav" ref={navRef}>
        <div className="wrap nav-in">
          <Logo />
          <nav className="nav-links" aria-label="Secțiuni">
            <a href="#cum">Cum funcționează</a>
            <a href="#pret">Preț</a>
            <a href="#intrebari">Întrebări</a>
          </nav>
          <div className="nav-cta">
            <a className="link" href="/intra">
              Intră în cont
            </a>
            <a className="btn btn-ink btn-sm" href="/cont-nou">
              Pornește campania
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="bands" aria-hidden="true">
            <span className="b1" />
            <span className="b2" />
            <span className="b3" />
          </div>
          <div className="wrap hero-in">
            <p className="eyebrow">
              <span className="dot" />
              Reclame pentru cabinete, saloane și afaceri locale
            </p>
            <h1 className="v3-reveal">
              <Words text="Clienți noi," start={0} />
              <br />
              <Words text="direct pe" start={2} />{" "}
              <span className="w g" style={{ ["--d" as string]: ".56s" }}>
                WhatsApp.
              </span>
            </h1>
            <p className="lead">
              Ne spui ce vrei să promovezi. AdPilot face reclama pe Facebook, Instagram sau TikTok
              și o pornește chiar azi. Fiecare om interesat îți apare pe WhatsApp, cu nume și
              telefon.
            </p>
            <form className="hero-form" onSubmit={start}>
              <label className="sr" htmlFor="promo">
                Ce vrei să promovezi?
              </label>
              <input
                id="promo"
                name="promo"
                placeholder="Ce promovezi? ex. Implant dentar"
                autoComplete="off"
              />
              <button className="btn btn-ink" type="submit">
                Pornește campania <Icon n="arrow" />
              </button>
            </form>
            <ul className="hero-facts">
              <li>
                <Icon n="check" />
                Plătești abia după ce vezi reclama gata
              </li>
              <li>
                <Icon n="check" />
                495 lei pe lună, anulezi oricând
              </li>
              <li>
                <Icon n="check" />
                Garanție de 30 de zile
              </li>
            </ul>
          </div>

          <div className="wrap">
            <div
              className="hero-demo"
              aria-label="Exemplu: de la ce scrii tu până la clientul de pe WhatsApp"
            >
              <div className="stage-fit" ref={fitRef}>
                <div className="stage">
                  <div className="brief">
                    <span className="brief-label">Tu scrii</span>
                    <span className="brief-text" id="briefText" />
                    <span className="caret" />
                  </div>
                  <div className="adcard" id="heroAd">
                    <span className="ad-live">LIVE</span>
                    <div className="ad-head">
                      <div className="ad-av">CP</div>
                      <div>
                        <div className="ad-name">Clinica Dr. Popescu</div>
                        <div className="ad-sub">Sponsorizat · Facebook și Instagram</div>
                      </div>
                    </div>
                    <div className="ad-text">
                      Implant dentar de la 2.990 lei, în Pitești. Lasă-ne numele și telefonul și te
                      sunăm noi să stabilim programarea.
                    </div>
                    <img className="ad-img" src={PHOTO} alt="" />
                    <div className="ad-bar">
                      <div>
                        <small>Formular</small>
                        <b>Implant dentar în Pitești</b>
                      </div>
                      <span className="ad-cta">Înscrie-te</span>
                    </div>
                  </div>
                  <svg className="route" id="route" viewBox="0 0 1120 600" aria-hidden="true">
                    <defs>
                      <linearGradient id="rg" x1="0" x2="1">
                        <stop offset="0" stopColor="#5B8CFF" />
                        <stop offset=".5" stopColor="#A06BFF" />
                        <stop offset="1" stopColor="#F05AE0" />
                      </linearGradient>
                    </defs>
                    <path className="route-base" d="M370 372 C 452 372, 452 262, 556 262" />
                    <path className="route-flow" d="M370 372 C 452 372, 452 262, 556 262" />
                  </svg>
                  <span className="route-dot" id="routeDot" />
                  <div className="phone">
                    <div className="phone-screen">
                      <div className="wa-top">
                        <img src={logoUrl} alt="" />
                        <div>
                          <b>AdPilot</b>
                          <small>cont de business</small>
                        </div>
                      </div>
                      <div className="wa-chat">
                        <div className="msg">
                          ✅ <b>Campania ta e live</b>
                          <br />
                          Implant dentar · Pitești · 40 lei/zi<span className="t">09:12</span>
                        </div>
                        <div className="msg">
                          🔔 <b>Cerere nouă</b>
                          <br />
                          Maria Ionescu · 0745 318 220
                          <br />
                          Vrea: programare la implant<span className="t">09:47</span>
                          <span className="wa-btn">Scrie-i pe WhatsApp</span>
                        </div>
                        <div className="msg">
                          🔔 <b>Cerere nouă</b>
                          <br />
                          Andrei Stan · 0723 904 117
                          <br />
                          Vrea: consultație<span className="t">10:05</span>
                          <span className="wa-btn">Scrie-i pe WhatsApp</span>
                        </div>
                        <div className="msg">
                          📊 <b>Ziua de azi</b>
                          <br />3 cereri · 13,20 lei per cerere
                          <br />
                          Cheltuit: 39,60 lei din 40<span className="t">21:00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="kpi-float" id="kpiFloat">
                    <div className="kf-top">
                      <span className="kf-live">Campanie live</span>
                      <span className="kf-day">Azi</span>
                    </div>
                    <small>Cereri primite</small>
                    <b id="kpiN">0</b>
                    <div className="kf-bars" aria-hidden="true">
                      {[30, 55, 42, 70, 48, 82].map((h, i) => (
                        <i key={i} style={{ ["--h" as string]: `${h}%` }} />
                      ))}
                      <i id="kpiBar" style={{ ["--h" as string]: "12%" }} />
                    </div>
                    <div className="kf-row">
                      <span>Cost pe cerere</span>
                      <em id="kpiC">—</em>
                    </div>
                  </div>
                  <div className="toast" id="toast">
                    <img src={logoUrl} alt="" />
                    <div>
                      <small>WhatsApp · acum</small>
                      <b>Cerere nouă: Maria Ionescu</b>
                      <span>Vrea programare la implant</span>
                    </div>
                  </div>
                </div>
              </div>
              <ol className="stage-steps" id="stageSteps">
                <li>
                  <span className="n">01</span>Spui ce vrei să promovezi
                </li>
                <li>
                  <span className="n">02</span>AdPilot face și pornește reclama
                </li>
                <li>
                  <span className="n">03</span>Clienții îți vin pe WhatsApp
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="strip">
          <div className="wrap">
            <div className="strip-in">
              <div>
                <b>1.000+</b>
                <span>cereri trimise pe WhatsApp afacerilor care folosesc AdPilot</span>
              </div>
              <div>
                <b>≤ 4 min</b>
                <span>de când omul lasă cererea până o vezi tu</span>
              </div>
              <div>
                <b>0 parole</b>
                <span>conectare oficială prin Facebook și TikTok</span>
              </div>
              <div>
                <b>495 lei</b>
                <span>pe lună, fără contract, anulezi oricând</span>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="cum">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Cum funcționează</p>
              <h2>Trei pași. Nu trebuie să știi nimic despre reclame.</h2>
              <p>Dacă știi să trimiți un mesaj pe WhatsApp, știi să folosești AdPilot.</p>
            </div>

            <div className="row">
              <div>
                <div className="row-num">01</div>
                <h3>Conectezi Facebook sau TikTok</h3>
                <p>
                  Apeși un buton și alegi pagina. Nu ne dai nicio parolă. Verificăm singuri dacă ai
                  tot ce trebuie: pagina, contul de reclame și cardul. Dacă lipsește ceva, îți
                  spunem exact ce să apeși, iar dacă te blochezi, te ajută un om.
                </p>
                <span className="time">≈ 1 minut</span>
              </div>
              <div className="frag">
                <div className="frag-title">Conectare</div>
                <div className="pick">
                  <span className="ico">
                    <Icon n="fb" />
                  </span>
                  <div>
                    <b>Facebook și Instagram</b>
                    <span>Pagina și contul de reclame</span>
                  </div>
                  <span className="go">
                    <Icon n="arrow" />
                  </span>
                </div>
                <div className="pick">
                  <span className="ico">
                    <Icon n="tt" />
                  </span>
                  <div>
                    <b>TikTok</b>
                    <span>Contul de business</span>
                  </div>
                  <span className="go">
                    <Icon n="arrow" />
                  </span>
                </div>
                <ul className="checks">
                  {[
                    ["Pagina", "Clinica Dr. Popescu"],
                    ["Contul de reclame", "Activ"],
                    ["Cardul pentru reclame", "Adăugat"],
                  ].map(([a, b]) => (
                    <li key={a}>
                      <span className="ok-dot">
                        <Icon n="check" />
                      </span>
                      {a}
                      <em>{b}</em>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="row">
              <div>
                <div className="row-num">02</div>
                <h3>Spui ce vrei să promovezi</h3>
                <p>
                  Scrii oferta, alegi orașul și cât vrei să dai pe zi. Textul și publicul le facem
                  noi. Vezi reclama exact cum apare pe Facebook, înainte să plătești ceva.
                </p>
                <span className="time">≈ 3 minute</span>
              </div>
              <div className="frag">
                <div className="frag-title">Campanie nouă</div>
                <div className="mini-field">
                  <small>Ce promovezi?</small>
                  <b>Implant dentar, de la 2.990 lei</b>
                </div>
                <div className="mini-row">
                  <div className="mini-field">
                    <small>Unde?</small>
                    <b>Pitești + 10 km</b>
                  </div>
                  <div className="mini-field">
                    <small>Buget pe zi</small>
                    <b>40 lei</b>
                  </div>
                </div>
                <span className="tagline">
                  <Icon n="bulb" />
                  Textul, publicul și formularul le face AdPilot
                </span>
              </div>
            </div>

            <div className="row">
              <div>
                <div className="row-num">03</div>
                <h3>Clienții îți vin pe WhatsApp</h3>
                <p>
                  Fiecare om care lasă o cerere îți apare pe WhatsApp în câteva minute, cu nume,
                  telefon și buton de răspuns. Seara primești cifrele zilei. Vrei alt buget? Îi
                  scrii, la orice oră.
                </p>
                <span className="time">tot timpul, 24 din 7</span>
              </div>
              <div className="frag frag-wa">
                <div className="msg">
                  🔔 <b>Cerere nouă</b>
                  <br />
                  Maria Ionescu · 0745 318 220
                  <br />
                  Vrea: programare la implant<span className="t">09:47</span>
                  <span className="wa-btn">Scrie-i pe WhatsApp</span>
                </div>
                <div className="msg out">
                  Crește bugetul la 60 de lei pe zi<span className="t">23:04</span>
                </div>
                <div className="msg">
                  Gata ✅ De mâine campania merge cu 60 de lei pe zi.
                  <span className="t">23:04</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Agenție sau AdPilot</p>
              <h2>Aceleași reclame. Fără să aștepți pe nimeni.</h2>
            </div>
            <table className="cmp">
              <thead>
                <tr>
                  <th />
                  <th>Agenție de marketing</th>
                  <th className="us">AdPilot</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cost pe lună</td>
                  <td>
                    <span className="big strike">2.500+ lei</span>
                  </td>
                  <td className="us">
                    <span className="big">495 lei</span>
                  </td>
                </tr>
                {[
                  [
                    "Când pornește reclama",
                    "După întâlniri și propuneri, de obicei în 1–2 săptămâni",
                    "Azi, imediat ce o aprobă Facebook",
                  ],
                  [
                    "Unde vezi clienții",
                    "Într-un tabel sau pe email, când ajungi să te uiți",
                    "Pe WhatsApp, în câteva minute",
                  ],
                  [
                    "Când vrei o schimbare",
                    "Scrii un email și aștepți răspunsul",
                    "Scrii pe WhatsApp, la orice oră",
                  ],
                  ["Rapoarte", "La final de lună", "În fiecare seară"],
                  ["Contract", "Adesea minimum 3–6 luni", "Anulezi oricând"],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td>{b}</td>
                    <td className="us">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="case">
              <div className="case-l">
                <p className="kicker">Rezultat real</p>
                <h3>Un studio de yoga din Pitești, prima campanie cu AdPilot.</h3>
                <p>
                  Ofertă simplă: prima ședință gratuită. Fiecare cerere a ajuns pe WhatsApp-ul
                  proprietarului în maximum 4 minute.
                </p>
                <p className="src">Cifre din contul de reclame al clientului, noiembrie 2026.</p>
              </div>
              <div className="case-r">
                <div className="stat">
                  <b>40</b>
                  <span>de cereri cu nume și telefon</span>
                </div>
                <div className="stat">
                  <b>5,89 lei</b>
                  <span>pe o cerere</span>
                </div>
                <div className="stat">
                  <b>236 lei</b>
                  <span>buget de reclame, în total</span>
                </div>
                <div className="stat">
                  <b>≤ 4 min</b>
                  <span>până la mesajul pe WhatsApp</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="pret" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Preț</p>
              <h2>Un singur preț. Știi exact unde merge fiecare leu.</h2>
            </div>
            <div className="price-grid">
              <div className="plan">
                <p className="kicker">AdPilot</p>
                <div className="amount">
                  <b>495</b>
                  <span>lei pe lună</span>
                </div>
                <p className="sub">Plătești abia după ce vezi campania gata. Anulezi oricând.</p>
                <ul>
                  {[
                    "Campanii pe Facebook, Instagram și TikTok",
                    "Textul, publicul și formularul, făcute de AdPilot",
                    "Fiecare cerere pe WhatsApp, în câteva minute",
                    "Cifrele zilei, în fiecare seară",
                    "Schimbi bugetul sau pui pauză scriind un mesaj",
                    "Un om te ajută dacă ai probleme cu contul de Facebook",
                  ].map((t) => (
                    <li key={t}>
                      <Icon n="check" />
                      {t}
                    </li>
                  ))}
                </ul>
                <a className="btn btn-block" href="/cont-nou">
                  Pornește campania <Icon n="arrow" />
                </a>
                <p className="fine">Fără contract. Fără costuri ascunse.</p>
              </div>
              <div className="side-stack">
                <div className="box">
                  <h3>Unde merg banii</h3>
                  <p>
                    Bugetul de reclame nu trece prin noi. Îl plătești direct la Facebook, de pe
                    cardul tău, și îl schimbi oricând.
                  </p>
                  <div className="money">
                    <div className="money-row">
                      <b>Abonament AdPilot</b>
                      <span>către AdPilot, lunar</span>
                      <em>495 lei</em>
                    </div>
                    <div className="money-row fb">
                      <b>Bugetul tău de reclame</b>
                      <span>direct la Facebook, ex. 40 lei pe zi</span>
                      <em>≈ 1.200 lei</em>
                    </div>
                  </div>
                </div>
                <div className="box guar">
                  <span className="seal">
                    <Icon n="shield" />
                    Garanție de 30 de zile
                  </span>
                  <h3>Dacă nu vin cererile, lucrăm gratis până vin.</h3>
                  <p>
                    Dacă în primele 30 de zile campania nu aduce cel puțin 20 de cereri, continuăm
                    fără să plătești abonamentul până ajungi la 20.
                  </p>
                  <small>
                    Condiții: buget de minimum 40 de lei pe zi și campania pornită continuu.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">După ce plătești</p>
              <h2>Ce se întâmplă, minut cu minut.</h2>
            </div>
            <ol className="flow">
              {[
                ["minutul 0", "Plătești 495 lei", "Primești chitanța pe email."],
                ["în câteva minute", "Campania pleacă la Facebook", "Exact cum ai văzut-o."],
                [
                  "de obicei câteva ore",
                  "Facebook o verifică",
                  "Te anunțăm pe WhatsApp când e aprobată.",
                ],
                ["aceeași zi", "Reclama e live", "Primești mesajul „Campania ta e live”."],
                ["de acum", "Cererile vin pe WhatsApp", "Cu nume, telefon și buton de răspuns."],
              ].map(([a, b, c]) => (
                <li key={b}>
                  <small>{a}</small>
                  <b>{b}</b>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="sec" id="intrebari" style={{ paddingTop: 0 }}>
          <div className="wrap faq">
            <div>
              <p className="kicker">Întrebări</p>
              <h2>Ce ne întreabă oamenii înainte să plătească.</h2>
              <div className="founder">
                <div className="av">DD</div>
                <div>
                  <p>
                    <b>Daniel, fondatorul AdPilot.</b> Dacă ai o întrebare care nu e aici, scrie-mi
                    direct pe WhatsApp. Îți răspund eu.
                  </p>
                  <a
                    className="btn btn-wa btn-sm"
                    href={help("Salut Daniel, am o întrebare despre AdPilot:")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon n="wa" />
                    Scrie-i lui Daniel
                  </a>
                </div>
              </div>
            </div>
            <div className="faq-list">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span className="pm">
                      <Icon n="plus" />
                    </span>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final">
          <div className="wrap final-in">
            <h2>Prima ta campanie poate fi live azi.</h2>
            <p>Durează cam 5 minute. Plătești doar după ce vezi reclama gata.</p>
            <a className="btn btn-ink" href="/cont-nou">
              Pornește campania <Icon n="arrow" />
            </a>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <Logo />
          <span>© 2026 AdPilot · Danu Daniel Andrei PFA</span>
          <a href="/terms-of-service">Termeni</a>
          <a href="/privacy-policy">Confidențialitate</a>
          <a href="/refund-policy">Rambursări</a>
          <button type="button" className="foot-btn" onClick={() => openCookiePreferences()}>
            Cookie-uri
          </button>
          <a
            className="r"
            href={help("Salut Daniel, am o întrebare despre AdPilot:")}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact pe WhatsApp
          </a>
          <div className="foot-anpc">
            <a
              href="https://anpc.ro/ce-este-sal/"
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label="ANPC — Soluționarea Alternativă a Litigiilor"
            >
              <img
                src={anpcSal}
                alt="ANPC — Soluționarea Alternativă a Litigiilor"
                loading="lazy"
                width={250}
                height={50}
              />
            </a>
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label="ANPC — Soluționarea Online a Litigiilor"
            >
              <img
                src={anpcSol}
                alt="ANPC — Soluționarea Online a Litigiilor"
                loading="lazy"
                width={250}
                height={50}
              />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
