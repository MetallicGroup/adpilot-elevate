import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Plus, TrendingUp, Inbox } from "lucide-react";
import { fmtMoney, fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata as any)?.full_name || data.user?.email?.split("@")[0] || "";
      setName(n);
    });
  }, []);

  const stats = [
    { label: "Today's spend", value: fmtMoney(0) },
    { label: "Active campaigns", value: fmtNum(0) },
    { label: "Total leads", value: fmtNum(0) },
    { label: "Avg CPL", value: fmtMoney(0) },
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

      <div className="mt-8 card-floating p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">No campaigns yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Connect your TikTok account and launch your first campaign.</p>
        <Link
          to="/create"
          className="press mt-5 inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background rounded-xl text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Create campaign
        </Link>
      </div>
    </motion.div>
  );
}