import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { getMetaStatus, type MetaStatus } from "@/lib/meta-status.functions";

export const Route = createFileRoute("/_authenticated/meta-status")({
  component: MetaStatusPage,
});

const SCOPE_HUMAN: Record<string, string> = {
  ads_management: "Gestionare reclame",
  ads_read: "Citire date reclame",
  business_management: "Gestionare Business Manager",
  leads_retrieval: "Citire lead-uri din formulare",
  pages_manage_ads: "Reclame pe paginile tale",
  pages_manage_metadata: "Abonare pagină la webhook (lead-uri instant)",
  pages_read_engagement: "Citire date pagină",
  pages_show_list: "Listă pagini",
};

function MetaStatusPage() {
  const fetchStatus = useServerFn(getMetaStatus);
  const [data, setData] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchStatus({ data: {} as never });
      setData(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return <div className="max-w-3xl mx-auto p-10 text-muted-foreground">Verific Meta…</div>;
  }

  const reconnect = () => {
    window.location.href = data.reconnect_url;
  };

  return (
    <div className="max-w-3xl mx-auto px-5 pt-10 pb-24 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Diagnostic Meta</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Status conexiune & lead-uri 🔌</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aici vezi dacă pagina ta primește lead-urile automat din Facebook.
          </p>
        </div>
        <button
          onClick={load}
          className="press text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reverifică
        </button>
      </div>

      {/* Connection */}
      <section className="card-floating p-5 space-y-3">
        <div className="flex items-center gap-2">
          {data.connected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <h2 className="font-semibold">
            {data.connected ? `Conectat ca ${data.user_name ?? data.user_id}` : "Neconectat la Meta"}
          </h2>
        </div>
        {!data.connected && (
          <button
            onClick={reconnect}
            className="press text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-2"
          >
            Conectează Meta <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}

        {data.connected && (
          <>
            <div>
              <p className="text-sm font-medium mb-2">Permisiuni acordate</p>
              <div className="flex flex-wrap gap-1.5">
                {data.granted_scopes.length === 0 && (
                  <span className="text-xs text-muted-foreground">Niciuna citită</span>
                )}
                {data.granted_scopes.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    title={SCOPE_HUMAN[s] ?? s}
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>

            {data.missing_scopes.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Permisiuni lipsă
                </p>
                <ul className="text-sm space-y-1">
                  {data.missing_scopes.map((s) => (
                    <li key={s}>
                      <code className="text-xs px-1.5 py-0.5 rounded bg-background border">{s}</code>{" "}
                      — {SCOPE_HUMAN[s] ?? "Necesar pentru funcționare completă"}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={reconnect}
                  className="press text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white hover:opacity-90 inline-flex items-center gap-2"
                >
                  Reconectează cu toate permisiunile <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Webhook URL */}
      <section className="card-floating p-5">
        <p className="text-sm font-medium mb-2">URL webhook (Meta App → Webhooks → Page)</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs px-3 py-2 rounded-md bg-background border break-all">
            {data.webhook_callback_url}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(data.webhook_callback_url);
              toast.success("Copiat");
            }}
            className="press text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary inline-flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" /> Copiază
          </button>
        </div>
      </section>

      {/* Pages */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Pagini Facebook conectate</h2>
        {data.pages.length === 0 && (
          <p className="text-sm text-muted-foreground">Nicio pagină conectată.</p>
        )}
        {data.pages.map((p) => (
          <div key={p.page_id} className="card-floating p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{p.page_name}</h3>
                <p className="text-xs text-muted-foreground">ID: {p.page_id}</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {p.subscribed_to_leadgen ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Abonat la lead-uri
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-red-500">
                    <XCircle className="w-4 h-4" /> Nu primește lead-uri automat
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border p-3">
                <p className="text-muted-foreground text-xs">Formulare active</p>
                <p className="text-lg font-semibold">{p.leadgen_forms_count}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-muted-foreground text-xs">Lead-uri totale în Meta</p>
                <p className="text-lg font-semibold">{p.leadgen_total_leads}</p>
              </div>
            </div>

            {p.can_resubscribe && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                ✅ Tocmai am abonat pagina la webhook. De acum lead-urile noi vin instant.
              </div>
            )}

            {p.missing_page_scopes.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-2">
                <p className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Lipsește permisiunea
                </p>
                <ul className="space-y-1">
                  {p.missing_page_scopes.map((s) => (
                    <li key={s}>
                      <code className="text-xs px-1.5 py-0.5 rounded bg-background border">{s}</code>{" "}
                      — {SCOPE_HUMAN[s] ?? ""}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={reconnect}
                  className="press text-xs px-3 py-1.5 rounded-md bg-amber-500 text-white hover:opacity-90 inline-flex items-center gap-2"
                >
                  Reconectează cu permisiunea <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}

            {p.subscribed_apps_error && !p.missing_page_scopes.length && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
                Eroare la verificare: {p.subscribed_apps_error}
              </div>
            )}
            {p.resubscribe_error && !p.missing_page_scopes.length && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
                Nu am putut abona pagina: {p.resubscribe_error}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}