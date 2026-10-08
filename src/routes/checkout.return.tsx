import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MiniShell } from "@/components/v2/kit";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
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
  // Poll doar dacă e sesiune logată (userul poate plăti și de pe telefon, nelogat —
  // webhook-ul reactivează contul oricum prin metadata.userId).
  const { data } = useQuery({
    queryKey: ["my-subscription", env, "post-checkout"],
    queryFn: () => fetchSub({ data: { environment: env! } }),
    enabled: !!env && !!sessionId,
    refetchInterval: (q) => (q.state.data?.subscription ? false : 2000),
    refetchOnWindowFocus: false,
    retry: false,
  });
  const sub = data?.subscription;

  // Plată confirmată → ducem userul în dashboard (dacă nu e logat, ruta îl trimite la login).
  useEffect(() => {
    if (!sub) return;
    const t = setTimeout(() => navigate({ to: "/dashboard", replace: true }), 3000);
    return () => clearTimeout(t);
  }, [sub, navigate]);

  return (
    <MiniShell className="flex items-center justify-center px-6">
      <div className="max-w-md w-full card-floating p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold">Plată confirmată 🎉</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Abonamentul tău e activ și contul se reactivează automat. Poți lansa din nou campanii
          nelimitate, non-stop. Poți anula oricând din Setări → Plan &amp; facturare.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-2">
          <Link
            to="/dashboard"
            className="press inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-foreground text-background font-medium"
          >
            Mergi în cont →
          </Link>
        </div>
        {sub && (
          <p className="mt-4 text-xs text-muted-foreground">Te ducem în cont în câteva secunde…</p>
        )}
        {!sessionId && (
          <p className="mt-4 text-xs text-muted-foreground">Mulțumim! Contul tău este pregătit.</p>
        )}
      </div>
    </MiniShell>
  );
}
