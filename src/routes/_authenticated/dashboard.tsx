import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Plus, TrendingUp, Inbox, ArrowRight, Sparkles, Pause, Play } from "lucide-react";
import { fmtMoney, fmtNum } from "@/lib/format";
import { listCampaigns, setCampaignStatus, type CampaignListRow } from "@/lib/campaigns.functions";
import { refreshAllLiveCampaignInsights } from "@/lib/meta-insights.functions";
import { toast } from "sonner";
import { WhatsAppConnectionCard } from "@/components/whatsapp/WhatsAppConnectionCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [name, setName] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentInsights, setRecentInsights] = useState<{ id: string; campaign_id: string | null; insight_text: string; action: string | null; generated_at: string }[]>([]);
  const loadCampaigns = useServerFn(listCampaigns);
  const refreshAll = useServerFn(refreshAllLiveCampaignInsights);
  const toggleStatus = useServerFn(setCampaignStatus);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata as any)?.full_name || data.user?.email?.split("@")[0] || "";
      setName(n);
    });
  }, []);

  useEffect(() => {
    loadCampaigns()
      .then((r) => setCampaigns(r.campaigns))
      .catch(() => {})
      .finally(() => setLoading(false));
    supabase.auth.getUser().then(({ data: u }) => {
      const uid = u.user?.id;
      if (!uid) return;
      supabase
        .from("ai_insights")
        .select("id, campaign_id, insight_text, action, generated_at")
        .eq("user_id", uid)
        .order("generated_at", { ascending: false })
        .limit(5)
        .then(({ data }) => setRecentInsights((data as any) ?? []));
    });
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
    { label: "Cheltuit total", value: fmtMoney(totalSpend), accent: "from-primary/30 to-primary/0" },
    { label: "Campanii active", value: fmtNum(active.length), accent: "from-emerald-500/30 to-emerald-500/0" },
    { label: "Clienți potențiali", value: fmtNum(totalLeads), accent: "from-blue-500/30 to-blue-500/0" },
    { label: "Cost mediu per client", value: fmtMoney(avgCpl), accent: "from-purple-500/30 to-purple-500/0" },
  ];

  return (
    <div className="max-w-md mx-auto px-5 pt-10">
      <p className="text-sm text-muted-foreground">Bună dimineața{name ? `, ${name}` : ""} 👋</p>
      <h1 className="text-3xl font-bold mt-1 tracking-tight">Iată cum merg <span className="gradient-text">campaniile tale</span></h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {loading
          ? [0,1,2,3].map((i) => (
              <div key={i} className="card-floating p-4 overflow-hidden relative">
                <div className="h-3 w-20 rounded skeleton" />
                <div className="mt-2 h-7 w-24 rounded skeleton" />
              </div>
            ))
          : stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                className="card-floating p-4 relative overflow-hidden hover:border-primary/30 transition-colors"
              >
                <div className={`pointer-events-none absolute -top-12 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${s.accent} blur-2xl`} />
                <p className="relative text-xs text-muted-foreground">{s.label}</p>
                <p className="relative mt-1 text-2xl font-bold font-mono tracking-tight">{s.value}</p>
              </motion.div>
            ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/create" className="press card-floating p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "var(--gradient-primary)" }}>
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Campanie nouă</p>
            <p className="text-xs text-muted-foreground">Facebook & Instagram</p>
          </div>
        </Link>
        <Link to="/leads" className="press card-floating p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Clienți potențiali</p>
            <p className="text-xs text-muted-foreground">Toate platformele</p>
          </div>
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 space-y-2">
          {[0,1,2].map((i) => (
            <div key={i} className="card-floating p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded skeleton" />
                <div className="h-2.5 w-1/3 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 card-floating p-10 text-center relative overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 50% 0%, oklch(0.62 0.22 295 / 0.25), transparent 60%)" }} />
          <div className="relative">
            <motion.div
              animate={{ y: [0, -6, 0], rotate: [0, 3, -3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="text-6xl"
            >
              🚀
            </motion.div>
            <h3 className="mt-4 font-bold text-lg">Pregătit de decolare</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lansează prima ta campanie și vezi datele aici în câteva minute.
            </p>
            <Link to="/create" className="press btn-primary mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> Creează prima campanie
            </Link>
            <div className="hidden"><TrendingUp /></div>
          </div>
        </motion.div>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Campaniile tale</h2>
          <div className="mt-3 space-y-2">
            {campaigns.map((c, idx) => {
              const color = c.status === "active" ? "bg-success pulse-dot text-success" : c.status === "paused" ? "bg-yellow-500" : "bg-muted-foreground";
              const canToggle =
                c.platform === "meta" && !!c.meta_campaign_id && (c.status === "active" || c.status === "paused");
              const next = c.status === "active" ? "paused" : "active";
              const onToggle = async (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setBusyId(c.id);
                try {
                  await toggleStatus({ data: { campaign_id: c.id, status: next } });
                  setCampaigns((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
                  toast.success(next === "paused" ? "Campanie pusă pe pauză" : "Campanie reactivată");
                } catch (err: any) {
                  toast.error(err?.message ?? "Eroare");
                } finally {
                  setBusyId(null);
                }
              };
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                >
                  <Link
                    to="/campaigns/$id"
                    params={{ id: c.id }}
                    className="press card-floating p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {c.platform === "meta" ? "Meta" : "TikTok"} · {fmtMoney(c.spend)} cheltuit · {fmtNum(c.leads)} clienți
                      </p>
                    </div>
                    {canToggle && (
                      <button
                        onClick={onToggle}
                        disabled={busyId === c.id}
                        title={next === "paused" ? "Pune pe pauză" : "Reactivează"}
                        className="press shrink-0 w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-50"
                      >
                        {c.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</h2>
      <div className="mt-3">
        <WhatsAppConnectionCard />
      </div>

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
    </div>
  );
}