import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MetaApiError, metaGraphRequest } from "./client";
import { getMetaAccessToken } from "./oauth";
import { leadFieldsToMetaQuestions } from "@/lib/launcher/technical-mapper";
import type { MetaCampaignLaunchInput } from "./types";
import type { LeadFieldConfig } from "@/lib/launcher/types";

type IdResponse = { id: string };
type PagesResponse = { data: Array<{ id: string; name: string; access_token?: string }> };

const CTA_MAP: Record<string, string> = {
  SIGN_UP: "SIGN_UP",
  LEARN_MORE: "LEARN_MORE",
  "Sign Up": "SIGN_UP",
  "Learn More": "LEARN_MORE",
};

function mapLeadQuestion(field: string): { type: string; key: string; label?: string } {
  const normalized = field.toUpperCase().replace(/\s+/g, "_");
  if (normalized.includes("EMAIL")) return { type: "EMAIL", key: "email" };
  if (normalized.includes("PHONE")) return { type: "PHONE", key: "phone" };
  if (normalized.includes("FULL_NAME") || normalized === "NAME") return { type: "FULL_NAME", key: "full_name" };
  return { type: "CUSTOM", key: normalized.toLowerCase(), label: field };
}

export async function fetchMetaPages(userId: string) {
  const token = await getMetaAccessToken(userId);
  const result = await metaGraphRequest<PagesResponse>("/me/accounts", {
    accessToken: token,
    body: { fields: "id,name,access_token", limit: "50" },
  });
  return (result.data ?? []).map((p) => ({ id: p.id, name: p.name }));
}

export async function createMetaLeadCampaign(userId: string, input: MetaCampaignLaunchInput) {
  const token = await getMetaAccessToken(userId);

  const { data: adAccount, error: acctError } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("id, ad_account_id, account_name")
    .eq("id", input.ad_account_uuid)
    .eq("user_id", userId)
    .maybeSingle();

  if (acctError) throw new Error(acctError.message);
  if (!adAccount) throw new Error("Ad account not found");

  const pages = await fetchMetaPages(userId);
  const page = pages.find((p) => p.id === input.page_id);
  if (!page) {
    throw new MetaApiError(
      "To launch Meta Lead Ads, connect a Facebook Page linked to your Business Manager.",
    );
  }

  const actId = adAccount.ad_account_id.startsWith("act_")
    ? adAccount.ad_account_id
    : `act_${adAccount.ad_account_id}`;

  const status = input.launch_active ? "ACTIVE" : "PAUSED";
  const dailyBudgetCents = Math.round(input.business_details.daily_budget * 100);
  const ctaType = CTA_MAP[input.generated.call_to_action] ?? "SIGN_UP";

  const campaign = await metaGraphRequest<IdResponse>(`/${actId}/campaigns`, {
    method: "POST",
    accessToken: token,
    body: {
      name: input.generated.campaign_name,
      objective: "OUTCOME_LEADS",
      status,
      special_ad_categories: [],
    },
  });

  const targeting = input.generated.targeting_suggestion;
  const adSet = await metaGraphRequest<IdResponse>(`/${actId}/adsets`, {
    method: "POST",
    accessToken: token,
    body: {
      name: `${input.generated.campaign_name} — Ad Set`,
      campaign_id: campaign.id,
      daily_budget: dailyBudgetCents,
      billing_event: "IMPRESSIONS",
      optimization_goal: "LEAD_GENERATION",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: {
        geo_locations: { countries: targeting.countries },
        age_min: targeting.age_min,
        age_max: targeting.age_max,
      },
      promoted_object: { page_id: input.page_id },
      status,
    },
  });

  const questions = input.lead_fields?.length
    ? leadFieldsToMetaQuestions(input.lead_fields as LeadFieldConfig[])
    : input.generated.lead_form_questions.map(mapLeadQuestion);
  const leadForm = await metaGraphRequest<IdResponse>(`/${input.page_id}/leadgen_forms`, {
    method: "POST",
    accessToken: token,
    body: {
      name: `${input.generated.campaign_name} — Form`,
      questions,
      privacy_policy: { url: input.privacy_policy_url },
      follow_up_action_url: input.business_details.website || undefined,
      locale: "ro_RO",
    },
  });

  // TODO: Upload image/video from input.creative_urls to Meta Ad Library and set image_hash.
  // Creative URLs stored in draft_campaigns for reference until upload is implemented.
  const creative = await metaGraphRequest<IdResponse>(`/${actId}/adcreatives`, {
    method: "POST",
    accessToken: token,
    body: {
      name: `${input.generated.campaign_name} — Creative`,
      object_story_spec: {
        page_id: input.page_id,
        link_data: {
          message: input.generated.primary_text,
          name: input.generated.headline,
          description: input.generated.description,
          call_to_action: {
            type: ctaType,
            value: { lead_gen_form_id: leadForm.id },
          },
        },
      },
    },
  });

  const ad = await metaGraphRequest<IdResponse>(`/${actId}/ads`, {
    method: "POST",
    accessToken: token,
    body: {
      name: `${input.generated.campaign_name} — Ad`,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status,
    },
  });

  const { data: row, error: insertError } = await supabaseAdmin
    .from("meta_campaigns")
    .insert({
      user_id: userId,
      ad_account_id: adAccount.id,
      meta_campaign_id: campaign.id,
      meta_adset_id: adSet.id,
      meta_ad_id: ad.id,
      meta_form_id: leadForm.id,
      page_id: input.page_id,
      campaign_name: input.generated.campaign_name,
      objective: "OUTCOME_LEADS",
      daily_budget: input.business_details.daily_budget,
      status,
      business_details: input.business_details,
      creative: input.generated,
      targeting: targeting,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  return {
    id: row.id,
    meta_campaign_id: campaign.id,
    meta_adset_id: adSet.id,
    meta_ad_id: ad.id,
    meta_form_id: leadForm.id,
    status,
  };
}
