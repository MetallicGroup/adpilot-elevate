import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Facebook, Loader2, Sparkles, ArrowRight, MessageCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingStatus, saveUserPhone, startFreeStarter, type OnboardingStatus } from "@/lib/onboarding.functions";
import { firstMonthPrice, FIRST_MONTH_BADGE, FREE_STARTER_LABEL, FREE_STARTER_SUBLABEL } from "@/lib/promo";
import { startMetaOAuth } from "@/lib/meta-oauth.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
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

const PLANS = [
  {
    id: "starter_free",
    name: "Starter",
    price: "Gratuit",
    free: true,
    desc: "Testează complet 3 zile în fiecare lună — fără card.",
    items: [
      "Asistent WhatsApp AI inclus",
      "Campanii pe Facebook & Instagram",
      "3 zile gratuit în fiecare lună",
    ],
  },
  {
    id: "pro_monthly",
    name: "Pro",
    price: "495 lei",
    featured: true,
    desc: "Pentru afacerile care vor să crească rapid.",
    items: [
      "Campanii nelimitate pe Facebook",
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
      "Campanii nelimitate pe Facebook",
      "Poze AI nelimitate",
      "Asistent WhatsApp AI",
      "Manager dedicat",
    ],
  },
];

function PhoneGate({ onSaved }: { onSaved: () => void | Promise<void> }) {
  const save = useServerFn(saveUserPhone);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Introdu un număr de telefon valid (ex. 07xx xxx xxx).");
      return;
    }
    setSaving(true);
    try {
      await save({ data: { phone: phone.trim() } });
      await onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut salva numărul.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card-floating p-7 w-full max-w-md"
      >
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Un ultim detaliu</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
          Care e numărul tău de telefon?
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Îl folosim ca să te putem contacta despre contul și campaniile tale.
        </p>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="07xx xxx xxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoFocus
          className="mt-5 h-[52px] w-full rounded-[13px] border border-white/[0.08] bg-black/25 px-3.5 text-sm outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
        />
        <button
          type="submit"
          disabled={saving}
          className="press btn-primary mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-sm font-semibold disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Continuă
        </button>
      </motion.form>
    </div>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const fetchStatus = useServerFn(getOnboardingStatus);
  const startOAuth = useServerFn(startMetaOAuth);
  const startFree = useServerFn(startFreeStarter);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [adReady, setAdReady] = useState(false);
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

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
      if (r.hasMetaConnection && r.hasActiveSubscription && !pendingGoal) {
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
    if (plan.free) {
      try {
        await startFree({});
        toast.success("Planul gratuit e activ! Ai 3 zile — activează WhatsApp și pornește prima reclamă.");
        await reload();
      } catch (e: any) {
        toast.error(e?.message ?? "Nu am putut activa planul gratuit.");
      }
      return;
    }
    openCheckout({
      priceId: plan.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  }

  const step1Done = !!status?.hasMetaConnection;
  const planChosen = !!status?.planChosen; // abonament plătit SAU Starter gratuit activ
  const planDone = !!status?.hasActiveSubscription; // doar abonament plătit (pt. redirect)
  const whatsappAllowed = !!status?.whatsappAllowed; // Pro/Premium sau Starter gratuit activ
  const freeState = status?.freeStarter?.state;
  const activeStep = !step1Done ? 1 : !adReady ? 2 : !planChosen ? 3 : 4;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  // Gate telefon: obligatoriu înainte de orice (prinde și conturile create cu Google,
  // care nu trec prin formularul de signup unde se cere numărul).
  if (status && !status.hasPhone) {
    return <PhoneGate onSaved={reload} />;
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-3xl mx-auto px-5 pt-12 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Bun venit la AdPilot
          </p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
            Două minute și ești gata să lansezi.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Conectează pagina ta de Facebook și alege un plan — 3 zile gratuit, anulezi oricând.
          </p>
        </motion.div>

        {/* Steps progress */}
        <div className="mt-8 flex items-center gap-3 text-sm">
          <StepBadge n={1} done={step1Done} active={activeStep === 1} label="Conectează Meta" />
          <div className="flex-1 h-px bg-border" />
          <StepBadge n={2} done={adReady} active={activeStep === 2} label="Cont & card" />
          <div className="flex-1 h-px bg-border" />
          <StepBadge n={3} done={planChosen} active={activeStep === 3} label="Alege plan" />
          <div className="flex-1 h-px bg-border" />
          <StepBadge n={4} done={false} active={activeStep === 4} label="WhatsApp" />
          <div className="flex-1 h-px bg-border" />
          <StepBadge n={5} done={false} active={activeStep === 4} label="Obiectivul tău" />
        </div>

        {/* Step 1: Meta */}
        <section
          className={`mt-8 card-floating p-7 transition-opacity ${activeStep > 1 && !step1Done ? "opacity-60" : ""}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#1877F2]/15 text-[#1877F2] flex items-center justify-center shrink-0">
              <Facebook className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-lg">Conectează pagina ta de Facebook</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Avem nevoie de acces la pagina și contul tău de reclame Meta pentru a-ți lansa
                campaniile și colecta lead-urile în timp real.
              </p>
              {step1Done ? (
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-500">
                  <Check className="w-4 h-4" /> Cont Meta conectat
                </div>
              ) : (
                <button
                  onClick={connectMeta}
                  className="press mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1877F2] text-white font-medium hover:opacity-90"
                >
                  <Facebook className="w-4 h-4" /> Conectează cu Facebook
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Step 2: Ad account + card gate */}
        {step1Done && <AdAccountGate connected={step1Done} onReady={() => setAdReady(true)} />}

        {/* Step 3: Plan — deblocat după conectarea Facebook. Alegerea planului deblochează activarea WhatsApp. */}
        <section
          className={`mt-5 card-floating p-7 transition-opacity ${!step1Done ? "opacity-40 pointer-events-none" : ""}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Alege planul tău</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Începe cu <b className="text-foreground">Starter gratuit</b> — 3 zile în fiecare
                lună, fără card, cu asistent WhatsApp inclus. Sau treci direct pe Pro/Premium cu{" "}
                <b className="text-foreground">-50% în prima lună</b>.
              </p>
            </div>
          </div>

          {planChosen && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-500">
              <Check className="w-4 h-4" />
              {freeState === "active"
                ? "Planul Starter gratuit e activ — acum poți activa WhatsApp."
                : "Plan activ — acum poți activa WhatsApp."}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-2xl border p-5 flex flex-col ${
                  p.featured
                    ? "border-primary bg-primary/5"
                    : p.free
                      ? "border-success/40 bg-success/5"
                      : "border-border bg-background/50"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Popular
                  </span>
                )}
                {p.free && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-success text-white">
                    Gratuit
                  </span>
                )}
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                {p.free ? (
                  <>
                    <span className="mt-3 inline-block w-fit text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success">
                      ✅ {FREE_STARTER_LABEL}
                    </span>
                    <p className="mt-2 font-serif text-3xl">Gratuit</p>
                    <p className="text-[11px] text-muted-foreground">{FREE_STARTER_SUBLABEL}</p>
                  </>
                ) : (
                  <>
                    <span className="mt-3 inline-block w-fit text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success">
                      🎉 {FIRST_MONTH_BADGE}
                    </span>
                    <p className="mt-2 font-serif text-3xl">
                      {firstMonthPrice(p.price).first}
                      <span className="text-xs text-muted-foreground font-sans"> prima lună</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      apoi <span className="text-foreground font-medium">{p.price}</span>/lună
                    </p>
                    <p className="mt-1 text-[11px] text-success font-medium">✨ 3 zile gratuit</p>
                  </>
                )}
                <ul className="mt-4 space-y-1.5 text-xs flex-1">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" /> {it}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => selectPlan(p)}
                  className={`press mt-5 w-full py-2.5 rounded-xl text-sm font-medium ${
                    p.featured
                      ? "bg-primary text-primary-foreground"
                      : p.free
                        ? "bg-success text-white"
                        : "bg-foreground text-background"
                  }`}
                >
                  {p.free ? "Începe gratuit" : "Începe 3 zile gratuit"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Step 4: WhatsApp — salvarea numărului merge după Facebook; activarea e blocată până alegi un plan. */}
        <section
          className={`mt-5 card-floating p-7 transition-opacity ${!step1Done ? "opacity-40 pointer-events-none" : ""}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Conectează WhatsApp</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Adaugă numărul tău, apoi apasă „Activează" ca să pornești asistentul AdPilot pe
                WhatsApp. {planChosen ? "" : "Butonul de activare se deblochează după ce alegi un plan mai sus."}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <WhatsAppConnectionCard onboarding planChosen={planChosen} />
          </div>
        </section>

        {/* Step 5: obiectiv */}
        <section
          className={`mt-5 card-floating p-7 transition-opacity ${!planChosen ? "opacity-40 pointer-events-none" : ""}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Ce vrei să obții?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Configurăm campania exact pentru obiectivul tău — Pixel pentru vânzări, pagină de
                programări, pagină de ofertă sau buton de apel.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <GoalSetupStep />
          </div>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="press mt-6 w-full py-2.5 rounded-xl text-sm font-medium bg-foreground text-background"
          >
            Intră în Dashboard
          </button>
        </section>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-8">
            <button
              onClick={closeCheckout}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Înapoi
            </button>
            {checkoutElement}
          </div>
        </div>
      )}
    </div>
  );
}

function StepBadge({
  n,
  done,
  active,
  label,
}: {
  n: number;
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
          done
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground"
        }`}
      >
        {done ? <Check className="w-3.5 h-3.5" /> : n}
      </div>
      <span
        className={`truncate ${active || done ? "text-foreground font-medium" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}
