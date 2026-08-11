import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Plus, Inbox, ArrowRight, Sparkles, Pause, Play, CreditCard, Target,
  TrendingUp, MousePointerClick, Wand2, BarChart3, CalendarClock,
} from "lucide-react";
import { fmtMoney, fmtNum } from "@/lib/format";
import { setCampaignStatus } from "@/lib/campaigns.functions";
import { refreshAllLiveCampaignInsights } from "@/lib/meta-insights.functions";
import { getDashboardOverview } from "@/lib/dashboard.functions";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { toast } from "sonner";
import { WhatsAppConnectionCard } from "@/components/whatsapp/WhatsAppConnectionCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Overview = Awaited<ReturnType<typeof getDashboardOverview>>;

function Trend({ value, invert, suffix }: { value: number | null; invert?: boolean; suffix?: string }) {
  if (value === null || !isFinite(value)) {
    return <span className="text-[10px] text-muted-foreground">fără date de comparație</span>;
  }
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`text-[10px] ${good ? "text-success" : "text-destructive"}`}>
      {up ? "↑" : "↓"} {Math.abs(value).toFixed(1).replace(".", ",")}%{" "}
      <span className="text-muted-foreground">{suffix ?? "față de perioada trecută"}</span>
    </span>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <article className={`card-floating overflow-hidden ${className}`}>{children}</article>;
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
      <div className="min-w-0">
        <b className="block text-sm">{title}</b>
        {sub && <small className="mt-0.5 block text-[10px] text-muted-foreground">{sub}</small>}
      </div>
      {right}
    </div>
  );
}

function initials(n: string) {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "L";
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `acum ${Math.round(s)} sec`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} z`;
}

function Dashboard() {
  const [name, setName] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useServerFn(getDashboardOverview);
  const refreshAll = useServerFn(refreshAllLiveCampaignInsights);
  const toggleStatus = useServerFn(setCampaignStatus);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      setName(((u.user?.user_metadata as any)?.full_name || u.user?.email?.split("@")[0] || "").split(" ")[0]);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async (withRefresh: boolean) => {
      try {
        if (withRefresh) await refreshAll().catch(() => {});
        const r = await load();
        if (alive) setData(r);
      } catch {
        /* silent */
      } finally {
        if (alive) setLoading(false);
      }
    };
    tick(false);
    const t0 = setTimeout(() => tick(true), 800);
    const t = setInterval(() => tick(true), 60_000);
    return () => { alive = false; clearTimeout(t0); clearInterval(t); };
  }, [load, refreshAll]);

  const campaigns = data?.campaigns ?? [];
  const active = campaigns.filter((c) => c.status === "active");
  const k = data?.kpis;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 5 ? "Noapte bună" : h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara";
  }, []);

  const onToggle = async (id: string, status: string) => {
    const next = status === "active" ? "paused" : "active";
    setBusyId(id);
    try {
      await toggleStatus({ data: { campaign_id: id, status: next as "active" | "paused" } });
      setData((d) => d ? { ...d, campaigns: d.campaigns.map((c) => c.id === id ? { ...c, status: next } : c) } : d);
      toast.success(next === "paused" ? "Campanie pusă pe pauză" : "Campanie reactivată");
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setBusyId(null);
    }
  };

  const kpis = [
    { label: "Cheltuit", icon: CreditCard, value: fmtMoney(k?.spend ?? 0), trend: <Trend value={k?.spendTrend ?? null} /> },
    { label: "Clienți potențiali", icon: Inbox, value: fmtNum(k?.leads ?? 0), trend: <Trend value={k?.leadsTrend ?? null} /> },
    { label: "Cost / client", icon: Target, value: fmtMoney(k?.cpl ?? 0), trend: <Trend value={k?.cplTrend ?? null} invert suffix="mai eficient" /> },
    { label: "Rată de click", icon: MousePointerClick, value: `${(k?.ctr ?? 0).toFixed(2).replace(".", ",")}%`, trend: <span className="text-[10px] text-muted-foreground">{fmtNum(k?.clicks ?? 0)} click-uri · {fmtNum(k?.impressions ?? 0)} afișări</span> },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      {/* Welcome */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-success" />
            Command center
          </span>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.05] tracking-[-0.045em] sm:text-[34px]">
            {greeting}{name ? `, ${name}` : ""} — iată cum merg{" "}
            <span className="gradient-text">campaniile tale</span>
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {active.length
              ? `${active.length} ${active.length === 1 ? "campanie activă" : "campanii active"} · date live din ultimele 7 zile.`
              : "Nicio campanie activă momentan. Lansează una și vezi datele live aici."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[10px] text-muted-foreground sm:inline-block">
            Ultimele 7 zile
          </span>
          <Link to="/create" className="press btn-primary shine inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Campanie nouă
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="card-floating p-4">
                <div className="skeleton h-3 w-20 rounded" />
                <div className="skeleton mt-3 h-7 w-24 rounded" />
              </div>
            ))
          : kpis.map((s, i) => (
              <motion.article
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
                className="card-floating relative min-h-[124px] overflow-hidden p-4 transition-colors hover:border-primary/30"
              >
                <div className="pointer-events-none absolute -bottom-14 -right-14 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">{s.label}</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
                    <s.icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="relative mt-2.5 font-mono text-[22px] font-extrabold tracking-[-0.04em] sm:text-[27px]">{s.value}</p>
                <div className="relative mt-1">{s.trend}</div>
              </motion.article>
            ))}
      </div>

      {/* Chart + AI */}
      <div className="mt-4 grid gap-3.5 lg:grid-cols-[1.55fr_.95fr]">
        <Card>
          <CardHead
            title="Performanță"
            sub="Cheltuieli vs clienți potențiali"
            right={<span className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">7 zile</span>}
          />
          {loading ? (
            <div className="skeleton mx-4 mb-6 h-[190px] rounded-xl sm:mx-5 sm:h-[225px]" />
          ) : (
            <PerformanceChart data={data?.series ?? []} />
          )}
        </Card>

        <Card className="relative flex flex-col" >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle at 85% 0%, oklch(0.62 0.22 305 / 0.18), transparent 45%)" }}
          />
          <CardHead
            title="AdPilot AI"
            sub="Recomandări live pentru contul tău"
            right={<span className="text-[10px] text-success">● online</span>}
          />
          <div className="relative flex-1 px-4 pb-4 sm:px-5">
            <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/10 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                AI
              </span>
              <div className="min-w-0">
                <b className="block text-[11px]">
                  {data?.insights.length ? `Am găsit ${data.insights.length} ${data.insights.length === 1 ? "oportunitate" : "oportunități"}` : "Analizez contul tău"}
                </b>
                <small className="mt-0.5 block text-[9px] text-muted-foreground">
                  {data?.insights.length ? "Recomandări generate din performanța reală" : "Recomandările apar imediat ce sunt suficiente date"}
                </small>
              </div>
            </div>
            <div className="grid gap-2">
              {(data?.insights ?? []).map((i) => {
                const inner = (
                  <>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-primary/10 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <b className="block text-[10px] leading-snug">{i.text}</b>
                      {i.action && <small className="mt-0.5 block text-[9px] text-primary">→ {i.action}</small>}
                    </div>
                  </>
                );
                return i.campaign_id ? (
                  <Link key={i.id} to="/campaigns/$id" params={{ id: i.campaign_id }} className="press flex items-center gap-2.5 rounded-xl border border-border bg-background/50 p-2.5 transition-colors hover:border-primary/40">
                    {inner}
                  </Link>
                ) : (
                  <div key={i.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/50 p-2.5">{inner}</div>
                );
              })}
              {!loading && !data?.insights.length && (
                <p className="rounded-xl border border-border bg-background/50 p-3 text-[10px] text-muted-foreground">
                  Nicio recomandare încă. AdPilot AI analizează campaniile la fiecare rulare.
                </p>
              )}
            </div>
          </div>
          <div className="relative px-4 pb-4 sm:px-5">
            <Link to="/whatsapp" className="press flex h-11 items-center gap-2 rounded-xl border border-border bg-background/60 px-3 text-[11px] text-muted-foreground">
              Întreabă AdPilot AI orice...
              <span className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </Card>
      </div>

      {/* Campaigns + Leads */}
      <div className="mt-4 grid gap-3.5 lg:grid-cols-[1.28fr_.72fr]">
        <Card>
          <CardHead
            title="Campaniile tale"
            sub="Performanță în timp real"
            right={
              <Link to="/reports" className="press rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                Vezi toate →
              </Link>
            }
          />
          <div className="px-3 pb-4 sm:px-4">
            <div className="grid grid-cols-[1.4fr_.55fr_.55fr_.4fr] gap-2 border-b border-border px-2 pb-2 text-[9px] uppercase tracking-wide text-muted-foreground">
              <span>Campanie</span>
              <span>Clienți</span>
              <span className="hidden sm:block">Cost/client</span>
              <span className="text-right">Status</span>
            </div>
            {loading ? (
              [0, 1, 2].map((i) => <div key={i} className="skeleton mt-2 h-12 rounded-xl" />)
            ) : campaigns.length === 0 ? (
              <div className="px-2 py-10 text-center">
                <div className="text-4xl">🚀</div>
                <p className="mt-3 text-sm font-semibold">Pregătit de decolare</p>
                <p className="mt-1 text-xs text-muted-foreground">Lansează prima campanie și vezi datele aici.</p>
                <Link to="/create" className="press btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> Creează prima campanie
                </Link>
              </div>
            ) : (
              campaigns.slice(0, 8).map((c) => (
                <div key={c.id} className="grid grid-cols-[1.4fr_.55fr_.55fr_.4fr] items-center gap-2 border-b border-border/60 px-2 py-3 text-[10px] last:border-0">
                  <Link to="/campaigns/$id" params={{ id: c.id }} className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-primary/10 text-primary">
                      <Target className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[11px]">{c.name}</b>
                      <small className="block text-[9px] text-muted-foreground">
                        {c.platform === "meta" ? "Facebook & Instagram" : c.platform} · {fmtMoney(c.spend)}
                      </small>
                    </span>
                  </Link>
                  <span>{fmtNum(c.leads)}</span>
                  <span className="hidden sm:block">{c.leads ? fmtMoney(c.cpl) : "—"}</span>
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className={`rounded-full px-2 py-1 text-[8px] ${
                        c.status === "active"
                          ? "bg-success/10 text-success"
                          : c.status === "paused"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status === "active" ? "Activă" : c.status === "paused" ? "Pauză" : "Draft"}
                    </span>
                    {(c.status === "active" || c.status === "paused") && (
                      <button
                        onClick={() => onToggle(c.id, c.status)}
                        disabled={busyId === c.id}
                        title={c.status === "active" ? "Pune pe pauză" : "Reactivează"}
                        className="press grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary disabled:opacity-50"
                      >
                        {c.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHead
            title="Clienți potențiali noi"
            sub="Ultimele conversații"
            right={<span className="text-[10px] text-success">{fmtNum(data?.leadsToday ?? 0)} azi</span>}
          />
          <div className="grid gap-2 px-4 pb-4 sm:px-5">
            {loading ? (
              [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)
            ) : (data?.leads.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-border bg-background/50 p-3 text-[10px] text-muted-foreground">
                Niciun client potențial încă. Apar aici automat din reclame și paginile de programări.
              </p>
            ) : (
              data!.leads.map((l) => (
                <Link key={l.id} to="/leads" className="press flex items-center gap-2.5 rounded-xl border border-border bg-background/50 p-2.5 transition-colors hover:border-primary/40">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                    {initials(l.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[11px]">{l.name}</b>
                    <small className="block truncate text-[9px] text-muted-foreground">{l.detail}</small>
                  </span>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{timeAgo(l.created_at)}</span>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/create", icon: Plus, title: "Campanie nouă", sub: "Pornește în câteva minute" },
          { to: "/bookings", icon: CalendarClock, title: "Programări", sub: "Din paginile de booking" },
          { to: "/leads", icon: Inbox, title: "Clienți potențiali", sub: "Toate platformele" },
          { to: "/reports", icon: BarChart3, title: "Raport complet", sub: "Vezi performanța" },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="press card-floating flex items-center gap-3 p-4 transition-colors hover:border-primary/40">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <q.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <b className="block text-sm font-medium">{q.title}</b>
              <small className="block text-xs text-muted-foreground">{q.sub}</small>
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp</h2>
      <div className="mt-3 pb-4">
        <WhatsAppConnectionCard />
      </div>

      <div className="hidden">
        <TrendingUp />
        <Wand2 />
      </div>
    </div>
  );
}
