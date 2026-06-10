import type { GeneratedAdCopy, LauncherSimpleAnswers, TechnicalCampaignConfig, LeadFieldConfig } from "./types";

export function mapToTechnicalConfig(
  answers: LauncherSimpleAnswers,
  generated: GeneratedAdCopy,
  platform: "meta" | "tiktok",
): TechnicalCampaignConfig {
  const base: TechnicalCampaignConfig = {};

  if (platform === "meta") {
    base.meta = {
      objective: "OUTCOME_LEADS",
      optimization_goal: "LEAD_GENERATION",
      billing_event: "IMPRESSIONS",
      destination: "instant_form",
      status: "PAUSED",
    };
  }

  if (platform === "tiktok") {
    base.tiktok = {
      objective: "LEAD_GENERATION",
      budget_mode: "BUDGET_MODE_DAY",
      status: "draft",
    };
  }

  return base;
}

export function leadFieldsToMetaQuestions(fields: LeadFieldConfig[]) {
  return fields.map((f) => {
    switch (f.key) {
      case "full_name":
        return { type: "FULL_NAME", key: "full_name" };
      case "phone":
        return { type: "PHONE", key: "phone" };
      case "email":
        return { type: "EMAIL", key: "email" };
      case "service_interest":
        return { type: "CUSTOM", key: "service", label: f.customQuestion || f.label };
      case "preferred_date":
        return { type: "CUSTOM", key: "preferred_date", label: f.customQuestion || "Data preferată" };
      case "preferred_time":
        return { type: "CUSTOM", key: "preferred_time", label: f.customQuestion || "Ora preferată" };
      case "budget":
        return { type: "CUSTOM", key: "budget", label: f.customQuestion || "Buget estimativ" };
      case "company_name":
        return { type: "CUSTOM", key: "company", label: f.customQuestion || "Nume companie" };
      case "address":
        return { type: "CUSTOM", key: "address", label: f.customQuestion || "Adresă / Zonă" };
      case "custom":
        return { type: "CUSTOM", key: "custom", label: f.customQuestion || f.label };
      default:
        return { type: "CUSTOM", key: f.key, label: f.label };
    }
  });
}

export function leadFieldsToTikTokFields(fields: LeadFieldConfig[]): string[] {
  return fields.map((f) => f.label);
}

export function mapCtaToMeta(cta: GeneratedAdCopy["call_to_action"]): "SIGN_UP" | "LEARN_MORE" {
  if (cta === "BOOK_NOW") return "SIGN_UP";
  return cta === "LEARN_MORE" ? "LEARN_MORE" : "SIGN_UP";
}

export function buildTikTokDraftPayload(answers: LauncherSimpleAnswers, generated: GeneratedAdCopy) {
  return {
    name: generated.campaign_name,
    objective: "LEAD_GENERATION" as const,
    budget: answers.daily_budget,
    budget_mode: "BUDGET_MODE_DAY" as const,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    targeting: {
      locations: [answers.city],
      age_groups: [`${generated.targeting_suggestion.age_min}-${generated.targeting_suggestion.age_max}`],
      genders: ["All"],
      interests: generated.targeting_suggestion.interests,
      languages: ["Romanian"],
      radius_km: answers.radius_km,
    },
    creative: {
      headline: generated.headline,
      description: generated.description,
      cta: generated.call_to_action === "BOOK_NOW" ? "Book Now" : "Sign Up",
      media_url: "",
      landing_url: answers.privacy_policy_url || "",
      primary_text: generated.primary_text,
    },
    lead_form: {
      title: generated.headline,
      intro: generated.description,
      fields: leadFieldsToTikTokFields(generated.lead_form_questions),
      privacy_url: answers.privacy_policy_url || "",
    },
    status: "draft" as const,
  };
}
