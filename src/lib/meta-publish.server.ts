/**
 * Server-only Meta Marketing API publish helpers.
 */
import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

export const COUNTRY_CODES: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  "Canada": "CA",
  "Australia": "AU",
  "Germany": "DE",
  "France": "FR",
  "Brazil": "BR",
  "Mexico": "MX",
  "Japan": "JP",
  "India": "IN",
};

const CTA_MAP: Record<string, string> = {
  "Learn More": "LEARN_MORE",
  "Sign Up": "SIGN_UP",
  "Shop Now": "SHOP_NOW",
  "Download": "DOWNLOAD",
  "Apply Now": "APPLY_NOW",
  "Book Now": "BOOK_TRAVEL",
};

const LEAD_FIELD_MAP: Record<string, string> = {
  Name: "FULL_NAME",
  Email: "EMAIL",
  Phone: "PHONE",
  City: "CITY",
  "Zip Code": "ZIP",
  Company: "COMPANY_NAME",
  "Job Title": "JOB_TITLE",
};

async function metaPOST(path: string, accessToken: string, body: Record<string, unknown>) {
  const url = `${GRAPH}/${metaApiVersion()}${path}`;
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    form.append(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  form.append("access_token", accessToken);
  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.error_user_msg || json?.error?.message || `Meta ${path} failed`;
    throw new Error(`${msg} (${res.status})`);
  }
  return json;
}

export async function createLeadForm(
  pageId: string,
  pageAccessToken: string,
  spec: {
    name: string;
    intro?: string;
    fields: string[];
    privacy_url: string;
    follow_up_url?: string;
    custom_questions?: string[];
  },
) {
  const questions: Array<Record<string, unknown>> = spec.fields
    .map((f) => LEAD_FIELD_MAP[f])
    .filter(Boolean)
    .map((type) => ({ type }));
  for (const q of spec.custom_questions ?? []) {
    const label = q.trim().slice(0, 200);
    if (!label) continue;
    questions.push({
      type: "CUSTOM",
      label,
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60) || `q_${questions.length}`,
    });
  }
  if (!questions.length) questions.push({ type: "PHONE" });

  return metaPOST(`/${pageId}/leadgen_forms`, pageAccessToken, {
    name: spec.name.slice(0, 256),
    questions,
    privacy_policy: { url: spec.privacy_url, link_text: "Privacy policy" },
    follow_up_action_url: spec.follow_up_url || spec.privacy_url,
    locale: "EN_US",
  });
}

export async function uploadAdImageFromBytes(
  adAccountId: string,
  accessToken: string,
  bytes: Uint8Array,
  filename = "ad.jpg",
  contentType = "image/jpeg",
) {
  const url = `${GRAPH}/${metaApiVersion()}/act_${adAccountId}/adimages?access_token=${encodeURIComponent(accessToken)}`;
  const form = new FormData();
  form.append("filename", new Blob([bytes as BlobPart], { type: contentType }), filename);
  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `adimages upload failed (${res.status})`);
  }
  // Response: { images: { [filename]: { hash, url } } }
  const first = Object.values(json.images ?? {})[0] as { hash: string };
  if (!first?.hash) throw new Error("Meta did not return an image hash");
  return first.hash;
}

export async function createCampaign(
  adAccountId: string,
  accessToken: string,
  name: string,
  status: "ACTIVE" | "PAUSED" = "ACTIVE",
) {
  return metaPOST(`/act_${adAccountId}/campaigns`, accessToken, {
    name,
    objective: "OUTCOME_LEADS",
    status,
    special_ad_categories: [],
    buying_type: "AUCTION",
    is_adset_budget_sharing_enabled: false,
  });
}

export async function createAdSet(
  adAccountId: string,
  accessToken: string,
  args: {
    name: string;
    campaign_id: string;
    daily_budget_cents?: number;
    lifetime_budget_cents?: number;
    end_time?: string | null;
    page_id: string;
    targeting: {
      countries: string[];
      age_min: number;
      age_max: number;
      genders?: number[];
    };
    status: "ACTIVE" | "PAUSED";
  },
) {
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: args.targeting.countries },
    age_min: args.targeting.age_min,
    age_max: args.targeting.age_max,
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed"],
  };
  if (args.targeting.genders && args.targeting.genders.length) {
    targeting.genders = args.targeting.genders;
  }
  const body: Record<string, unknown> = {
    name: args.name,
    campaign_id: args.campaign_id,
    optimization_goal: "LEAD_GENERATION",
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    promoted_object: { page_id: args.page_id },
    status: args.status,
    destination_type: "ON_AD",
  };
  if (args.daily_budget_cents) body.daily_budget = args.daily_budget_cents;
  if (args.lifetime_budget_cents) body.lifetime_budget = args.lifetime_budget_cents;
  if (args.end_time) body.end_time = args.end_time;
  // Lifetime budgets require start_time + end_time
  if (args.lifetime_budget_cents && args.end_time) {
    body.start_time = new Date().toISOString();
  }
  return metaPOST(`/act_${adAccountId}/adsets`, accessToken, body);
}

export async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  args: {
    name: string;
    page_id: string;
    image_hash: string;
    headline: string;
    description: string;
    cta: string;
    landing_url: string;
    lead_gen_form_id: string;
  },
) {
  const cta_type = CTA_MAP[args.cta] || "LEARN_MORE";
  return metaPOST(`/act_${adAccountId}/adcreatives`, accessToken, {
    name: args.name.slice(0, 200),
    object_story_spec: {
      page_id: args.page_id,
      link_data: {
        image_hash: args.image_hash,
        link: args.landing_url || `https://facebook.com/${args.page_id}`,
        message: args.description,
        name: args.headline,
        call_to_action: {
          type: cta_type,
          value: { lead_gen_form_id: args.lead_gen_form_id },
        },
      },
    },
    degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: "OPT_OUT" } } },
  });
}

export async function createAd(
  adAccountId: string,
  accessToken: string,
  args: { name: string; adset_id: string; creative_id: string; status: "ACTIVE" | "PAUSED" },
) {
  return metaPOST(`/act_${adAccountId}/ads`, accessToken, {
    name: args.name.slice(0, 200),
    adset_id: args.adset_id,
    creative: { creative_id: args.creative_id },
    status: args.status,
  });
}

export function mapAgeGroupsToRange(ageGroups: string[]): { age_min: number; age_max: number } {
  if (!ageGroups.length) return { age_min: 18, age_max: 65 };
  const ranges = ageGroups
    .map((g) => {
      const m = g.match(/^(\d+)(?:-(\d+)|\+)$/);
      if (!m) return null;
      const min = parseInt(m[1], 10);
      const max = m[2] ? parseInt(m[2], 10) : 65;
      return [min, max] as [number, number];
    })
    .filter(Boolean) as [number, number][];
  if (!ranges.length) return { age_min: 18, age_max: 65 };
  const age_min = Math.max(13, Math.min(...ranges.map((r) => r[0])));
  const age_max = Math.min(65, Math.max(...ranges.map((r) => r[1])));
  return { age_min, age_max };
}

export function mapGendersToMeta(genders: string[]): number[] {
  if (!genders.length || genders.includes("All")) return [];
  const out: number[] = [];
  if (genders.includes("Male")) out.push(1);
  if (genders.includes("Female")) out.push(2);
  return out;
}

export function mapLocationsToCountries(locations: string[]): string[] {
  const codes = locations.map((l) => COUNTRY_CODES[l]).filter(Boolean);
  return codes.length ? codes : ["US"];
}