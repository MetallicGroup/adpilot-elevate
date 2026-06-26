import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Sparkles, TrendingUp, DollarSign, Eye, MousePointerClick, Users, Pause, Play } from "lucide-react";
import { getCampaign, setCampaignStatus } from "@/lib/campaigns.functions";
import { refreshCampaignInsights } from "@/lib/meta-insights.functions";
import { generateAiInsights } from "@/lib/ai-optimize.functions";
import { publishMetaCampaign } from "@/lib/meta-publish.functions";
import { AdPreview } from "@/components/wizard/AdPreview";
import { fmtMoney, fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  component: CampaignDetail,
});

type Data = Awaited<ReturnType<typeof getCampaign>>;

function CampaignDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getCampaign);
  const refresh = useServerFn(refreshCampaignInsights);
  const aiGen = useServerFn(generateAiInsights);
  const publishFn = useServerFn(publishMetaCampaign);
  const toggleStatus = useServerFn(setCampaignStatus);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const d = await load({ data: { id } });
      setData(d);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't load campaign");
    } finally {
      setLoading(false);
    }
  }, [id, load]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh insights every 60s if it's a live Meta campaign
  useEffect(() => {
    if (!data?.campaign?.meta_campaign_id) return;
    // Fire one immediately on mount, then every 60s
    onRefresh(true);
    const t = setInterval(() => { onRefresh(true); }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.campaign?.meta_campaign_id]);

  const onRefresh = async (silent = false) => {
    setRefreshing(true);
    try {
      const r = await refresh({ data: { campaign_id: id } });
      if (!silent && r.skipped) toast.message(r.reason);
      await fetchAll();
      if (!silent && !r.skipped) toast.success("Date actualizate");
    } catch (e: any) {
      if (!silent) toast.error(e?.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const onAi = async () => {
    setAiBusy(true);
    try {
      const r = await aiGen({ data: { campaign_id: id } });
      toast.success(`AI a generat ${r.inserted} observații`);
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  const onPublish = async () => {
    setPublishing(true);
    try {
      await publishFn({ data: { campaign_id: id } });
      toast.success("Campanie publicată pe Meta");
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const onToggleStatus = async () => {
    if (!data) return;
    const next = data.campaign.status === "active" ? "paused" : "active";
    setTogglingStatus(true);
    try {
      await toggleStatus({ data: { campaign_id: id, status: next } });
      toast.success(next === "paused" ? "Campanie pusă pe pauză" : "Campanie reactivată");
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setTogglingStatus(false);
    }
  };

  if (loading) {
    return <div className="max-w-md mx-auto px-5 pt-10 text-sm text-muted-foreground">Se încarcă…</div>;
  }
  if (!data) return null;
  const { campaign, totals, perf, insights } = data;
  const creative = (campaign.creative as any) ?? {};
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.leads ? totals.spend / totals.leads : 0;

  const stats = [
    { label: "Cheltuit", value: fmtMoney(totals.spend), icon: DollarSign },
    { label: "Vizionări", value: fmtNum(totals.impressions), icon: Eye },
    { label: "Clickuri", value: fmtNum(totals.clicks), icon: MousePointerClick },
    { label: "Clienți potențiali", value: fmtNum(totals.leads), icon: Users },
    { label: "Rată click (CTR)", value: `${ctr.toFixed(2)}%`, icon: TrendingUp },
    { label: "Cost per client", value: fmtMoney(cpl), icon: DollarSign },
  ];

  const statusColor =
    campaign.status === "active" ? "bg-green-500" :
    campaign.status === "paused" ? "bg-yellow-500" : "bg-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto px-5 pt-6"
    >
      <button onClick={() => navigate({ to: "/dashboard" })} className="press inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </button>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold leading-tight truncate">{campaign.name}</h1>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="uppercase tracking-wider">{campaign.status}</span>
            <span>·</span>
            <span>{campaign.platform === "meta" ? "Meta" : "TikTok"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {campaign.platform === "meta" && campaign.meta_campaign_id && (campaign.status === "active" || campaign.status === "paused") && (
            <button
              onClick={onToggleStatus}
              disabled={togglingStatus}
              className="press inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-border text-xs font-medium disabled:opacity-50"
            >
              {campaign.status === "active" ? (
                <><Pause className="w-3.5 h-3.5" /> Pauză</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Reactivează</>
              )}
            </button>
          )}
          <button
            onClick={() => onRefresh()}
            disabled={refreshing}
            className="press inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-border text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {campaign.status === "draft" && campaign.platform === "meta" && (
        <div className="mt-4 card-floating p-4 flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">Draft</div>
            <div className="text-xs text-muted-foreground">Publică pe Meta pentru a activa campania.</div>
          </div>
          <button
            onClick={onPublish}
            disabled={publishing}
            className="press shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-foreground text-background text-xs font-medium disabled:opacity-50"
          >
            {publishing ? "Public…" : "Publică acum"}
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card-floating p-4">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <s.icon className="w-3 h-3" /> {s.label}
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI insights</h2>
        <button
          onClick={onAi}
          disabled={aiBusy}
          className="press inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-foreground text-background text-xs font-medium disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" /> {aiBusy ? "Analizez…" : "Cere analiză"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {insights.length === 0 ? (
          <div className="card-floating p-4 text-sm text-muted-foreground">
            Niciun insight încă. Apasă <strong className="text-foreground">Cere analiză</strong> și AI-ul va analiza performanța și îți va da recomandări simple.
          </div>
        ) : (
          insights.map((i) => (
            <div key={i.id} className="card-floating p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 text-foreground shrink-0" />
                <div className="text-sm leading-relaxed">{i.insight_text}</div>
              </div>
              {i.action && (
                <div className="mt-2 ml-6 text-xs px-2.5 py-1 inline-block rounded-full bg-secondary text-foreground">
                  → {i.action}
                </div>
              )}
              <div className="mt-2 ml-6 text-[10px] uppercase tracking-wider text-muted-foreground">
                {new Date(i.generated_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      <h2 className="mt-7 text-sm font-semibold">Previzualizare</h2>
      <div className="mt-3">
        <AdPreview
          pageName={campaign.name}
          headline={creative.headline ?? ""}
          description={creative.description ?? ""}
          cta={creative.cta ?? "Learn More"}
          mediaUrl={creative.media_url ?? ""}
          landingUrl={creative.landing_url ?? ""}
        />
      </div>

      {perf.length > 0 && (
        <>
          <h2 className="mt-7 text-sm font-semibold">Pe zile</h2>
          <div className="mt-3 card-floating divide-y divide-border">
            {perf.map((p) => (
              <div key={p.date} className="flex items-center justify-between px-4 py-3 text-xs">
                <div className="text-muted-foreground">{p.date}</div>
                <div className="flex items-center gap-4 tabular-nums">
                  <span>{fmtMoney(Number(p.spend))}</span>
                  <span>{fmtNum(p.impressions)} vizionări</span>
                  <span>{fmtNum(p.leads)} clienți</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Link to="/leads" className="mt-6 inline-block text-xs text-muted-foreground underline">
        Vezi toți clienții potențiali →
      </Link>
    </motion.div>
  );
}