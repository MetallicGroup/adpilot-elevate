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
      <p className="text-sm text-muted-foreground">Bună dimineața{name ? `, ${name}` : ""} 👋</p>
      <h1 className="text-3xl font-bold mt-1 tracking-tight">Iată cum merg <span className="gradient-text">campaniile tale</span></h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card-floating p-4 hover:border-primary/30 transition-colors">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold font-mono tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/create" className="press card-floating p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "var(--gradient-primary)" }}>
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Campanie nouă</p>
            <p className="text-xs text-muted-foreground">TikTok sau Meta</p>
          </div>
        </Link>
        <Link to="/leads" className="press card-floating p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Lead-uri CRM</p>
            <p className="text-xs text-muted-foreground">Toate platformele</p>
          </div>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-8 card-floating p-8 text-center">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: "oklch(0.62 0.22 295 / 0.15)" }}>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="mt-4 font-semibold">Nicio campanie încă 🎬</h3>
          <p className="mt-1 text-sm text-muted-foreground">Lansează prima ta campanie ca să vezi rezultate aici.</p>
          <Link to="/create" className="press btn-primary mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" /> Creează campanie
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Campaniile tale</h2>
          <div className="mt-3 space-y-2">
            {campaigns.map((c) => {
              const color = c.status === "active" ? "bg-success pulse-dot text-success" : c.status === "paused" ? "bg-yellow-500" : "bg-muted-foreground";
              return (
                <Link
                  key={c.id}
                  to="/campaigns/$id"
                  params={{ id: c.id }}
                  className="press card-floating p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {c.platform === "meta" ? "Meta" : "TikTok"} · {fmtMoney(c.spend)} cheltuit · {fmtNum(c.leads)} lead-uri
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
          <h2 className="mt-8 text-sm font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-primary" /> Recomandări AI
          </h2>
          <div className="mt-3 space-y-2">
            {recentInsights.map((i) =>
              i.campaign_id ? (
                <Link
                  key={i.id}
                  to="/campaigns/$id"
                  params={{ id: i.campaign_id }}
                  className="press card-floating p-4 block hover:border-primary/40 transition-colors"
                  style={{ background: "linear-gradient(160deg, oklch(0.62 0.22 295 / 0.06), transparent)" }}
                >
                  <p className="text-sm">{i.insight_text}</p>
                  {i.action && <p className="mt-1.5 text-xs text-primary">→ {i.action}</p>}
                </Link>
              ) : (
                <div key={i.id} className="card-floating p-4">
                  <p className="text-sm">{i.insight_text}</p>
                  {i.action && <p className="mt-1.5 text-xs text-primary">→ {i.action}</p>}
                </div>
              ),
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}