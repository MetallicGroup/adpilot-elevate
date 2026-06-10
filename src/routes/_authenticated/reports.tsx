import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { fmtMoney, fmtNum } from "@/lib/format";
import { fetchMetaInsights } from "@/lib/meta.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type InsightsData = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  campaigns: Array<{ id: string; name: string; status: string; spend: number; leads: number }>;
};

function ReportsPage() {
  const loadInsights = useServerFn(fetchMetaInsights);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadInsights();
      setData(result);
      if (refresh) toast.success("Performance data updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = data
    ? [
        { label: "Spend", value: fmtMoney(data.spend) },
        { label: "Impressions", value: fmtNum(data.impressions) },
        { label: "Clicks", value: fmtNum(data.clicks) },
        { label: "CTR", value: `${data.ctr.toFixed(2)}%` },
        { label: "CPC", value: fmtMoney(data.cpc) },
        { label: "Leads", value: fmtNum(data.leads) },
        { label: "CPL", value: fmtMoney(data.cpl) },
      ]
    : [];

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Reports</h1>
          <p className="mt-2 text-sm text-muted-foreground">Meta campaign performance at a glance.</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="press p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="mt-8 card-floating p-6 text-sm text-muted-foreground">Loading…</div>
      ) : !data || (data.campaigns.length === 0 && data.spend === 0) ? (
        <div className="mt-8 card-floating p-6 text-sm text-muted-foreground">
          No data yet — launch a Meta campaign to see performance.
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="card-floating p-4">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>

          {data.campaigns.length > 0 && (
            <div className="mt-8 space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Campaigns</h2>
              {data.campaigns.map((c) => (
                <div key={c.id} className="card-floating p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{c.name}</p>
                    <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>Spend {fmtMoney(c.spend)}</span>
                    <span>{c.leads} leads</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
