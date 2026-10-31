import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { confirmUpgrade, getMySubscription } from "@/lib/payments.functions";
import { PLAN_CATALOG, planLabel, planMonthlyLei, planVolume, type CatalogPlan } from "@/lib/plan-catalog";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/upgrade")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Schimbă pachetul — AdPilot" }, { name: "robots", content: "noindex" }] }),
  component: UpgradePage,
});

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long" }) : null;
}

function UpgradePage() {
  const { session_id: sessionId } = Route.useSearch();
  const env = getStripeEnvironment();
  const fetchSub = useServerFn(getMySubscription);
  const confirm = useServerFn(confirmUpgrade);
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [picked, setPicked] = useState<CatalogPlan | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<"idle" | "confirming" | "done" | "error">(sessionId ? "confirming" : "idle");

  useEffect(() => {
    if (!sessionId) return;
    confirm({ data: { sessionId, environment: env } })
      .then((r) => setState(r.upgraded ? "done" : "error"))
      .catch(() => setState("error"));
  }, [sessionId, env, confirm]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription", env, "upgrade", state],
    queryFn: () => fetchSub({ data: { environment: env } }),
    enabled: state !== "confirming",
  });
  const sub = data?.subscription;
  const current = planMonthlyLei(sub?.price_id);
  const options = PLAN_CATALOG.filter((p) => p.lei > current);
  const renews = fmtDate(sub?.current_period_end);

  if (state === "confirming") return <Shell title="Confirmăm plata…" />;
  if (state === "done") {
    return (
      <Shell title="Pachetul a fost schimbat">
        <CheckCircle2 className="w-10 h-10 text-success" />
        <p className="text-sm text-muted-foreground">Clipurile în plus sunt disponibile acum. Dacă ai deblocat reclamele, continuăm pe WhatsApp.</p>
        <Link to="/dashboard" className="underline">
          Mergi în cont
        </Link>
      </Shell>
    );
  }
  if (state === "error") {
    return (
      <Shell title="Nu am putut confirma plata">
        <p className="text-sm text-muted-foreground">Dacă ai plătit, pachetul se schimbă automat în câteva minute. Dacă nu se schimbă, scrie-ne.</p>
      </Shell>
    );
  }
  if (isLoading) return <Shell title="Se încarcă…" />;
  if (!sub) {
    return (
      <Shell title="Nu ai încă un pachet">
        <Link to="/pricing" className="underline">
          Vezi pachetele
        </Link>
      </Shell>
    );
  }
  if (!options.length) return <Shell title="Ești deja pe cel mai mare pachet" />;

  return (
    <Shell title="Treci pe un pachet mai mare">
      <p className="text-sm text-muted-foreground">
        Acum ești pe {planLabel(sub.price_id)}. Plătești o singură dată diferența, iar clipurile în plus apar imediat.
      </p>
      <div className="grid gap-3 w-full">
        {options.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPicked(p)}
            className={`rounded-xl border p-4 text-left ${picked?.id === p.id ? "border-primary ring-1 ring-primary" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <b>{p.name}</b>
              <span>{p.lei} lei/lună</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {planVolume(p)} pe lună{p.ads ? ", reclame și asistent pe WhatsApp" : ""}
            </div>
          </button>
        ))}
      </div>
      {picked ? (
        <div className="w-full rounded-xl bg-muted p-4 text-sm">
          <p>
            Plătești <b>{picked.lei - current} lei</b> acum.
            {renews ? ` Pe ${renews} se reînnoiește la ${picked.lei} lei.` : ` Apoi se reînnoiește la ${picked.lei} lei pe lună.`}
          </p>
          <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              Vreau clipurile în plus imediat și înțeleg că, odată ce a fost generat un clip sau o poză, plata nu se mai rambursează. Renunț la dreptul de retragere de 14 zile.
            </span>
          </label>
          <button
            type="button"
            disabled={!agreed}
            className="mt-3 w-full rounded-xl bg-foreground px-4 py-3 font-medium text-background disabled:opacity-40"
            onClick={() =>
              openCheckout({
                priceId: picked.id,
                upgrade: true,
                returnUrl: `${window.location.origin}/upgrade?session_id={CHECKOUT_SESSION_ID}`,
              })
            }
          >
            Plătește {picked.lei - current} lei
          </button>
        </div>
      ) : null}
      {isOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-4">
          <button type="button" onClick={closeCheckout} className="mb-4 text-sm text-muted-foreground">
            ← Înapoi
          </button>
          {checkoutElement}
        </div>
      ) : null}
    </Shell>
  );
}

function Shell(props: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">{props.title}</h1>
      {props.children}
    </div>
  );
}
