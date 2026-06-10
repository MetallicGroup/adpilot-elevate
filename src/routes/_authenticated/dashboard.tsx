import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Plus, TrendingUp } from "lucide-react";
import { fmtMoneyRon, fmtNum } from "@/lib/format";
import { getMetaDashboardStats } from "@/lib/meta.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fetchStats = useServerFn(getMetaDashboardStats);
  const [name, setName] = useState("");
  const [stats, setStats] = useState({
    spend: 0,
    active_campaigns: 0,
    total_leads: 0,
    avg_cpl: 0,
    campaign_count: 0,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata as { full_name?: string })?.full_name || data.user?.email?.split("@")[0] || "";
      setName(n);
    });
    fetchStats()
      .then(setStats)
      .catch(() => {});
  }, [fetchStats]);

  const statCards = [
    { label: "Cheltuit azi", value: fmtMoneyRon(stats.spend) },
    { label: "Reclame active", value: fmtNum(stats.active_campaigns) },
    { label: "Lead-uri totale", value: fmtNum(stats.total_leads) },
    { label: "Cost/lead", value: fmtMoneyRon(stats.avg_cpl) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-md mx-auto px-5 pt-10"
    >
      <p className="text-sm text-muted-foreground">Bună ziua{name ? `, ${name}` : ""} 👋</p>
      <h1 className="font-serif text-3xl font-semibold mt-1">Panou</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="card-floating p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {stats.campaign_count === 0 ? (
        <div className="mt-8 card-floating p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold">Încă nu ai reclame</h3>
          <p className="mt-1 text-sm text-muted-foreground">Lansează prima ta reclamă în 5 minute — fără experiență în marketing.</p>
          <Link
            to="/create"
            className="press mt-5 inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Creează reclamă
          </Link>
        </div>
      ) : (
        <div className="mt-8 card-floating p-6">
          <p className="text-sm text-muted-foreground">
            You have <strong className="text-foreground">{stats.campaign_count}</strong> Meta campaign{stats.campaign_count !== 1 ? "s" : ""}.
            View performance in Reports or check new leads.
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/reports" className="press flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-center">
              Reports
            </Link>
            <Link to="/leads" className="press flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-center">
              Leads
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}
