import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Unplug, Target, Users, MousePointerClick, Eye } from "lucide-react";
import { toast } from "sonner";
import { getClientDashboard, disconnectAgencyClient } from "@/lib/agency.functions";

export const Route = createFileRoute("/_authenticated/agency/clients/$id")({
  ssr: false,
  component: ClientContext,
});

const OBJ: Record<string, string> = {
  OUTCOME_LEADS: "Lead-uri",
  OUTCOME_SALES: "Vânzări",
  OUTCOME_TRAFFIC: "Trafic",
  OUTCOME_ENGAGEMENT: "Interacțiune",
  OUTCOME_AWARENESS: "Notorietate",
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function ClientContext() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getClientDashboard);
  const disconnectFn = useServerFn(disconnectAgencyClient);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setLoading(true);
    load({ data: { client_id: id } })
      .then(setData)
      .catch((e) => toast.error(e?.message ?? "Nu am putut încărca clientul."))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [id]);

  const disconnect = async () => {
    if (!confirm("Deconectezi acest client? Îi ștergem accesul (tokenul). Se poate reconecta oricând prin link.")) return;
    setBusy(true);
    try {
      await disconnectFn({ data: { client_id: id } });
      toast.success("Client deconectat.");
      navigate({ to: "/agency/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare.");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.client) return null;

  const c = data.client;
  const lei = (n: number) => `${Number(n ?? 0).toFixed(2)} lei`;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Banner context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/agency/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-sm">
            Lucrezi pe contul: <b>{c.name || "Client"}</b>
            {c.page ? <span className="text-muted-foreground"> · {c.page}</span> : null}
          </span>
        </div>
        <button onClick={disconnect} disabled={busy} className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg disabled:opacity-50">
          <Unplug className="w-4 h-4" /> Deconectează
        </button>
      </div>

      {!data.connected ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Acest client nu e conectat momentan (status: {c.status}). Trimite-i din nou linkul de conectare.
        </div>
      ) : (
        <>
          {/* Stats today */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Azi</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={<Target className="w-4 h-4" />} label="Cheltuit" value={lei(data.stats.today.spend)} />
              <Stat icon={<Users className="w-4 h-4" />} label="Lead-uri" value={String(data.stats.today.leads)} />
              <Stat icon={<MousePointerClick className="w-4 h-4" />} label="Click-uri" value={String(data.stats.today.clicks)} />
              <Stat icon={<Eye className="w-4 h-4" />} label="Afișări" value={data.stats.today.impressions.toLocaleString("ro-RO")} />
            </div>
          </div>

          {/* Lifetime + 7d */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Ultimele 7 zile</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold">{lei(data.stats.last7.spend)}</div><div className="text-xs text-muted-foreground">cheltuit</div></div>
                <div><div className="text-lg font-bold">{data.stats.last7.leads}</div><div className="text-xs text-muted-foreground">lead-uri</div></div>
                <div><div className="text-lg font-bold">{data.stats.last7.leads > 0 ? lei(data.stats.last7.spend / data.stats.last7.leads) : "—"}</div><div className="text-xs text-muted-foreground">cost/lead</div></div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Total (all-time)</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold">{lei(data.stats.life.spend)}</div><div className="text-xs text-muted-foreground">cheltuit</div></div>
                <div><div className="text-lg font-bold">{data.stats.life.leads}</div><div className="text-xs text-muted-foreground">lead-uri</div></div>
                <div><div className="text-lg font-bold">{data.stats.life.leads > 0 ? lei(data.stats.life.spend / data.stats.life.leads) : "—"}</div><div className="text-xs text-muted-foreground">cost/lead</div></div>
              </div>
            </div>
          </div>

          {/* Campaigns */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Campanii ({data.campaigns.length})</h2>
            {data.campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">Nicio campanie în contul acestui client.</div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40"><tr className="text-left">
                    <th className="px-3 py-2 font-medium">Nume</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Obiectiv</th>
                    <th className="px-3 py-2 font-medium">Cheltuit</th>
                    <th className="px-3 py-2 font-medium">Lead-uri</th>
                    <th className="px-3 py-2 font-medium">Click-uri</th>
                  </tr></thead>
                  <tbody>
                    {data.campaigns.map((cp: any) => (
                      <tr key={cp.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{cp.name}</td>
                        <td className="px-3 py-2"><span className="capitalize">{String(cp.status || "").toLowerCase()}</span></td>
                        <td className="px-3 py-2">{OBJ[cp.objective] ?? cp.objective}</td>
                        <td className="px-3 py-2">{lei(cp.spend)}</td>
                        <td className="px-3 py-2">{cp.leads}</td>
                        <td className="px-3 py-2">{cp.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
