import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Facebook, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const PLANS = [
  {
    id: "starter_monthly",
    name: "Starter",
    price: "249 lei",
    desc: "Pentru afaceri mici care încep cu reclamele online.",
    items: ["3 campanii pe lună", "Asistent WhatsApp AI", "Suport pe email"],
  },
  {
    id: "pro_monthly",
    name: "Pro",
    price: "495 lei",
    featured: true,
    desc: "Pentru afacerile care vor să crească rapid.",
    items: ["Campanii nelimitate", "10 clipuri AI pe lună", "20 de poze AI pe lună", "Asistent WhatsApp AI", "Suport prioritar"],
  },
  {
    id: "premium_monthly",
    name: "Premium",
    price: "995 lei",
    desc: "Pentru branduri și agenții care scalează agresiv.",
    items: ["Campanii nelimitate", "Clipuri AI nelimitate", "Poze AI nelimitate", "Success manager dedicat"],
  },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getOnboardingStatus);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

  const reload = async () => {
    try {
      const r = await fetchStatus({ data: { environment: getStripeEnvironment() } });
      setStatus(r);
      if (r.hasMetaConnection && r.hasActiveSubscription) {
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

  async function connectMeta() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    window.location.href = `/api/meta/auth/start?uid=${data.user.id}`;
  }

  function selectPlan(priceId: string) {
    openCheckout({
      priceId,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  }

  const step1Done = !!status?.hasMetaConnection;
  const step2Done = !!status?.hasActiveSubscription;
  const activeStep = !step1Done ? 1 : !step2Done ? 2 : 3;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto px-5 pt-12 pb-32">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Bun venit la AdPilot</p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
            Două minute și ești gata să lansezi.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Conectează pagina ta de Facebook și alege un plan — 7 zile gratuit, anulezi oricând.
          </p>
        </motion.div>

        {/* Steps progress */}
        <div className="mt-8 flex items-center gap-3 text-sm">
          <StepBadge n={1} done={step1Done} active={activeStep === 1} label="Conectează Meta" />
          <div className="flex-1 h-px bg-border" />
          <StepBadge n={2} done={step2Done} active={activeStep === 2} label="Alege plan" />
        </div>

        {/* Step 1: Meta */}
        <section className={`mt-8 card-floating p-7 transition-opacity ${activeStep > 1 && !step1Done ? "opacity-60" : ""}`}>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#1877F2]/15 text-[#1877F2] flex items-center justify-center shrink-0">
              <Facebook className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-lg">Conectează pagina ta de Facebook</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Avem nevoie de acces la pagina și contul tău de reclame Meta pentru a-ți lansa campaniile și colecta lead-urile în timp real.
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

        {/* Step 2: Plan */}
        <section className={`mt-5 card-floating p-7 transition-opacity ${!step1Done ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Alege planul tău</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                7 zile gratuit pe orice plan. Cardul e necesar pentru activare — nu îți retragem nimic înainte de a 8-a zi.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-2xl border p-5 flex flex-col ${
                  p.featured ? "border-primary bg-primary/5" : "border-border bg-background/50"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Popular
                  </span>
                )}
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                <p className="mt-4 font-serif text-3xl">
                  {p.price}
                  <span className="text-xs text-muted-foreground font-sans">/lună</span>
                </p>
                <p className="mt-1 text-[11px] text-success font-medium">✨ 7 zile gratuit</p>
                <ul className="mt-4 space-y-1.5 text-xs flex-1">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" /> {it}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => selectPlan(p.id)}
                  className={`press mt-5 w-full py-2.5 rounded-xl text-sm font-medium ${
                    p.featured ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
                  }`}
                >
                  Începe 7 zile gratuit
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-8">
            <button onClick={closeCheckout} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
              ← Înapoi
            </button>
            {checkoutElement}
          </div>
        </div>
      )}
    </div>
  );
}

function StepBadge({ n, done, active, label }: { n: number; done: boolean; active: boolean; label: string }) {
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
      <span className={`truncate ${active || done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}