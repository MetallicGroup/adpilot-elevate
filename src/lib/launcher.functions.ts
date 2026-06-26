// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateLauncherAdCopy, regenerateAdCopy } from "@/lib/launcher/copy-generator";
import { launchFromDraft, resolvePlatformForUser } from "@/lib/launcher/launch.service";
import { suggestLeadFields } from "@/lib/launcher/presets";
import type { LeadFieldConfig } from "@/lib/launcher/types";
import { fetchMetaPages } from "@/lib/meta/campaign";

const AnswersSchema = z.object({
  promotion_goal: z.enum(["appointments", "leads", "service", "product", "offer", "course"]),
  niche: z.enum(["beauty_makeup", "hair_salon", "nails", "fitness", "restaurant", "clinic", "construction", "auto", "ecommerce", "general"]),
  service: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  radius_km: z.number().min(5).max(50).default(15),
  daily_budget: z.number().min(10).max(100000),
  business_name: z.string().max(120).optional(),
  privacy_policy_url: z.string().url().optional(),
});

const LeadFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean(),
  customQuestion: z.string().optional(),
});

export const generateLauncherCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      answers: AnswersSchema,
      lead_fields: z.array(LeadFieldSchema).optional(),
      variation: z.number().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const fields = (data.lead_fields as LeadFieldConfig[]) ?? suggestLeadFields(data.answers.niche);
    if (data.variation) {
      return regenerateAdCopy(data.answers, fields, data.variation);
    }
    return generateLauncherAdCopy(data.answers, fields);
  });

export const launchLauncherCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      answers: AnswersSchema,
      generated: z.object({
        campaign_name: z.string(),
        primary_text: z.string(),
        headline: z.string(),
        description: z.string(),
        call_to_action: z.enum(["SIGN_UP", "LEARN_MORE", "BOOK_NOW"]),
        audience_summary: z.string(),
        lead_form_questions: z.array(LeadFieldSchema),
        whatsapp_followup: z.string(),
        daily_report_template: z.string(),
        targeting_suggestion: z.object({
          countries: z.array(z.string()),
          city: z.string(),
          radius_km: z.number(),
          age_min: z.number(),
          age_max: z.number(),
          interests: z.array(z.string()),
        }),
      }),
      lead_fields: z.array(LeadFieldSchema),
      creative_urls: z.array(z.string()).max(5),
      platform: z.enum(["meta", "tiktok"]).optional(),
      ad_account_uuid: z.string().uuid().optional(),
      page_id: z.string().optional(),
      privacy_policy_url: z.string().url(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const platform = data.platform ?? (await resolvePlatformForUser(context.userId)) ?? "meta";

    let adAccountUuid = data.ad_account_uuid;
    let pageId = data.page_id;

    if (platform === "meta" && (!adAccountUuid || !pageId)) {
      const { data: account } = await supabaseAdmin
        .from("meta_ad_accounts")
        .select("id")
        .eq("user_id", context.userId)
        .limit(1)
        .maybeSingle();
      const pages = await fetchMetaPages(context.userId).catch(() => []);
      adAccountUuid = account?.id;
      pageId = pages[0]?.id;
    }

    return launchFromDraft({
      userId: context.userId,
      answers: data.answers,
      generated: data.generated,
      leadFields: data.lead_fields as LeadFieldConfig[],
      creativeUrls: data.creative_urls,
      platform,
      adAccountUuid,
      pageId,
      privacyPolicyUrl: data.privacy_policy_url,
    });
  });

export const getLauncherPlatformStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: metaConn } = await supabaseAdmin
      .from("meta_connections")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: accounts } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("id, account_name")
      .eq("user_id", context.userId);

    let pages: Array<{ id: string; name: string }> = [];
    if (metaConn) {
      try {
        pages = await fetchMetaPages(context.userId);
      } catch {
        pages = [];
      }
    }

    return {
      meta_connected: !!metaConn,
      meta_accounts: accounts ?? [],
      meta_pages: pages,
      tiktok_available: true,
      suggested_platform: metaConn ? "meta" : "tiktok",
    };
  });