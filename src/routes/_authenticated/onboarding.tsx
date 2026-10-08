import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingStatus, chooseSignupPlan, setMyEmail, type OnboardingStatus } from "@/lib/onboarding.functions";
import { SIGNUP_TRIAL_LABEL, FREE_STARTER_LABEL } from "@/lib/promo";
import { startMetaOAuth } from "@/lib/meta-oauth.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";
import { WhatsAppConnectionCard } from "@/components/whatsapp/WhatsAppConnectionCard";
import { AdAccountGate } from "@/components/onboarding/AdAccountGate";
import { GoalSetupStep } from "@/components/onboarding/goal/GoalSetupStep";

type OnboardingSearch = { meta?: string; reason?: string; limited?: string };

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s: Record<string, unknown>): OnboardingSearch => ({
    meta: typeof s.meta === "string" ? s.meta : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
    limited: typeof s.limited === "string" ? s.limited : undefined,
  }),
  component: OnboardingPage,
});

// Nuanța strălucirii de fundal pentru fiecare pas.
const GLOW = ["47,107,255", "107,61,255", "225,58,212", "31,191,95", "255,140,90"];

const PLANS = [
  {
    id: "starter_free",
    name: "Starter",
    price: "Gratuit",
    free: true,
    desc: "Gratuit — 7 zile în fiecare lună, fără card.",
    items: [
      "Asistent WhatsApp AI inclus",
      "Campanii pe Facebook & Instagram",
      "7 zile gratuite în fiecare lună",
    ],
  },
  {
    id: "pro_monthly",
    name: "Pro",
    price: "495 lei",
    featured: true,
    desc: "Pentru afacerile care vor să crească rapid.",
    items: [
      "Campanii nelimitate, non-stop",
      "10 poze AI pe lună",
      "Asistent WhatsApp AI",
      "Suport prioritar",
    ],
  },
  {
    id: "premium_monthly",
    name: "Premium",
    price: "995 lei",
    desc: "Pentru branduri și agenții care scalează agresiv.",
    items: [
      "Campanii nelimitate, non-stop",
      "Poze AI nelimitate",
      "Asistent WhatsApp AI",
      "Manager dedicat",
    ],
  },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const fetchStatus = useServerFn(getOnboardingStatus);
  const startOAuth = useServerFn(startMetaOAuth);
  const choosePlan = useServerFn(chooseSignupPlan);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [adReady, setAdReady] = useState(false);

  const reload = async () => {
    try {
      const r = await fetchStatus({ data: { environment: getStripeEnvironment() } });
      setStatus(r);
      let pendingGoal: string | null = null;
      try {
        pendingGoal = window.localStorage.getItem("adpilot:goal");
      } catch {
        pendingGoal = null;
      }
      // Nu-l scoate din onboarding până nu conectează și WhatsApp — chiar dacă a plătit,
      // vrem să activeze asistentul WhatsApp aici, ușor, înainte de dashboard.
      if (
        r.hasMetaConnection &&
        r.hasActiveSubscription &&
        r.whatsappConnected &&
        !pendingGoal
      ) {
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (search.meta === "connected") {
      toast.success("Cont Meta conectat ✅");
      void import("@/lib/meta-pixel").then((m) => m.fbConnectedFacebook());
      navigate({ to: "/onboarding", replace: true, search: {} as OnboardingSearch });
    } else if (search.meta === "error") {
      const reason =
        search.reason === "bad_state"
          ? "Sesiune expirată — încearcă din nou."
          : search.reason === "missing_params"
            ? "Meta nu a returnat toate datele necesare."
            : search.reason;
      toast.error(`Nu am putut conecta Meta${reason ? `: ${reason}` : ""}`);
      navigate({ to: "/onboarding", replace: true, search: {} as OnboardingSearch });
    }
  }, [search.meta, search.reason, navigate]);

  async function connectMeta() {
    try {
      const { url } = await startOAuth({ data: { returnTo: "/onboarding" } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut porni autentificarea Meta");
    }
  }

  async function selectPlan(plan: { id: string; free?: boolean }) {
    // FĂRĂ card la înscriere: alegerea planului doar se salvează. Toți userii au deja
    // 7 zile gratuite de la crearea contului. După, Starter = 7 zile/lună, iar
    // Pro/Premium primesc pe WhatsApp linkul de plată Stripe.
    const key = plan.id.startsWith("starter")
      ? "starter"
      : plan.id.includes("premium")
        ? "premium"
        : "pro";
    try {
      await choosePlan({ data: { plan: key } });
      toast.success(
        key === "starter"
          ? "Gata! Planul Starter e activ: 7 zile gratuite în fiecare lună. Activează WhatsApp 👇"
          : `Gata! Ai ales ${key === "premium" ? "Premium" : "Pro"} — 7 zile gratuite acum. Activează WhatsApp 👇`,
      );
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut salva planul.");
    }
  }

  const step1Done = !!status?.hasMetaConnection;
  const planChosen = !!status?.planChosen; // abonament plătit SAU Starter gratuit activ
  const planDone = !!status?.hasActiveSubscription; // doar abonament plătit (pt. redirect)
  const whatsappAllowed = !!status?.whatsappAllowed; // Pro/Premium sau Starter gratuit activ
  const freeState = status?.freeStarter?.state;
  const waDone = !!status?.whatsappConnected;
  const activeStep = !step1Done ? 1 : !adReady ? 2 : !planChosen ? 3 : !waDone ? 4 : 5;
  // Pasul afișat: urmează automat progresul, dar userul poate reveni la un pas deblocat.
  const [view, setView] = useState(1);
  const [planPick, setPlanPick] = useState(1);
  useEffect(() => {
    setView(activeStep);
  }, [activeStep]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  // Conturile create prin Facebook (system-user) n-au email → îl cerem întâi.
  if (status?.needsEmail) {
    return <EmailGate onDone={reload} />;
  }

  const steps = [
    { t: "Conectează Facebook", s: "Pagina și contul de reclame", done: step1Done, open: true },
    { t: "Cont de reclame și card", s: "Verificat automat în Meta", done: adReady, open: step1Done },
    { t: "Alege planul", s: "7 zile gratuite, fără card", done: planChosen, open: step1Done },
    { t: "Activează WhatsApp", s: "Aici vorbești cu AdPilot", done: waDone, open: step1Done },
    { t: "Obiectivul tău", s: "Pentru prima campanie", done: false, open: planChosen },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const picked = PLANS[planPick];
  const pickedHue = picked.free ? "31,191,95" : picked.featured ? "107,61,255" : "225,58,212";
  const next = (
    <button type="button" className="btn btn-w" onClick={() => setView((v) => Math.min(5, v + 1))}>
      Continuă <span className="arr">→</span>
    </button>
  );

  return (
    <div className="v2">
      <div className="onb">
        <div
          className="glow"
          style={{
            background: `radial-gradient(circle,rgba(${GLOW[view - 1]},.5),transparent 62%)`,
            translate: `${-50 + (view - 3) * 12}% 0`,
          }}
        />
        <span className="brand" style={{ position: "relative" }}>
          <span className="logo" />
          AdPilot
        </span>
        <div className="grid">
          <aside className="rail">
            <div className="ring">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <defs>
                  <linearGradient id="onb-ring" x1="0" x2="1">
                    <stop offset="0" stopColor="#2f6bff" />
                    <stop offset=".5" stopColor="#6b3dff" />
                    <stop offset="1" stopColor="#e13ad4" />
                  </linearGradient>
                </defs>
                <circle className="bg" cx="32" cy="32" r="28" />
                <circle className="fg" cx="32" cy="32" r="28" style={{ stroke: "url(#onb-ring)", strokeDashoffset: 176 * (1 - doneCount / 5) }} />
              </svg>
              <span>{doneCount}/5</span>
            </div>
            <h2>Cinci pași și ești live.</h2>
            <p>Durează cam 5 minute. Poți reveni oricând de unde ai rămas.</p>
            {steps.map((st, i) => (
              <button
                key={st.t}
                type="button"
                className={`rs ${st.done ? "done" : ""} ${view === i + 1 ? "on" : ""}`}
                disabled={!st.open}
                onClick={() => setView(i + 1)}
              >
                <span className="dot">{st.done ? "✓" : i + 1}</span>
                <span>
                  <b>{st.t}</b>
                  <small>{st.s}</small>
                </span>
              </button>
            ))}
          </aside>

          <div className="panel">
            {view === 1 && (
              <div className="pane" key="1">
                <p className="eyebrow">Pasul 1 din 5</p>
                <h3>Conectează pagina ta de Facebook</h3>
                <p>
                  AdPilot are nevoie de acces la pagină și la contul de reclame ca să lanseze campaniile
                  și să-ți aducă clienții în timp real. Contul rămâne al tău.
                </p>
                <div className="check">
                  {["Pagina de Facebook", "Contul de Instagram", "Contul de reclame"].map((c) => (
                    <div key={c} className={step1Done ? "ok" : ""}>
                      <i />
                      {c}
                    </div>
                  ))}
                </div>
                <div className="acts">
                  {step1Done ? (
                    next
                  ) : (
                    <button type="button" className="sso fb" style={{ width: "auto", padding: "0 26px" }} onClick={connectMeta}>
                      Conectează cu Facebook
                    </button>
                  )}
                  <span className="fine" style={{ color: "#8c89a6" }}>
                    {step1Done ? "Cont Meta conectat." : "Durează 30 de secunde."}
                  </span>
                </div>
              </div>
            )}

            {/* Rămâne montat după conectare: el verifică singur contul și cardul. */}
            {step1Done && (
              <div className="pane" hidden={view !== 2}>
                <p className="eyebrow">Pasul 2 din 5</p>
                <h3>Cont de reclame și card</h3>
                <p>Meta încasează bugetul de reclame direct de pe cardul tău. Verificăm noi dacă totul e în regulă.</p>
                <AdAccountGate connected={step1Done} onReady={() => setAdReady(true)} />
                {adReady && <div className="acts">{next}</div>}
              </div>
            )}

            {view === 3 && (
              <div className="pane" key="3">
                <p className="eyebrow">Pasul 3 din 5</p>
                <h3>Alege planul tău</h3>
                <p>Toate planurile sunt gratuite primele 7 zile, fără card. Nu plătești nimic acum.</p>
                <div className="pp">
                  <div className="pp-list">
                    {PLANS.map((p, i) => (
                      <button key={p.id} type="button" className="pp-row" aria-pressed={planPick === i} onClick={() => setPlanPick(i)}>
                        <span className="rad" />
                        <span className="nm">
                          <b>
                            {p.name}
                            {p.featured && <em>Cel mai ales</em>}
                          </b>
                          <small>{p.desc}</small>
                        </span>
                        <span className="prc">
                          <span className="now">0 lei</span>
                          {p.free ? (
                            <span className="was" style={{ textDecoration: "none" }}>mereu</span>
                          ) : (
                            <span className="was">{p.price}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="pp-detail" key={picked.id} style={{ "--hc": pickedHue } as React.CSSProperties}>
                    <span className="free">{picked.free ? FREE_STARTER_LABEL : "Gratis primele 7 zile"}</span>
                    <div className="big">
                      {picked.free ? (
                        <>
                          <span>Gratuit</span> mereu
                        </>
                      ) : (
                        <>
                          <span>{SIGNUP_TRIAL_LABEL}</span>, apoi {picked.price} pe lună
                        </>
                      )}
                    </div>
                    <ul>
                      {picked.items.map((it, k) => (
                        <li key={it} style={{ "--i": k } as React.CSSProperties}>
                          {it}
                        </li>
                      ))}
                    </ul>
                    <div className="tl">
                      <div>
                        <i />
                        <b>Azi</b>
                        <small>0 lei, fără card</small>
                      </div>
                      <div>
                        <i />
                        <b>{picked.free ? "În fiecare lună" : "Ziua 7"}</b>
                        <small>{picked.free ? "7 zile de rulare" : "Link de plată pe WhatsApp"}</small>
                      </div>
                      <div>
                        <i />
                        <b>{picked.free ? "Mereu" : "Apoi"}</b>
                        <small>{picked.free ? "0 lei" : `${picked.price} pe lună`}</small>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="acts">
                  <button type="button" className="btn btn-w" onClick={() => selectPlan(picked)}>
                    {picked.free ? "Începe gratuit" : "Începe gratuit 7 zile"} <span className="arr">→</span>
                  </button>
                  <span className="fine" style={{ color: "#8c89a6" }}>
                    {planChosen ? "Ai deja un plan ales. Îl poți schimba aici." : "Fără card. Poți schimba planul oricând."}
                  </span>
                </div>
              </div>
            )}

            {view === 4 && (
              <div className="pane" key="4">
                <p className="eyebrow">Pasul 4 din 5</p>
                <h3>Activează asistentul pe WhatsApp</h3>
                <p>
                  Aici primești clienții, rapoartele și controlezi campaniile. Scrii numărul, apoi trimiți
                  mesajul pregătit.{planChosen ? "" : " Activarea se deblochează după ce alegi un plan."}
                </p>
                <WhatsAppConnectionCard onboarding planChosen={planChosen} />
                {planChosen && <div className="acts">{next}</div>}
              </div>
            )}

            {view === 5 && (
              <div className="pane" key="5">
                <p className="eyebrow">Pasul 5 din 5</p>
                <h3>Ce vrei să obții?</h3>
                <p>Configurăm prima campanie exact pentru obiectivul tău.</p>
                <GoalSetupStep />
                <div className="acts">
                  <button type="button" className="btn btn-g" onClick={() => navigate({ to: "/dashboard" })}>
                    Intră în Dashboard <span className="arr">→</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pas de completare email pentru conturile create prin Facebook (system-user). */
function EmailGate({ onDone }: { onDone: () => Promise<void> | void }) {
  const save = useServerFn(setMyEmail);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { email: email.trim() } });
      toast.success("Email salvat. Continuăm configurarea 🎉");
      await onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Nu am putut salva emailul.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-md mx-auto px-5 pt-16 pb-32">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Aproape gata</p>
          <h1 className="mt-2 font-serif text-3xl md:text-4xl font-semibold tracking-tight">
            Care e adresa ta de email?
          </h1>
          <p className="mt-3 text-muted-foreground">
            Facebook conectat cu succes ✅ Adaugă un email ca să primești facturi, notificări despre
            lead-uri și să-ți poți recupera contul.
          </p>

          <form onSubmit={submit} className="mt-7 grid gap-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nume@firma.ro"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoFocus
              className="h-[52px] w-full rounded-[13px] border border-white/[0.08] bg-black/25 px-3.5 text-sm outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
            />
            <button
              type="submit"
              disabled={busy}
              className="press btn-primary shine flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-sm font-semibold disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Continuă
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
