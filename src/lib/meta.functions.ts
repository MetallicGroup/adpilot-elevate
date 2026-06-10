import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMetaOAuthUrl, createOAuthState } from "@/lib/meta/oauth";
import { createMetaLeadCampaign, fetchMetaPages } from "@/lib/meta/campaign";
import { generateMetaCampaignContent } from "@/lib/meta/ai";
import { syncMetaInsights, getMetaInsightsSummary } from "@/lib/meta/insights";
import { syncMetaLeads } from "@/lib/meta/leads";
import type { MetaBusinessDetails } from "@/lib/meta/types";

const BusinessDetailsSchema = z.object({
  business_name: z.string().min(1).max(120),
  service_product: z.string().min(1).max(200),
  location: z.string().min(1).max(120),
  target_audience: z.string().min(1).max(300),
  daily_budget: z.number().min(5).max(100000),
  duration_days: z.number().min(1).max(365),
  phone: z.string().min(1).max(40),
  website: z.string().max(2000).optional(),
});

const LaunchSchema = z.object({
  ad_account_uuid: z.string().uuid(),
  page_id: z.string().min(1),
  business_details: BusinessDetailsSchema,
  generated: z.object({
    campaign_name: z.string().min(1),
    primary_text: z.string().min(1),
    headline: z.string().min(1),
    description: z.string().min(1),
    call_to_action: z.enum(["SIGN_UP", "LEARN_MORE"]),
    lead_form_questions: z.array(z.string()).min(1),
    targeting_suggestion: z.object({
      countries: z.array(z.string()).min(1),
      age_min: z.number().min(18),
      age_max: z.number().max(65),
    }),
  }),
  privacy_policy_url: z.string().url(),
  launch_active: z.boolean().optional(),
});

export const getMetaAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const state = await createOAuthState(context.userId);
    return { url: buildMetaOAuthUrl(state) };
  });

export const getMetaConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: connection } = await supabaseAdmin
      .from("meta_connections")
      .select("meta_user_id, meta_user_name, token_expires_at")
      .eq("user_id", context.userId)
      .eq("provider", "meta")
      .maybeSingle();

    const { data: accounts } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("id, ad_account_id, account_name, currency, timezone, status")
      .eq("user_id", context.userId)
      .order("account_name");

    let pages: Array<{ id: string; name: string }> = [];
    if (connection) {
      try {
        pages = await fetchMetaPages(context.userId);
      } catch {
        pages = [];
      }
    }

    return {
      connected: !!connection,
      connection,
      ad_accounts: accounts ?? [],
      pages,
    };
  });

export const generateMetaCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BusinessDetailsSchema.parse(data))
  .handler(async ({ data }) => {
    return generateMetaCampaignContent(data as MetaBusinessDetails);
  });

export const launchMetaCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LaunchSchema.parse(data))
  .handler(async ({ data, context }) => {
    return createMetaLeadCampaign(context.userId, data);
  });

export const fetchMetaInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await syncMetaInsights(context.userId);
    return getMetaInsightsSummary(context.userId);
  });

export const fetchMetaLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const syncResult = await syncMetaLeads(context.userId);
    const { listCrmLeads } = await import("@/lib/crm/leads.service");
    const leads = await listCrmLeads(context.userId);
    return { leads, synced: syncResult.synced };
  });

export const getMetaDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: campaigns } = await supabaseAdmin
      .from("meta_campaigns")
      .select("id, status")
      .eq("user_id", context.userId);

    const summary = await getMetaInsightsSummary(context.userId);
    const activeCampaigns = (campaigns ?? []).filter((c) => c.status === "ACTIVE").length;

    return {
      spend: summary.spend,
      active_campaigns: activeCampaigns,
      total_leads: summary.leads,
      avg_cpl: summary.cpl,
      campaign_count: campaigns?.length ?? 0,
    };
  });
