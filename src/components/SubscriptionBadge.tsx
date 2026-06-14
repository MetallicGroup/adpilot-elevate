import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription, createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment, paymentsTokenAvailable } from "@/lib/stripe";
import { toast } from "sonner";
import { useState } from "react";
import { CalendarClock, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";

const PLAN_LABEL: Record<string, string> = {
  starter_monthly: "Starter · 249 lei/lună",
  pro_monthly: "Pro · 495 lei/lună",
  premium_monthly: "Premium · 995 lei/lună",
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function SubscriptionBadge() {
  const tokenOk = paymentsTokenAvailable();
  const env = tokenOk ? getStripeEnvironment() : null;
  const fetchSub = useServerFn(getMySubscription);
  const openPortal = useServerFn(createPortalSession);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription", env],
    queryFn: () => fetchSub({ data: { environment: env! } }),
    enabled: !!env,
    refetchOnWindowFocus: false,
  });

  async function handlePortal() {
    if (!env) return;
    setBusy(true);
    try {
      const r = await openPortal({
        data: { environment: env, returnUrl: window.location.href },
      });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!tokenOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Plățile nu sunt configurate pentru acest mediu.
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Se încarcă abonamentul…</p>;
  }

  const sub = data?.subscription;

  if (!sub) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Fără abonament activ</p>
          <p className="text-xs text-muted-foreground mt-1">
            Alege un plan pentru a începe perioada de 7 zile gratuite.
          </p>
        </div>
        <a
          href="/pricing"
          className="press text-sm px-4 py-2 rounded-lg bg-foreground text-background"
        >
          Vezi planuri
        </a>
      </div>
    );
  }

  const now = Date.now();
  const trialEndMs = sub.trial_end ? new Date(sub.trial_end).getTime() : null;
  const periodEndMs = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const trialActive = sub.status === "trialing" && trialEndMs !== null && trialEndMs > now;
  const trialExpired = !!trialEndMs && trialEndMs <= now && sub.status !== "active";
  const planLabel = PLAN_LABEL[sub.price_id] ?? sub.price_id;

  const badge = trialActive ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-success/15 text-success">
      <ShieldCheck className="w-3.5 h-3.5" /> Trial activ · 7 zile
    </span>
  ) : trialExpired ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/15 text-destructive">
      <AlertTriangle className="w-3.5 h-3.5" /> Trial expirat
    </span>
  ) : sub.status === "active" ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary">
      <ShieldCheck className="w-3.5 h-3.5" /> Activ
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
      {sub.status}
    </span>
  );

  const nextBillingLabel = trialActive
    ? `Prima facturare pe ${formatDate(sub.trial_end)}`
    : sub.cancel_at_period_end
      ? `Acces până pe ${formatDate(sub.current_period_end)}`
      : `Reînnoire pe ${formatDate(sub.current_period_end)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{planLabel}</p>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> {nextBillingLabel}
          </p>
          {trialActive && (
            <p className="text-xs text-muted-foreground">
              Nu îți retragem nimic de pe card înainte de {formatDate(sub.trial_end)}.
            </p>
          )}
        </div>
        <button
          onClick={handlePortal}
          disabled={busy}
          className="press text-sm px-4 py-2 rounded-lg border border-border hover:bg-secondary inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {busy ? "Se deschide…" : "Deschide portal"} <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}