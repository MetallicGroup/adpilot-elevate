import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { runTrialSandboxTest, type TrialTestResult } from "@/lib/trial-test.functions";
import { CheckCircle2, XCircle, Loader2, FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa/trial")({
  component: QATrialPage,
});

function QATrialPage() {
  const run = useServerFn(runTrialSandboxTest);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrialTestResult | null>(null);
  const [plan, setPlan] = useState("starter_monthly");

  async function trigger() {
    setBusy(true);
    setResult(null);
    try {
      const r = await run({ data: { priceId: plan } });
      setResult(r);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 pt-8 pb-32 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">QA · Plăți</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1 flex items-center gap-2">
          <FlaskConical className="w-7 h-7" /> Test E2E Trial 7 zile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rulează un test în <strong>sandbox</strong> folosind Stripe test clocks. Creează un client cu card de test,
          deschide abonament cu trial 7 zile, avansează ceasul și verifică strict:
        </p>
        <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Nu apare niciun charge în primele 6 zile.</li>
          <li>Abonamentul rămâne în <code>trialing</code> în ziua 6.</li>
          <li>După ziua 7+, abonamentul trece în <code>active</code>.</li>
          <li>Există exact o factură plătită după trial.</li>
        </ul>
      </div>

      <div className="card-floating p-5 space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Plan testat:</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-border bg-background"
          >
            <option value="starter_monthly">Starter (249 lei)</option>
            <option value="pro_monthly">Pro (495 lei)</option>
            <option value="premium_monthly">Premium (995 lei)</option>
          </select>
        </div>

        <button
          onClick={trigger}
          disabled={busy}
          className="press inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
          {busy ? "Se rulează (poate dura 30-60s)…" : "Rulează testul"}
        </button>

        {result && "error" in result && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            Eroare: {result.error}
          </div>
        )}

        {result && "steps" in result && (
          <div className="space-y-3">
            <div
              className={`p-3 rounded-lg text-sm font-medium ${
                result.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              }`}
            >
              {result.summary}
            </div>
            <div className="space-y-1.5">
              {result.steps.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-secondary/30 text-sm"
                >
                  {s.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground break-all">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}