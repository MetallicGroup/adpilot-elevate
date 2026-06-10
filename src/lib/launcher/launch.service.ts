import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createMetaLeadCampaign } from "@/lib/meta/campaign";
import type { GeneratedAdCopy, LauncherSimpleAnswers, LeadFieldConfig } from "./types";
import { mapCtaToMeta, buildTikTokDraftPayload, mapToTechnicalConfig } from "./technical-mapper";

type LaunchInput = {
  userId: string;
  answers: LauncherSimpleAnswers;
  generated: GeneratedAdCopy;
  leadFields: LeadFieldConfig[];
  creativeUrls: string[];
  platform: "meta" | "tiktok";
  adAccountUuid?: string;
  pageId?: string;
  privacyPolicyUrl: string;
};

export async function saveDraftCampaign(input: LaunchInput & { createdFrom?: string }) {
  const technical = mapToTechnicalConfig(input.answers, input.generated, input.platform);

  const { data, error } = await supabaseAdmin
    .from("draft_campaigns")
    .insert({
      user_id: input.userId,
      platform: input.platform,
      status: "draft",
      niche: input.answers.niche,
      promotion_goal: input.answers.promotion_goal,
      service: input.answers.service,
      city: input.answers.city,
      radius_km: input.answers.radius_km,
      daily_budget: input.answers.daily_budget,
      simple_answers: input.answers,
      generated_copy: input.generated,
      lead_form_fields: input.leadFields,
      technical_config: technical,
      creative_urls: input.creativeUrls,
      whatsapp_followup: input.generated.whatsapp_followup,
      daily_report_template: input.generated.daily_report_template,
      created_from: input.createdFrom ?? "dashboard",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function launchFromDraft(input: LaunchInput) {
  const draftId = await saveDraftCampaign(input);

  if (input.platform === "meta") {
    if (!input.adAccountUuid || !input.pageId) {
      throw new Error("Conectează contul Meta și selectează un cont publicitar și o pagină Facebook.");
    }

    const result = await createMetaLeadCampaign(input.userId, {
      ad_account_uuid: input.adAccountUuid,
      page_id: input.pageId,
      business_details: {
        business_name: input.answers.business_name || input.answers.service,
        service_product: input.answers.service,
        location: `${input.answers.city} (+${input.answers.radius_km} km)`,
        target_audience: input.generated.audience_summary,
        daily_budget: input.answers.daily_budget,
        duration_days: 30,
        phone: "",
        website: undefined,
      },
      generated: {
        campaign_name: input.generated.campaign_name,
        primary_text: input.generated.primary_text,
        headline: input.generated.headline,
        description: input.generated.description,
        call_to_action: mapCtaToMeta(input.generated.call_to_action),
        lead_form_questions: input.leadFields.map((f) => f.label),
        targeting_suggestion: {
          countries: input.generated.targeting_suggestion.countries,
          age_min: input.generated.targeting_suggestion.age_min,
          age_max: input.generated.targeting_suggestion.age_max,
        },
      },
      privacy_policy_url: input.privacyPolicyUrl,
      launch_active: false,
      lead_fields: input.leadFields.map((f) => ({
        key: f.key,
        label: f.label,
        customQuestion: f.customQuestion,
      })),
      creative_urls: input.creativeUrls,
    });

    await supabaseAdmin
      .from("draft_campaigns")
      .update({ status: "launched", meta_campaign_uuid: result.id })
      .eq("id", draftId);

    return { draftId, platform: "meta" as const, ...result };
  }

  const tiktokPayload = buildTikTokDraftPayload(input.answers, input.generated);
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      user_id: input.userId,
      name: tiktokPayload.name,
      objective: tiktokPayload.objective,
      budget: tiktokPayload.budget,
      budget_mode: tiktokPayload.budget_mode,
      start_date: tiktokPayload.start_date,
      end_date: tiktokPayload.end_date,
      targeting: tiktokPayload.targeting,
      creative: { ...tiktokPayload.creative, media_urls: input.creativeUrls },
      lead_form: tiktokPayload.lead_form,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("draft_campaigns")
    .update({ status: "launched", tiktok_campaign_uuid: campaign.id })
    .eq("id", draftId);

  return { draftId, platform: "tiktok" as const, id: campaign.id, status: "draft" };
}

export async function resolvePlatformForUser(userId: string): Promise<"meta" | "tiktok" | null> {
  const { data: metaConn } = await supabaseAdmin
    .from("meta_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "meta")
    .maybeSingle();

  if (metaConn) return "meta";
  return "tiktok";
}
