import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Plus, TrendingUp, Inbox, ArrowRight, Sparkles } from "lucide-react";
import { fmtMoney, fmtNum } from "@/lib/format";
import { listCampaigns, type CampaignListRow } from "@/lib/campaigns.functions";
import { refreshAllLiveCampaignInsights } from "@/lib/meta-insights.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [name, setName] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([]);
  const [recentInsights, setRecentInsights] = useState<{ id: string; campaign_id: string | null; insight_text: string; action: string | null; generated_at: string }[]>([]);
  const loadCampaigns = useServerFn(listCampaigns);
  const refreshAll = useServerFn(refreshAllLiveCampaignInsights);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata as any)?.full_name || data.user?.email?.split("@")[0] || "";
      setName(n);
    });
  }, []);

  useEffect(() => {
    loadCampaigns().then((r) => setCampaigns(r.campaigns)).catch(() => {});
    supabase
      .from("ai_insights")
      .select("id, campaign_id, insight_text, action, generated_at")
      .order("generated_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentInsights((data as any) ?? []));
  }, [loadCampaigns]);

  // Auto-refresh Meta insights for all live campaigns every 60s
  useEffect(() => {
    const tick = async () => {
      try {
        await refreshAll();
        const r = await loadCampaigns();
        setCampaigns(r.campaigns);
      } catch {
        // silent
      }
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [refreshAll, loadCampaigns]);

  const active = campaigns.filter((c) => c.status === "active");
  const totalSpend = campaigns.reduce((a, c) => a + c.spend, 0);
  const totalLeads = campaigns.reduce((a, c) => a + c.leads, 0);
  const avgCpl = totalLeads ? totalSpend / totalLeads : 0;

  const stats = [
    { label: "Total spend", value: fmtMoney(totalSpend) },
    { label: "Active campaigns", value: fmtNum(active.length) },
    { label: "Total leads", value: fmtNum(totalLeads) },
    { label: "Avg CPL", value: fmtMoney(avgCpl) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-md mx-auto px-5 pt-10"
    >
      <p className="text-sm text-muted-foreground">Good morning{name ? `, ${name}` : ""} 👋</p>
      <h1 className="font-serif text-3xl font-semibold mt-1">Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card-floating p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/create" className="press card-floating p-4 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium">New campaign</p>
            <p className="text-xs text-muted-foreground">TikTok or Meta</p>
          </div>
        </Link>
        <Link to="/leads" className="press card-floating p-4 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Leads CRM</p>
            <p className="text-xs text-muted-foreground">All platforms</p>
          </div>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-8 card-floating p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold">No campaigns yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Launch your first campaign to see results here.</p>
          <Link to="/create" className="press mt-5 inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background rounded-xl text-sm font-medium">
            <Plus className="w-4 h-4" /> Create campaign
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-semibold">Campaigns</h2>
          <div className="mt-3 space-y-2">
            {campaigns.map((c) => {
              const color = c.status === "active" ? "bg-green-500" : c.status === "paused" ? "bg-yellow-500" : "bg-muted-foreground";
              return (
                <Link
                  key={c.id}
                  to="/campaigns/$id"
                  params={{ id: c.id }}
                  className="press card-floating p-4 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.platform === "meta" ? "Meta" : "TikTok"} · {fmtMoney(c.spend)} spent · {fmtNum(c.leads)} leads
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </div>
        </>
      )}

      {recentInsights.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Recent AI insights
          </h2>
          <div className="mt-3 space-y-2">
            {recentInsights.map((i) =>
              i.campaign_id ? (
                <Link
                  key={i.id}
                  to="/campaigns/$id"
                  params={{ id: i.campaign_id }}
                  className="press card-floating p-4 block hover:bg-secondary/40 transition-colors"
                >
                  <p className="text-sm">{i.insight_text}</p>
                  {i.action && <p className="mt-1.5 text-xs text-muted-foreground">→ {i.action}</p>}
                </Link>
              ) : (
                <div key={i.id} className="card-floating p-4">
                  <p className="text-sm">{i.insight_text}</p>
                  {i.action && <p className="mt-1.5 text-xs text-muted-foreground">→ {i.action}</p>}
                </div>
              ),
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}