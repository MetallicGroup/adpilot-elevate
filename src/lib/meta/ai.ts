import type { MetaBusinessDetails, MetaGeneratedContent } from "./types";

const COUNTRY_MAP: Record<string, string> = {
  "united states": "US",
  usa: "US",
  us: "US",
  "united kingdom": "GB",
  uk: "GB",
  canada: "CA",
  australia: "AU",
  germany: "DE",
  france: "FR",
  brazil: "BR",
  mexico: "MX",
  japan: "JP",
  india: "IN",
  romania: "RO",
};

function resolveCountryCode(location: string): string {
  const key = location.trim().toLowerCase();
  if (COUNTRY_MAP[key]) return COUNTRY_MAP[key];
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (key.includes(name)) return code;
  }
  return "US";
}

/**
 * Generates campaign copy from business details.
 * TODO: Replace with LLM provider (OpenAI/Anthropic) when API key is configured.
 */
export function generateMetaCampaignContent(details: MetaBusinessDetails): MetaGeneratedContent {
  const country = resolveCountryCode(details.location);
  const product = details.service_product.trim() || "your offer";
  const business = details.business_name.trim() || "your business";
  const audience = details.target_audience.trim() || "people in your area";

  return {
    campaign_name: `${business} — Lead Gen`,
    primary_text: `Looking for ${product}? ${business} helps ${audience} get started today. Leave your details and we'll reach out within 24 hours.`,
    headline: `Discover ${product} with ${business}`,
    description: `Trusted by customers in ${details.location || "your area"}. Simple sign-up, no obligation.`,
    call_to_action: "SIGN_UP",
    lead_form_questions: ["FULL_NAME", "EMAIL", "PHONE"],
    targeting_suggestion: {
      countries: [country],
      age_min: 18,
      age_max: 65,
    },
  };
}
