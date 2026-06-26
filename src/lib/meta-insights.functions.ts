import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ campaign_id: z.string().uuid() });

/**
 * Pulls live insights from Meta Graph for a campaign, upserts today's snapshot
 * into performance_data, and returns the snapshot.
 */
export const refreshCampaignInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, platform, meta_campaign_id")
      .eq("id", data.campaign_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.platform !== "meta" || !campaign.meta_campaign_id) {
      return { skipped: true as const, reason: "Not a published Meta campaign yet" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) throw new Error("No active Meta connection");

    const { fetchCampaignInsights } = await import("./meta-insights.server");
    const snap = await fetchCampaignInsights(campaign.meta_campaign_id, conn.access_token);

    const today = new Date().toISOString().slice(0, 10);
    await supabaseAdmin.from("performance_data").upsert(
      {
        user_id: userId,
        campaign_id: campaign.id,
        date: today,
        spend: snap.spend,
        impressions: snap.impressions,
        clicks: snap.clicks,
        ctr: snap.ctr,
        leads: snap.leads,
        cpl: snap.cpl,
      },
      { onConflict: "campaign_id,date" },
    );
    return { skipped: false as const, snapshot: snap };
  });

/**
 * Refreshes insights for ALL of the user's live Meta campaigns (status active/paused
 * with a meta_campaign_id). Used by the dashboard to keep totals current.
 */
export const refreshAllLiveCampaignInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, meta_campaign_id")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .not("meta_campaign_id", "is", null);
    if (!campaigns || campaigns.length === 0) return { refreshed: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) return { refreshed: 0 };

    const { fetchCampaignInsights } = await import("./meta-insights.server");
    const today = new Date().toISOString().slice(0, 10);
    let ok = 0;
    await Promise.all(
      campaigns.map(async (c) => {
        try {
          const snap = await fetchCampaignInsights(c.meta_campaign_id!, conn.access_token!);
          await supabaseAdmin.from("performance_data").upsert(
            {
              user_id: userId,
              campaign_id: c.id,
              date: today,
              spend: snap.spend,
              impressions: snap.impressions,
              clicks: snap.clicks,
              ctr: snap.ctr,
              leads: snap.leads,
              cpl: snap.cpl,
            },
            { onConflict: "campaign_id,date" },
          );
          ok++;
        } catch {
          // ignore per-campaign failures
        }
      }),
    );
    return { refreshed: ok };
  });