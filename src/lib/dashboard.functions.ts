import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashDay = { date: string; spend: number; leads: number };
export type DashCampaign = {
  id: string;
  name: string;
  platform: string;
  status: string;
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  cpl: number;
};
export type DashLead = {
  id: string;
  name: string;
  detail: string;
  created_at: string;
};

export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const today = new Date();
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(dayKey(d));
    }
    const prevStart = new Date(today);
    prevStart.setUTCDate(prevStart.getUTCDate() - 13);

    const [{ data: campaigns }, { data: perf }, { data: leads }, { data: insights }] =
      await Promise.all([
        supabase
          .from("campaigns")
          .select("id, name, platform, status, created_at, meta_campaign_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("performance_data")
          .select("campaign_id, date, spend, leads, clicks, impressions")
          .eq("user_id", userId)
          .gte("date", dayKey(prevStart))
          .limit(2000),
        supabase
          .from("leads")
          .select("id, full_name, email, phone, platform, status, created_at, campaign_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("ai_insights")
          .select("id, campaign_id, insight_text, action, generated_at")
          .eq("user_id", userId)
          .order("generated_at", { ascending: false })
          .limit(3),
      ]);

    const rows = perf ?? [];
    const inCurrent = (d: string) => days.includes(d);

    const series: DashDay[] = days.map((d) => ({ date: d, spend: 0, leads: 0 }));
    const byDay = new Map(series.map((s) => [s.date, s]));
    let curSpend = 0, curLeads = 0, curClicks = 0, curImpr = 0;
    let prevSpend = 0, prevLeads = 0;
    const byCampaign = new Map<string, { spend: number; leads: number; clicks: number; impressions: number }>();

    for (const r of rows) {
      const spend = Number(r.spend ?? 0);
      const lds = Number(r.leads ?? 0);
      if (inCurrent(r.date as string)) {
        const s = byDay.get(r.date as string);
        if (s) { s.spend += spend; s.leads += lds; }
        curSpend += spend; curLeads += lds;
        curClicks += Number(r.clicks ?? 0);
        curImpr += Number(r.impressions ?? 0);
      } else {
        prevSpend += spend; prevLeads += lds;
      }
      const k = r.campaign_id as string;
      const acc = byCampaign.get(k) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0 };
      acc.spend += spend; acc.leads += lds;
      acc.clicks += Number(r.clicks ?? 0);
      acc.impressions += Number(r.impressions ?? 0);
      byCampaign.set(k, acc);
    }

    const camps: DashCampaign[] = (campaigns ?? []).map((c: any) => {
      const p = byCampaign.get(c.id) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0 };
      return {
        id: c.id,
        name: c.name,
        platform: c.platform,
        status: c.status,
        spend: p.spend,
        leads: p.leads,
        clicks: p.clicks,
        impressions: p.impressions,
        cpl: p.leads ? p.spend / p.leads : 0,
      };
    });

    const pct = (cur: number, prev: number) =>
      prev > 0 ? ((cur - prev) / prev) * 100 : null;

    const leadRows: DashLead[] = (leads ?? []).map((l: any) => ({
      id: l.id,
      name: l.full_name || l.phone || l.email || "Lead nou",
      detail:
        (l.platform === "meta" ? "Meta" : l.platform === "booking" ? "Programare" : l.platform || "Lead") +
        (l.status ? ` · ${l.status}` : ""),
      created_at: l.created_at,
    }));

    const todayStr = dayKey(today);
    const leadsToday = rows
      .filter((r) => r.date === todayStr)
      .reduce((a, r) => a + Number(r.leads ?? 0), 0);

    return {
      kpis: {
        spend: curSpend,
        leads: curLeads,
        cpl: curLeads ? curSpend / curLeads : 0,
        ctr: curImpr ? (curClicks / curImpr) * 100 : 0,
        clicks: curClicks,
        impressions: curImpr,
        spendTrend: pct(curSpend, prevSpend),
        leadsTrend: pct(curLeads, prevLeads),
        cplTrend:
          prevLeads > 0 && curLeads > 0
            ? pct(curSpend / curLeads, prevSpend / prevLeads)
            : null,
      },
      series,
      campaigns: camps,
      leads: leadRows,
      leadsToday,
      insights: (insights ?? []).map((i: any) => ({
        id: i.id,
        campaign_id: i.campaign_id,
        text: i.insight_text,
        action: i.action,
      })),
    };
  });
