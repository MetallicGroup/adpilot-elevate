import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { metaGraphRequest } from "./client";
import { getMetaAccessToken } from "./oauth";
import type { MetaInsightsSummary } from "./types";

type InsightsRow = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: Array<{ action_type: string; value: string }>;
};

type InsightsResponse = { data: InsightsRow[] };

function extractLeads(actions?: Array<{ action_type: string; value: string }>) {
  if (!actions) return 0;
  const lead = actions.find((a) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped");
  return lead ? parseInt(lead.value, 10) || 0 : 0;
}

export async function syncMetaInsights(userId: string, campaignUuid?: string) {
  const token = await getMetaAccessToken(userId);

  let query = supabaseAdmin
    .from("meta_campaigns")
    .select("id, meta_campaign_id, meta_ad_accounts(ad_account_id)")
    .eq("user_id", userId);

  if (campaignUuid) {
    query = query.eq("id", campaignUuid);
  }

  const { data: campaigns, error } = await query;
  if (error) throw new Error(error.message);
  if (!campaigns?.length) return { synced: 0 };

  let synced = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const campaign of campaigns) {
    if (!campaign.meta_campaign_id) continue;

    const adAccountRaw = campaign.meta_ad_accounts as { ad_account_id: string } | { ad_account_id: string }[] | null;
    const adAccount = Array.isArray(adAccountRaw) ? adAccountRaw[0] : adAccountRaw;
    const actId = adAccount?.ad_account_id?.startsWith("act_")
      ? adAccount.ad_account_id
      : `act_${adAccount?.ad_account_id ?? ""}`;

    const insights = await metaGraphRequest<InsightsResponse>(`/${actId}/insights`, {
      accessToken: token,
      body: {
        level: "campaign",
        filtering: JSON.stringify([
          { field: "campaign.id", operator: "EQUAL", value: campaign.meta_campaign_id },
        ]),
        fields: "spend,impressions,clicks,ctr,cpc,actions",
        date_preset: "maximum",
      },
    });

    const row = insights.data?.[0];
    if (!row) continue;

    const spend = parseFloat(row.spend ?? "0");
    const leads = extractLeads(row.actions);
    const cpl = leads > 0 ? spend / leads : 0;

    const { error: upsertError } = await supabaseAdmin.from("meta_performance").upsert(
      {
        user_id: userId,
        campaign_id: campaign.id,
        date: today,
        spend,
        impressions: parseInt(row.impressions ?? "0", 10),
        clicks: parseInt(row.clicks ?? "0", 10),
        ctr: parseFloat(row.ctr ?? "0"),
        cpc: parseFloat(row.cpc ?? "0"),
        leads,
        cpl,
      },
      { onConflict: "campaign_id,date" },
    );

    if (!upsertError) synced++;
  }

  return { synced };
}

export async function getMetaInsightsSummary(userId: string): Promise<MetaInsightsSummary & { campaigns: Array<{ id: string; name: string; status: string; spend: number; leads: number }> }> {
  const { data: perf, error: perfError } = await supabaseAdmin
    .from("meta_performance")
    .select("spend, impressions, clicks, ctr, cpc, leads, cpl, campaign_id, meta_campaigns(campaign_name, status)")
    .eq("user_id", userId);

  if (perfError) throw new Error(perfError.message);

  const summary: MetaInsightsSummary = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    leads: 0,
    cpl: 0,
  };

  const campaignMap = new Map<string, { id: string; name: string; status: string; spend: number; leads: number }>();

  for (const row of perf ?? []) {
    summary.spend += Number(row.spend);
    summary.impressions += row.impressions;
    summary.clicks += row.clicks;
    summary.leads += row.leads;

    const meta = row.meta_campaigns as { campaign_name: string; status: string } | null;
    const existing = campaignMap.get(row.campaign_id) ?? {
      id: row.campaign_id,
      name: meta?.campaign_name ?? "Campaign",
      status: meta?.status ?? "PAUSED",
      spend: 0,
      leads: 0,
    };
    existing.spend += Number(row.spend);
    existing.leads += row.leads;
    campaignMap.set(row.campaign_id, existing);
  }

  if (summary.impressions > 0) {
    summary.ctr = (summary.clicks / summary.impressions) * 100;
  }
  if (summary.clicks > 0) {
    summary.cpc = summary.spend / summary.clicks;
  }
  if (summary.leads > 0) {
    summary.cpl = summary.spend / summary.leads;
  }

  return { ...summary, campaigns: [...campaignMap.values()] };
}
