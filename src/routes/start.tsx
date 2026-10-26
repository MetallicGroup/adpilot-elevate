import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/phone-auth.functions";
import {
  getStartState,
  saveStartAnswers,
  saveStartEmail,
  saveStartPhotos,
  saveStartTargets,
  startDemo,
  type StartGoal,
  type StartState,
  type StartTarget,
} from "@/lib/start.functions";
import { startMetaOAuth } from "@/lib/meta-oauth.functions";
import { startTikTokOAuth } from "@/lib/tiktok-oauth.functions";
import { getStoredReferral, referralFromSearch, storeReferral } from "@/lib/referral";
import { fbCompleteRegistration } from "@/lib/meta-pixel";
import { tkTrack } from "@/lib/tiktok-pixel";
import startCss from "../styles/start.css?url";

type StartSearch = {
  login?: string;
  /** Cale internă unde ne întoarcem după login (ex. /pricing?plan=pro_monthly). */
  redirect?: string;
  ref?: string;
  goal?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  meta?: string;
  tiktok?: string;
  /** Venit de pe /auth cu Facebook/Google, dar fără cont: îi spunem să-și facă unul aici. */
  nou?: string;
};

export const Route = createFileRoute("/start")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): StartSearch => {
    const out: StartSearch = {};
    for (const k of ["login", "ref", "goal", "utm_source", "utm_medium", "utm_campaign", "meta", "tiktok", "nou"] as const) {
      if (typeof s[k] === "string") out[k] = s[k] as string;
    }
    if (typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//")) out.redirect = s.redirect;
    return out;
  },
  head: () => ({
    meta: [{ title: "Începe gratuit — AdPilot" }, { name: "robots", content: "noindex" }],
    links: [{ rel: "stylesheet", href: startCss }],
  }),
  component: StartPage,
});

type Screen = "boot" | "phone" | "code" | "email" | "niche" | "goal" | "prep" | "work";

const NICHES = ["Service auto", "Salon / frizerie", "Cabinet stomatologic", "Restaurant", "Magazin online", "Sală de fitness", "Agenție imobiliară", "Altceva"];

const GOALS: Array<{ k: StartGoal; t: string; d: string; phrase: string; icon: ReactNode }> = [
  {
    k: "calls",
    t: "Apeluri",
    d: "Oameni care te sună direct",
    phrase: "apeluri de la clienți",
    icon: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  },
  {
    k: "forms",
    t: "Formulare",
    d: "Nume și telefon, completate în reclamă",
    phrase: "formulare completate",
    icon: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
  },
  {
    k: "web",
    t: "Vizite pe site",
    d: "Click-uri către site-ul tău",
    phrase: "vizite pe site",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
  },
  {
    k: "shop",
    t: "Vânzări online",
    d: "Comenzi în magazinul tău",
    phrase: "comenzi în magazinul online",
    icon: (
      <>
        <path d="M5 8h14l-1.2 11H6.2L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
  },
];
const goalPhrase = (g: StartGoal | null) => GOALS.find((x) => x.k === g)?.phrase ?? null;

const GEN_STEPS = [
  "Scriu scenariul și textul în română",
  "Creez cadrele din pozele tale",
  "Înregistrez vocea și sincronizez buzele",
  "Animez cadrele",
  "Montez subtitrările și efectele",
];
const NAMES: Record<StartTarget, string> = { fb: "Facebook și Instagram", tt: "TikTok" };

function digitsOf(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("40") && d.length > 9) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}
const formatPhone = (d: string) => d.replace(/(\d{3})(\d{0,3})(\d{0,3})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));

function errMsg(e: unknown): string {
  return (e as Error)?.message || "A apărut o eroare. Încearcă din nou.";
}

// ───────────────────────────── pagina ─────────────────────────────

function StartPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("boot");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [masked, setMasked] = useState("");
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState<StartGoal | null>(null);
  const [state, setState] = useState<StartState | null>(null);
  const fetchState = useServerFn(getStartState);

  const load = useCallback(async () => {
    const s = await fetchState();
    setState(s);
    return s;
  }, [fetchState]);

  useEffect(() => {
    const code = referralFromSearch(search);
    if (code) storeReferral(code);
  }, [search]);

  // Revenirea de la Facebook / TikTok.
  useEffect(() => {
    if (search.meta === "error") toast.error("Conectarea cu Facebook nu a mers. Încearcă din nou.");
    if (search.tiktok === "error") toast.error("Conectarea cu TikTok nu a mers. Încearcă din nou.");
    if (search.meta || search.tiktok) navigate({ to: "/start", search: {}, replace: true });
  }, [search.meta, search.tiktok, navigate]);

  const afterLogin = useCallback(
    async (isNew: boolean) => {
      let s: StartState;
      try {
        s = await load();
      } catch {
        setScreen("phone");
        return;
      }
      // Conturile vechi (fără onboarding nou) și cele care au primit deja clipul merg în aplicație.
      if (!s.hasSession || (!isNew && s.demo.status === "delivered")) {
        if (search.redirect) window.location.assign(search.redirect);
        else navigate({ to: "/dashboard" });
        return;
      }
      setNiche(s.niche ?? "");
      setGoal(s.goal);
      setScreen(s.needsEmail ? "email" : s.niche ? "work" : "niche");
    },
    [load, navigate, search.redirect],
  );

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) void afterLogin(false);
      else setScreen("phone");
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = screen === "niche" ? 1 : screen === "goal" ? 2 : screen === "prep" || screen === "work" ? 4 : 0;

  return (
    <div className="st">
      <div className="aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="app">
        <header className="top">
          <a className="logo" href="/">
            <img src="/adpilot-icon.png" alt="" />
            AdPilot
          </a>
          <div className="prog" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <b key={i} className={i < step ? "done" : i === step ? "now" : ""} />
            ))}
          </div>
          <div className="prog-label">Pasul {Math.min(step + 1, 4)} din 4</div>
        </header>

        {screen === "boot" && (
          <div className="center-load">
            <span className="spin" />
          </div>
        )}
        {screen === "phone" && (
          <PhoneScreen
            login={!!search.login}
            noAccount={!!search.nou}
            digits={phoneDigits}
            onDigits={setPhoneDigits}
            onSent={(m) => {
              setMasked(m);
              setScreen("code");
            }}
            niche={niche}
            goal={goal}
          />
        )}
        {screen === "code" && (
          <CodeScreen
            digits={phoneDigits}
            masked={masked}
            onBack={() => setScreen("phone")}
            onVerified={(isNew) => void afterLogin(isNew)}
            niche={niche}
            goal={goal}
          />
        )}
        {screen === "email" && (
          <EmailScreen
            niche={niche}
            goal={goal}
            onDone={async () => {
              const s = await load().catch(() => null);
              setScreen(s?.niche ? "work" : "niche");
            }}
          />
        )}
        {screen === "niche" && (
          <NicheScreen niche={niche} goal={goal} onNiche={setNiche} onNext={() => setScreen("goal")} />
        )}
        {screen === "goal" && (
          <GoalScreen
            niche={niche}
            goal={goal}
            onGoal={setGoal}
            onDone={() => setScreen("prep")}
          />
        )}
        {screen === "prep" && (
          <PrepScreen
            niche={niche}
            goal={goal}
            onDone={async () => {
              await load().catch(() => null);
              setScreen("work");
            }}
          />
        )}
        {screen === "work" && state && (
          <Work state={state} niche={niche} goal={goal} reload={load} />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── cardul asistent (dreapta) ─────────────────────────────

function BotAvatar({ size = 36 }: { size?: number }) {
  return (
    <div className="av" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M4 12.5 20 5l-4.5 14-3.5-5.5L4 12.5Zm8 1L20 5" />
      </svg>
    </div>
  );
}

function MiniCard({ niche, goal }: { niche: string; goal: StartGoal | null }) {
  const g = goalPhrase(goal);
  return (
    <aside className="aside" aria-hidden="true">
      <div className="mini">
        <div className="mini-head">
          <BotAvatar />
          <div>
            <b>Asistent AdPilot</b>
            <small>● online</small>
          </div>
        </div>
        <div className="bub">Salut! Sunt asistentul tău AdPilot. Creez clipuri și reclame care aduc clienți.</div>
        <div className="bub">
          Am notat: afacere {niche ? <b>{niche.toLowerCase()}</b> : <span className="ph">…</span>}, obiectiv{" "}
          {g ? <b>{g}</b> : <span className="ph">…</span>}.
        </div>
        <div className="bub">Hai să facem primul tău clip. Am nevoie de 2–3 poze.</div>
        <div className="cap">Așa începe conversația ta</div>
      </div>
    </aside>
  );
}

// ───────────────────────────── 1. telefon ─────────────────────────────

function PhoneScreen(props: {
  login: boolean;
  noAccount?: boolean;
  digits: string;
  onDigits: (d: string) => void;
  onSent: (masked: string) => void;
  niche: string;
  goal: StartGoal | null;
}) {
  const send = useServerFn(requestPhoneCode);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = props.digits;
  const valid = d.length === 9 && d.startsWith("7");
  const wrong = d.length === 9 && !valid;

  async function submit() {
    if (!valid || !consent || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await send({ data: { phone: `0${d}`, consent: true } });
      props.onSent(r.masked);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen" aria-labelledby="h-phone">
      <div className="q">
        <div className="qmain">
          <p className="eyebrow">
            {props.noAccount ? "Nu ai încă cont" : props.login ? "Bine ai revenit" : "Începe gratuit"}
          </p>
          <h1 id="h-phone">
            {props.login ? "Intră cu numărul tău de " : "Pune numărul tău de "}
            <span className="grad">WhatsApp</span>
          </h1>
          <p className="lead">
            {props.noAccount
              ? "Hai să-l facem în 1 minut. Acolo îți trimit clipul, pozele și rezultatele reclamelor."
              : props.login
              ? "Îți trimitem un cod pe WhatsApp. Fără parolă."
              : "Acolo îți trimit clipul, pozele și rezultatele reclamelor. Fără parolă, fără formulare lungi."}
          </p>
          <div className="field">
            <span className="pre">
              <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
                <rect width="7.4" height="16" fill="#002b7f" />
                <rect x="7.3" width="7.4" height="16" fill="#fcd116" />
                <rect x="14.6" width="7.4" height="16" fill="#ce1126" />
              </svg>
              +40
            </span>
            <input
              id="st-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="7xx xxx xxx"
              aria-label="Număr de telefon"
              autoFocus
              value={formatPhone(d)}
              onChange={(e) => props.onDigits(digitsOf(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          <div className={`hint ${wrong || error ? "err" : ""}`}>
            {error ?? (wrong ? "Numărul trebuie să înceapă cu 7 și să aibă 9 cifre." : "Doar numere românești de mobil.")}
          </div>
          <label className="check">
            <input id="st-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="box">
              <svg viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2.5 7.5 3 3 6-7" />
              </svg>
            </span>
            <span>
              Sunt de acord să primesc pe WhatsApp mesaje de la AdPilot: codul de autentificare, clipul și reclamele mele.
              Mă pot opri oricând.
            </span>
          </label>
          <button className="btn block" disabled={!valid || !consent || busy} onClick={() => void submit()}>
            {busy ? <span className="spin" /> : null}
            Trimite codul pe WhatsApp
          </button>
          <p className="fine">
            {props.login
              ? "Ai cont cu email? "
              : "Primul clip și pozele sunt gratuite. Ai deja cont cu email? "}
            <a href="/auth?mode=signin" style={{ color: "inherit" }}>
              Intră cu emailul
            </a>
            .
          </p>
        </div>
        <MiniCard niche={props.niche} goal={props.goal} />
      </div>
    </section>
  );
}

// ───────────────────────────── 2. cod ─────────────────────────────

function CodeScreen(props: {
  digits: string;
  masked: string;
  onBack: () => void;
  onVerified: (isNew: boolean) => void;
  niche: string;
  goal: StartGoal | null;
}) {
  const verify = useServerFn(verifyPhoneCode);
  const resend = useServerFn(requestPhoneCode);
  const [vals, setVals] = useState<string[]>(["", "", "", "", "", ""]);
  const [state, setState] = useState<"idle" | "busy" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(30);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(code: string) {
    if (state !== "idle") return;
    setState("busy");
    setError(null);
    try {
      const r = await verify({ data: { phone: `0${props.digits}`, code, referral: getStoredReferral() } });
      const { data: auth, error: vErr } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
      if (vErr) throw new Error("Nu am putut porni sesiunea. Încearcă din nou.");
      // Înscriere nouă: evenimentul din browser (cu cookie-urile de click ale reclamei),
      // cu același event_id ca cel trimis de server, ca platformele să-l numere o singură dată.
      if (r.isNew && auth?.user?.id) {
        fbCompleteRegistration(`reg_${auth.user.id}`);
        tkTrack("CompleteRegistration", {}, `reg_${auth.user.id}`);
      }
      setState("ok");
      setTimeout(() => props.onVerified(r.isNew), 600);
    } catch (e) {
      setError(errMsg(e));
      setState("idle");
      setVals(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    }
  }

  function setAt(i: number, v: string) {
    const next = [...vals];
    next[i] = v;
    setVals(next);
    const code = next.join("");
    if (code.length === 6) void submit(code);
  }

  return (
    <section className="screen" aria-labelledby="h-code">
      <div className="q">
        <div className="qmain">
          <p className="eyebrow">Confirmă numărul</p>
          <h1 id="h-code">
            Ți-am trimis un <span className="grad">cod</span>
          </h1>
          <p className="lead">
            Introdu cele 6 cifre primite pe WhatsApp la <b>{props.masked}</b>.
          </p>
          <div className={`codes ${state === "ok" ? "ok" : ""}`} role="group" aria-label="Cod de 6 cifre">
            {vals.map((v, i) => (
              <input
                key={i}
                id={`st-code-${i}`}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Cifra ${i + 1}`}
                value={v}
                disabled={state !== "idle"}
                onChange={(e) => {
                  const c = e.target.value.replace(/\D/g, "").slice(-1);
                  setAt(i, c);
                  if (c && i < 5) refs.current[i + 1]?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !vals[i] && i > 0) refs.current[i - 1]?.focus();
                }}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                  if (!t) return;
                  e.preventDefault();
                  const next = ["", "", "", "", "", ""].map((_, k) => t[k] ?? "");
                  setVals(next);
                  if (t.length === 6) void submit(t);
                  else refs.current[t.length]?.focus();
                }}
              />
            ))}
          </div>
          <div className={`hint ${error ? "err" : state === "ok" ? "ok" : ""}`}>
            {error ?? (state === "ok" ? "Număr confirmat." : state === "busy" ? "Verific codul…" : "Apasă „Copiază codul” în mesajul de pe WhatsApp și lipește-l aici.")}
          </div>
          <div className="row">
            <button className="linkbtn" type="button" onClick={props.onBack}>
              Schimbă numărul
            </button>
            <button
              className="linkbtn"
              type="button"
              disabled={wait > 0}
              onClick={async () => {
                try {
                  await resend({ data: { phone: `0${props.digits}`, consent: true } });
                  setWait(30);
                  toast.success("Ți-am trimis un cod nou.");
                } catch (e) {
                  setError(errMsg(e));
                }
              }}
            >
              {wait > 0 ? `Retrimite în ${wait} s` : "Retrimite codul"}
            </button>
          </div>
        </div>
        <MiniCard niche={props.niche} goal={props.goal} />
      </div>
    </section>
  );
}

// ───────────────────────────── 3. afacere ─────────────────────────────

// ───────────────────────────── 2b. email ─────────────────────────────

function EmailScreen(props: { niche: string; goal: StartGoal | null; onDone: () => void }) {
  const save = useServerFn(saveStartEmail);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());

  async function submit() {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await save({ data: { email: email.trim() } });
      props.onDone();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <section className="screen" aria-labelledby="h-email">
      <div className="q">
        <div className="qmain">
          <p className="eyebrow">Încă un pas</p>
          <h1 id="h-email">
            Adaugă adresa ta de <span className="grad">email</span>
          </h1>
          <p className="lead">O folosim pentru facturi și ca a doua cale de intrare în cont. Nu primești spam.</p>
          <div className="field">
            <input
              id="st-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="nume@firma.ro"
              aria-label="Adresa de email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          <div className={`hint ${error ? "err" : ""}`}>{error ?? " "}</div>
          <div className="row">
            <button className="btn" disabled={!ok || busy} onClick={() => void submit()}>
              {busy ? <span className="spin" /> : null}
              Continuă
            </button>
          </div>
        </div>
        <MiniCard niche={props.niche} goal={props.goal} />
      </div>
    </section>
  );
}

function NicheScreen(props: { niche: string; goal: StartGoal | null; onNiche: (v: string) => void; onNext: () => void }) {
  const ok = props.niche.trim().length >= 2;
  return (
    <section className="screen" aria-labelledby="h-niche">
      <div className="q">
        <div className="qmain">
          <p className="eyebrow">Despre tine</p>
          <h1 id="h-niche">
            Ce fel de <span className="grad">afacere</span> ai?
          </h1>
          <p className="lead">Două-trei cuvinte sunt de ajuns. Din ele aleg ideile și stilul clipului.</p>
          <div className="field">
            <input
              id="st-niche"
              type="text"
              maxLength={60}
              autoComplete="off"
              autoFocus
              placeholder="ex: service auto"
              aria-label="Tipul afacerii"
              value={props.niche}
              onChange={(e) => props.onNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ok && props.onNext()}
            />
          </div>
          <div className="chips">
            {NICHES.map((n) => (
              <button key={n} type="button" className="chip" onClick={() => props.onNiche(n === "Altceva" ? "" : n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn" disabled={!ok} onClick={props.onNext}>
              Continuă
            </button>
          </div>
        </div>
        <MiniCard niche={props.niche} goal={props.goal} />
      </div>
    </section>
  );
}

// ───────────────────────────── 4. obiectiv ─────────────────────────────

function GoalScreen(props: { niche: string; goal: StartGoal | null; onGoal: (g: StartGoal | null) => void; onDone: () => void }) {
  const save = useServerFn(saveStartAnswers);
  const [busy, setBusy] = useState(false);

  async function choose(g: StartGoal | null) {
    if (busy) return;
    props.onGoal(g);
    setBusy(true);
    try {
      await save({ data: { niche: props.niche, goal: g } });
      setTimeout(props.onDone, 350);
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <section className="screen" aria-labelledby="h-goal">
      <div className="q">
        <div className="qmain">
          <p className="eyebrow">Ce îți dorești</p>
          <h1 id="h-goal">
            Ce vrei să <span className="grad">primești</span> din reclame?
          </h1>
          <p className="lead">Alege un singur lucru. Îl poți schimba oricând.</p>
          <div className="goals">
            {GOALS.map((g) => (
              <button
                key={g.k}
                type="button"
                className="goal"
                aria-pressed={props.goal === g.k}
                disabled={busy}
                onClick={() => void choose(g.k)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {g.icon}
                </svg>
                <b>{g.t}</b>
                <span>{g.d}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <button className="linkbtn" type="button" disabled={busy} onClick={() => void choose(null)}>
              Sari peste, aleg mai târziu
            </button>
          </div>
        </div>
        <MiniCard niche={props.niche} goal={props.goal} />
      </div>
    </section>
  );
}

// ───────────────────────────── tranziție ─────────────────────────────

function PrepScreen(props: { niche: string; goal: StartGoal | null; onDone: () => void }) {
  const items = [
    `Am notat afacerea: ${props.niche.toLowerCase()}`,
    goalPhrase(props.goal) ? `Obiectiv: ${goalPhrase(props.goal)}` : "Obiectiv: îl stabilim împreună",
    "Pregătesc spațiul tău de lucru",
  ];
  const [n, setN] = useState(0);
  const done = useRef(props.onDone);
  done.current = props.onDone;
  useEffect(() => {
    if (n > items.length * 2) {
      done.current();
      return;
    }
    const t = setTimeout(() => setN((x) => x + 1), 330);
    return () => clearTimeout(t);
  }, [n, items.length]);
  return (
    <section className="screen" aria-live="polite">
      <div className="q single">
        <div className="qmain">
          <h1>
            Îți pregătesc <span className="grad">asistentul</span>
          </h1>
          <ul className="steps" style={{ maxWidth: "none", marginTop: 26 }}>
            {items.map((t, i) => (
              <li key={t} className={n >= i * 2 + 2 ? "ok" : n >= i * 2 + 1 ? "act" : ""}>
                <span className="s" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── spațiul de lucru ─────────────────────────────

type Item = { key: string; typing: boolean; node: ReactNode };

const ICON_FB = (
  <svg viewBox="0 0 24 24" fill="#fff">
    <path d="M13.5 21v-7.5H16l.5-3h-3V8.7c0-.9.3-1.5 1.6-1.5h1.5V4.5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v3h2.5V21h3Z" />
  </svg>
);
const ICON_TT = (
  <svg viewBox="0 0 24 24" fill="#fff">
    <path d="M16.5 3a4.6 4.6 0 0 0 3.5 3.9v3a7.6 7.6 0 0 1-3.5-1v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.8 2.5V3h3Z" />
  </svg>
);

async function toJpeg(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.86));
  } catch {
    return file;
  }
}

function Work(props: { state: StartState; niche: string; goal: StartGoal | null; reload: () => Promise<StartState> }) {
  const { state, reload } = props;
  const navigate = useNavigate();
  const savePhotos = useServerFn(saveStartPhotos);
  const saveTargets = useServerFn(saveStartTargets);
  const runDemo = useServerFn(startDemo);
  const metaOAuth = useServerFn(startMetaOAuth);
  const ttOAuth = useServerFn(startTikTokOAuth);
  const [tab, setTab] = useState<"chat" | "result">("chat");
  const [uploading, setUploading] = useState<string[] | null>(null);
  const [connecting, setConnecting] = useState<StartTarget | null>(null);
  const [choosing, setChoosing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const msgsRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const niche = (state.niche ?? props.niche).toLowerCase();
  const goal = state.goal ?? props.goal;
  const photos = state.photos;
  const { connected, targets, demo } = state;
  const connectedList = (["fb", "tt"] as StartTarget[]).filter((k) => connected[k]);
  const allConnected = targets.length > 0 && targets.every((t) => connected[t]);
  const demoActive = demo.status === "queued" || demo.status === "running";
  const demoDone = demo.status === "ready" || demo.status === "delivered";

  // Ambele conturi conectate fără alegere explicită → reclame pe amândouă.
  useEffect(() => {
    if (!targets.length && connectedList.length === 2 && photos.length) {
      void saveTargets({ data: { targets: ["fb", "tt"] } }).then(reload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.length, connectedList.length, photos.length]);

  // Totul conectat → pornim clipul.
  useEffect(() => {
    if (!allConnected || !photos.length || (demo.status !== "none" && demo.status !== "failed") || startedRef.current) return;
    if (demo.status === "failed") return; // reluarea doar la cerere
    startedRef.current = true;
    runDemo()
      .then(reload)
      .catch((e) => {
        startedRef.current = false;
        toast.error(errMsg(e));
      });
  }, [allConnected, photos.length, demo.status, runDemo, reload]);

  // Progres: întrebăm serverul cât timp lucrează.
  useEffect(() => {
    if (!demoActive) return;
    const t = setInterval(() => void reload().catch(() => null), 5000);
    return () => clearInterval(t);
  }, [demoActive, reload]);

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name)).slice(0, 3);
    if (!files.length) return;
    setUploading(files.map((f) => URL.createObjectURL(f)));
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("Sesiunea a expirat. Reîncarcă pagina.");
      const paths: string[] = [];
      for (const [i, f] of files.entries()) {
        const blob = await toJpeg(f);
        const path = `${uid}/photos/${Date.now()}_${i}.jpg`;
        const { error } = await supabase.storage.from("onboarding").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error("Nu am putut încărca poza. Încearcă din nou.");
        paths.push(path);
      }
      await savePhotos({ data: { paths } });
      await reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(null);
    }
  }

  async function connect(k: StartTarget) {
    if (connecting) return;
    setConnecting(k);
    try {
      const r = k === "fb" ? await metaOAuth({ data: { returnTo: "/start" } }) : await ttOAuth({ data: { returnTo: "/start" } });
      window.location.href = r.url;
    } catch (e) {
      toast.error(errMsg(e));
      setConnecting(null);
    }
  }

  async function chooseTargets(t: StartTarget[]) {
    setChoosing(true);
    try {
      await saveTargets({ data: { targets: t } });
      await reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setChoosing(false);
    }
  }

  // ── mesajele, derivate din stare (rămân la fel și după revenirea de la Facebook) ──
  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    const bot = (key: string, node: ReactNode, cls = "m") => out.push({ key, typing: true, node: <div className={cls}>{node}</div> });
    const raw = (key: string, node: ReactNode) => out.push({ key, typing: false, node });
    const g = goalPhrase(goal);

    bot("hi", "Salut! Sunt asistentul tău AdPilot. Creez clipuri și reclame care aduc clienți.");
    bot(
      "noted",
      <>
        Am notat: afacere <b>{niche}</b>
        {g ? (
          <>
            , obiectiv: <b>{g}</b>
          </>
        ) : null}
        .
      </>,
    );
    bot(
      "photos-ask",
      <>
        Ca să fac primul tău clip am nevoie de <b>2–3 poze</b> cu afacerea ta: locul, echipa sau ce lucrezi. Merg și cele făcute cu
        telefonul.
      </>,
    );

    const thumbs = uploading ?? photos.map((p) => p.url ?? "");
    if (!thumbs.length) return out;
    raw(
      "photos",
      <div className="m me photos">
        <div className="thumbs">
          {thumbs.slice(0, 3).map((u, i) => (
            <i key={i} className={uploading ? "up" : ""} style={{ backgroundImage: u ? `url("${u}")` : undefined }} />
          ))}
        </div>
      </div>,
    );
    if (uploading) return out;

    bot(
      "connect-ask",
      <>
        Am primit pozele. Ca să creez clipul și să-l pot publica, conectează <b>cel puțin un cont</b>:
      </>,
    );
    const first = connectedList[0] ?? null;
    raw(
      "connect-1",
      <ConnectBlock
        keys={["fb", "tt"]}
        connected={connected}
        connecting={connecting}
        lockOthers={!!first && !targets.length}
        onConnect={connect}
        note
      />,
    );
    if (!first) return out;

    if (!targets.length) {
      if (connectedList.length === 2) return out; // salvăm automat ambele (efectul de mai sus)
      const other: StartTarget = first === "fb" ? "tt" : "fb";
      bot(
        "targets-ask",
        <>
          {NAMES[first]} {first === "fb" ? "conectate" : "conectat"} ✓. Vrei să pornești reclama doar pe {NAMES[first]}, sau și pe{" "}
          {NAMES[other]}?
        </>,
      );
      raw(
        "targets-choice",
        <div className="acts">
          <button className="btn ghost block" disabled={choosing} onClick={() => void chooseTargets([first])}>
            Doar pe {NAMES[first]}
          </button>
          <button className="btn ghost block" disabled={choosing} onClick={() => void chooseTargets(["fb", "tt"])}>
            Și pe {NAMES[other]}
          </button>
        </div>,
      );
      return out;
    }

    if (connectedList.length === 1) {
      raw(
        "targets-picked",
        <div className="m me">{targets.length === 2 ? `Și pe ${NAMES[first === "fb" ? "tt" : "fb"]}` : `Doar pe ${NAMES[first]}`}</div>,
      );
    }
    const missing = targets.filter((t) => !connected[t]);
    if (missing.length) {
      bot(
        "connect-more-ask",
        <>
          Perfect. Conectează și <b>{NAMES[missing[0]]}</b> ca să pot publica pe amândouă. Clipul îl creez imediat după.
        </>,
      );
      raw("connect-2", <ConnectBlock keys={missing} connected={connected} connecting={connecting} onConnect={connect} />);
      return out;
    }

    bot(
      "starting",
      targets.length === 2 ? "Facebook, Instagram și TikTok sunt conectate. Încep să creez clipul tău." : "Conectat. Încep să creez clipul tău.",
    );
    if (demo.status === "failed") {
      bot("failed", "Clipul nu a ieșit de data asta. Apasă mai jos și îl refac.");
      raw(
        "retry",
        <div className="acts">
          <button
            className="btn ghost block"
            onClick={() =>
              void runDemo()
                .then(reload)
                .catch((e) => toast.error(errMsg(e)))
            }
          >
            Încearcă din nou
          </button>
        </div>,
      );
      return out;
    }
    bot(
      "wait",
      <>
        <span className="rd" />
        <b>Durează între 3 și 5 minute.</b> Poți ieși de pe pagină: îți trimitem clipul și pozele direct pe WhatsApp, imediat ce sunt gata.
      </>,
      demoDone ? "m cool" : "m warn",
    );
    if (demoDone) {
      bot(
        "done",
        <>
          <b>Gata!</b> Ți-am trimis un mesaj pe WhatsApp. Apasă „Trimite-mi materialele” și primești acolo clipul și pozele.
        </>,
      );
      raw(
        "go-app",
        <div className="acts">
          <button className="btn block" onClick={() => navigate({ to: "/dashboard" })}>
            Mergi în aplicație
          </button>
        </div>,
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche, goal, photos, uploading, connected, connecting, targets, demo.status, demoDone, choosing]);

  // Mesajele noi apar pe rând, cu „scrie…” înainte; la revenire pe pagină apar toate deodată.
  const [shown, setShown] = useState(() => (photos.length ? items.length : 0));
  useEffect(() => {
    if (shown > items.length) setShown(items.length);
    if (shown >= items.length) return;
    const next = items[shown];
    const t = setTimeout(() => setShown((n) => n + 1), next.typing ? 750 : 150);
    return () => clearTimeout(t);
  }, [shown, items]);
  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, items.length]);

  const awaitingPhotos = !photos.length && !uploading && shown >= 3;
  const typingNow = shown < items.length && items[shown].typing;

  return (
    <div className="work" data-tab={tab}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
          Conversație
        </button>
        <button role="tab" aria-selected={tab === "result"} onClick={() => setTab("result")}>
          Clipul tău
          {demoDone && tab !== "result" ? <span className="dot" /> : null}
        </button>
      </div>

      <section className="panel chat" aria-label="Conversație cu asistentul">
        <div className="chat-head">
          <BotAvatar />
          <div>
            <b>Asistent AdPilot</b>
            <small>● online</small>
          </div>
        </div>
        <div className="msgs" ref={msgsRef} aria-live="polite">
          {items.slice(0, shown).map((it) => (
            <div key={it.key} style={{ display: "contents" }}>
              {it.node}
            </div>
          ))}
          {typingNow ? (
            <div className="typing">
              <i />
              <i />
              <i />
            </div>
          ) : null}
        </div>
        <div className="composer">
          {awaitingPhotos ? <div className="pointer">Trimite pozele aici</div> : null}
          <button
            className={`clip ${awaitingPhotos ? "pulse" : ""}`}
            aria-label="Atașează poze"
            disabled={!awaitingPhotos}
            onClick={() => fileRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3" />
            </svg>
          </button>
          <div className="fake-in">{awaitingPhotos ? "Atașează 2–3 poze…" : "Asistentul îți scrie aici"}</div>
          <input
            ref={fileRef}
            id="st-files"
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="panel canvas" aria-label="Clipul tău">
        <Canvas state={state} active={demoActive} done={demoDone} />
      </section>
    </div>
  );
}

function ConnectBlock(props: {
  keys: StartTarget[];
  connected: { fb: boolean; tt: boolean };
  connecting: StartTarget | null;
  lockOthers?: boolean;
  note?: boolean;
  onConnect: (k: StartTarget) => void;
}) {
  const meta: Record<StartTarget, { name: string; sub: string; bg: string; icon: ReactNode }> = {
    fb: { name: "Facebook și Instagram", sub: "Pagina și contul tău de reclame", bg: "linear-gradient(135deg,#1877f2,#0a5bd0)", icon: ICON_FB },
    tt: { name: "TikTok", sub: "Contul tău TikTok", bg: "linear-gradient(135deg,#111,#2a2a2a)", icon: ICON_TT },
  };
  return (
    <div className="acts">
      {props.keys.map((k) => {
        const done = props.connected[k];
        const busy = props.connecting === k;
        const locked = !done && props.lockOthers;
        return (
          <button
            key={k}
            type="button"
            className={`conn ${done ? "done" : ""} ${busy ? "busy" : ""}`}
            disabled={done || busy || locked || !!props.connecting}
            onClick={() => props.onConnect(k)}
          >
            <span className="ic" style={{ background: meta[k].bg, boxShadow: k === "tt" ? "inset 0 0 0 1px #3a3a3a" : undefined }}>
              {meta[k].icon}
            </span>
            <span className="t">
              <b>Conectează {meta[k].name}</b>
              <small>{meta[k].sub}</small>
            </span>
            <span className="stt">{done ? "Conectat ✓" : busy ? <span className="spin" /> : locked ? "mai jos" : "Conectează"}</span>
          </button>
        );
      })}
      {props.note ? (
        <small className="note">Te duc la Facebook sau TikTok și te aduc înapoi exact aici. Conversația rămâne.</small>
      ) : null}
    </div>
  );
}

function Canvas(props: { state: StartState; active: boolean; done: boolean }) {
  const { demo, photos } = props.state;
  const [shownPct, setShownPct] = useState(demo.progress);
  useEffect(() => {
    if (!props.active) {
      setShownPct(demo.progress);
      return;
    }
    // Avansăm lin spre următorul pas, fără să trecem de ce raportează serverul + o marjă.
    const t = setInterval(() => {
      setShownPct((p) => Math.min(Math.max(p, demo.progress) + 0.35, Math.min(demo.progress + 12, 97)));
    }, 1000);
    return () => clearInterval(t);
  }, [props.active, demo.progress]);

  if (props.done && demo.videoUrl) {
    return (
      <div className="cv">
        <div className="done-wrap">
          <div className="vid">
            <video src={demo.videoUrl} controls playsInline preload="metadata" />
          </div>
          <div className="side">
            <h3>Clipul și pozele sunt gata</h3>
            <div className="meta">
              <span>Voce în română</span>
              <span>Subtitrări</span>
              <span>9:16</span>
            </div>
            {demo.imageUrls.length ? (
              <div className="imgs">
                {demo.imageUrls.map((u) => (
                  <img key={u} src={u} alt="Poză creată pentru reclamă" loading="lazy" />
                ))}
              </div>
            ) : null}
            <p>Ți le-am trimis și pe WhatsApp.</p>
          </div>
        </div>
      </div>
    );
  }

  if (props.active) {
    const idx = Math.max(0, GEN_STEPS.indexOf(demo.step ?? GEN_STEPS[0]));
    const pct = Math.round(shownPct);
    const bg = photos[0]?.url;
    return (
      <div className="cv">
        <div className="gen">
          <div className={`skel ${bg ? "has-bg" : ""}`} style={bg ? { backgroundImage: `url("${bg}")` } : undefined}>
            <span className="pc">{pct}%</span>
          </div>
          <ul className="steps">
            {GEN_STEPS.map((t, i) => (
              <li key={t} className={i < idx ? "ok" : i === idx ? "act" : ""}>
                <span className="s" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lbar">
          <div className="lbar-top">
            <span>{GEN_STEPS[idx]}</span>
            <b>{pct}%</b>
          </div>
          <div className="lbar-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progres creare clip">
            <span className="lbar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="gnote">Durează 3–5 minute. Poți închide pagina: îți trimitem totul pe WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="cv">
      <div className="ghost-phone">
        Clipul tău apare aici,
        <br />
        pe măsură ce îl creez.
      </div>
    </div>
  );
}
