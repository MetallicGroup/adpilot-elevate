import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2, CalendarClock, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription } from "@/lib/payments.functions";
import { getStripeEnvironment, paymentsTokenAvailable } from "@/lib/stripe";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const env = paymentsTokenAvailable() ? getStripeEnvironment() : null;
  const fetchSub = useServerFn(getMySubscription);
  const { data } = useQuery({
    queryKey: ["my-subscription", env, "post-checkout"],
    queryFn: () => fetchSub({ data: { environment: env! } }),
    enabled: !!env && !!sessionId,
    refetchInterval: (q) => (q.state.data?.subscription ? false : 2000),
    refetchOnWindowFocus: false,
  });
  const sub = data?.subscription;

  // Odată ce plata e confirmată, ducem userul ÎNAPOI în onboarding ca să conecteze
  // WhatsApp-ul ușor de acolo (nu-l lăsăm blocat pe pagina de confirmare).
  useEffect(() => {
    if (!sub) return;
    const t = setTimeout(() => {
      navigate({ to: "/onboarding", replace: true });
    }, 3500);
    return () => clearTimeout(t);
  }, [sub, navigate]);
  const trialEnd = sub?.trial_end
    ? new Date(sub.trial_end).toLocaleDateString("ro-RO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 ">
      <div className="max-w-md w-full card-floating p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold">Trialul tău a început 🎉</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ai 3 zile gratuite la AdPilot. La activare verificăm cardul cu 1 leu, returnat imediat;
          prima plată reală o facem abia la finalul perioadei de probă — poți anula oricând din
          Setări → Plan & facturare.
        </p>
        {trialEnd && (
          <div className="mt-5 inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-success/15 text-success">
            <CalendarClock className="w-3.5 h-3.5" />
            Prima facturare pe {trialEnd}
          </div>
        )}
        <p className="mt-6 text-sm font-medium">
          Ultimul pas: activează asistentul pe WhatsApp 📱
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          <Link
            to="/onboarding"
            replace
            className="press inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-foreground text-background font-medium"
          >
            <MessageCircle className="w-4 h-4" /> Conectează WhatsApp acum
          </Link>
          <Link
            to="/dashboard"
            className="press inline-flex items-center justify-center w-full px-6 py-3 rounded-xl border border-border hover:bg-secondary text-sm"
          >
            Mai târziu — mergi la dashboard
          </Link>
        </div>
        {sub && (
          <p className="mt-4 text-xs text-muted-foreground">
            Te ducem înapoi în onboarding în câteva secunde…
          </p>
        )}
        {!sessionId && (
          <p className="mt-4 text-xs text-muted-foreground">Mulțumim! Contul tău este pregătit.</p>
        )}
      </div>
    </main>
  );
}
