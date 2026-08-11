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
  "Call Now": "CALL_NOW",
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
    const step = path.includes("/adsets")
      ? "ad set"
      : path.includes("/campaigns")
        ? "campanie"
        : path.includes("/adcreatives")
          ? "creative"
          : path.includes("/ads")
            ? "ad"
            : path.includes("leadgen_forms")
              ? "formular lead"
              : path;
    throw new Error(`${msg} (${res.status}) [pas: ${step}]`);
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
    custom_questions?: Array<
      | string
      | {
          label: string;
          /** "short" = răspuns text scurt; "choice" = grilă cu opțiuni */
          type?: "short" | "choice";
          options?: string[];
        }
    >;
  },
) {
  const formName = spec.name.slice(0, 256);
  // Reuse existing form with same name (Meta enforces unique names per page)
  try {
    const listUrl = `${GRAPH}/${metaApiVersion()}/${pageId}/leadgen_forms?fields=id,name&limit=200&access_token=${encodeURIComponent(pageAccessToken)}`;
    const listRes = await fetch(listUrl);
    const listJson = await listRes.json();
    if (listRes.ok && Array.isArray(listJson.data)) {
      const existing = listJson.data.find((f: { id: string; name: string }) => f.name === formName);
      if (existing?.id) return { id: existing.id, name: existing.name, reused: true };
    }
  } catch {
    // fall through to create
  }

  const questions: Array<Record<string, unknown>> = spec.fields
    .map((f) => LEAD_FIELD_MAP[f])
    .filter(Boolean)
    .map((type) => ({ type }));
  for (const raw of spec.custom_questions ?? []) {
    const q = typeof raw === "string" ? { label: raw, type: "short" as const } : raw;
    const label = (q.label ?? "").trim().slice(0, 200);
    if (!label) continue;
    const key =
      label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60) ||
      `q_${questions.length}`;
    const entry: Record<string, unknown> = { type: "CUSTOM", label, key };
    if (q.type === "choice" && Array.isArray(q.options) && q.options.length) {
      entry.options = q.options
        .map((o, idx) => ({
          key: `option_${idx + 1}`,
          value: String(o).trim().slice(0, 60),
        }))
        .filter((o) => o.value);
    }
    questions.push(entry);
  }
  if (!questions.length) questions.push({ type: "PHONE" });

  try {
    return await metaPOST(`/${pageId}/leadgen_forms`, pageAccessToken, {
      name: formName,
      questions,
      privacy_policy: { url: spec.privacy_url, link_text: "Privacy policy" },
      follow_up_action_url: spec.follow_up_url || spec.privacy_url,
      locale: "EN_US",
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    console.error("createLeadForm failed", { pageId, msg });
    if (/pages_manage_ads|\(#200\)/i.test(msg)) {
      throw new Error(
        "Lipsește permisiunea pages_manage_ads (face parte din Marketing API). " +
          "Reconectează contul Meta din Setări și acceptă toate permisiunile, sau lansează campanii fără formular de lead (trafic / Click-to-WhatsApp).",
      );
    }
    if (/permission|OAuth|\(#10\)/i.test(msg)) {
      throw new Error(`Meta a refuzat crearea formularului de lead pentru pagina ${pageId}: ${msg}`);
    }
    throw e;
  }
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

/** Upload a video to Meta ad account, wait briefly for processing, return { video_id, thumbnail_url }. */
export async function uploadAdVideoFromBytes(
  adAccountId: string,
  accessToken: string,
  bytes: Uint8Array,
  filename = "ad.mp4",
  contentType = "video/mp4",
): Promise<{ video_id: string; thumbnail_url: string | null }> {
  const upUrl = `${GRAPH}/${metaApiVersion()}/act_${adAccountId}/advideos?access_token=${encodeURIComponent(accessToken)}`;
  const form = new FormData();
  form.append("source", new Blob([bytes as BlobPart], { type: contentType }), filename);
  const upRes = await fetch(upUrl, { method: "POST", body: form });
  const upJson = await upRes.json();
  if (!upRes.ok || !upJson.id) {
    throw new Error(upJson?.error?.message || `advideos upload failed (${upRes.status})`);
  }
  const video_id: string = upJson.id;

  // Poll processing status up to ~60s
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `${GRAPH}/${metaApiVersion()}/${video_id}?fields=status&access_token=${encodeURIComponent(accessToken)}`,
    );
    const statusJson = await statusRes.json();
    const phase = statusJson?.status?.video_status;
    if (phase === "ready") break;
    if (phase === "error") throw new Error("Meta video processing failed");
  }

  // Fetch a thumbnail (preferred one if present)
  let thumbnail_url: string | null = null;
  try {
    const thRes = await fetch(
      `${GRAPH}/${metaApiVersion()}/${video_id}/thumbnails?access_token=${encodeURIComponent(accessToken)}`,
    );
    const thJson = await thRes.json();
    const thumbs: any[] = Array.isArray(thJson?.data) ? thJson.data : [];
    const preferred = thumbs.find((t) => t.is_preferred) ?? thumbs[0];
    thumbnail_url = preferred?.uri ?? null;
  } catch {
    /* ignore */
  }
  return { video_id, thumbnail_url };
}

export async function createCampaign(
  adAccountId: string,
  accessToken: string,
  name: string,
  status: "ACTIVE" | "PAUSED" = "ACTIVE",
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" = "OUTCOME_LEADS",
) {
  return metaPOST(`/act_${adAccountId}/campaigns`, accessToken, {
    name,
    objective,
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
      cities?: Array<{ key: string; radius?: number; distance_unit?: "kilometer" | "mile" }>;
    };
    status: "ACTIVE" | "PAUSED";
    objective?: "leads" | "traffic" | "bookings";
    pixel_id?: string;
    dsa_beneficiary?: string;
    dsa_payor?: string;
  },
) {
  const geo_locations: Record<string, unknown> = {};
  if (args.targeting.cities && args.targeting.cities.length) {
    geo_locations.cities = args.targeting.cities.map((c) => ({
      key: c.key,
      radius: c.radius ?? 25,
      distance_unit: c.distance_unit ?? "kilometer",
    }));
  } else {
    geo_locations.countries = args.targeting.countries;
  }
  const targeting: Record<string, unknown> = {
    geo_locations,
    age_min: args.targeting.age_min,
    age_max: args.targeting.age_max,
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed"],
    targeting_automation: { advantage_audience: 0 },
  };
  if (args.targeting.genders && args.targeting.genders.length) {
    targeting.genders = args.targeting.genders;
  }
  const optimization_goal =
    args.objective === "traffic"
      ? "LINK_CLICKS"
      : args.objective === "bookings"
        ? "OFFSITE_CONVERSIONS"
        : "LEAD_GENERATION";
  const body: Record<string, unknown> = {
    name: args.name,
    campaign_id: args.campaign_id,
    optimization_goal,
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    status: args.status,
    destination_type: args.objective === "leads" ? "ON_AD" : "WEBSITE",
  };
  if (args.objective === "bookings") {
    // Optimizare pe programări reale (eveniment Schedule trimis prin CAPI)
    if (!args.pixel_id) throw new Error("Lipsește pixelul Meta pentru campania de programări.");
    body.promoted_object = { pixel_id: args.pixel_id, custom_event_type: "SCHEDULE" };
  } else if (args.objective !== "traffic") {
    body.promoted_object = { page_id: args.page_id };
  }
  // EU DSA: în funcție de versiunea API, Meta acceptă `beneficiary`/`payer`
  // sau `dsa_beneficiary`/`dsa_payor`. Le trimitem pe ambele ca să nu mai
  // ceară niciodată completare manuală în Pagină.
  if (args.dsa_beneficiary) {
    const payor = args.dsa_payor || args.dsa_beneficiary;
    body.beneficiary = args.dsa_beneficiary;
    body.payer = payor;
    body.dsa_beneficiary = args.dsa_beneficiary;
    body.dsa_payor = payor;
  }
  if (args.daily_budget_cents) body.daily_budget = args.daily_budget_cents;
  if (args.lifetime_budget_cents) body.lifetime_budget = args.lifetime_budget_cents;
  if (args.end_time) body.end_time = args.end_time;
  // Lifetime budgets require start_time + end_time
  if (args.lifetime_budget_cents && args.end_time) {
    body.start_time = new Date().toISOString();
  }
  return metaPOST(`/act_${adAccountId}/adsets`, accessToken, body);
}

/** Numele Paginii Facebook — folosit ca beneficiar/plătitor DSA. */
export async function fetchPageName(pageId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${metaApiVersion()}/${pageId}?fields=name&access_token=${encodeURIComponent(accessToken)}`,
    );
    const json = await res.json();
    if (!res.ok || !json?.name) return null;
    return String(json.name);
  } catch {
    return null;
  }
}

/** Contul Instagram legat de Pagina Facebook — ca reclama să ruleze și pe Instagram. */
export async function fetchPageInstagramId(pageId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${metaApiVersion()}/${pageId}?fields=instagram_business_account,connected_instagram_account&access_token=${encodeURIComponent(accessToken)}`,
    );
    const json = await res.json();
    if (!res.ok) return null;
    const id = json?.instagram_business_account?.id ?? json?.connected_instagram_account?.id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

/** Search Meta's targeting database for a city by free-text name. Returns the first match. */

export async function findCityKey(
  accessToken: string,
  query: string,
  countryCode?: string,
): Promise<{ key: string; name: string; country_code: string } | null> {
  const params = new URLSearchParams({
    location_types: JSON.stringify(["city"]),
    type: "adgeolocation",
    q: query,
    limit: "10",
    access_token: accessToken,
  });
  if (countryCode) params.set("country_code", countryCode);
  const res = await fetch(`${GRAPH}/${metaApiVersion()}/search?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !Array.isArray(json.data) || !json.data.length) return null;
  const preferred = countryCode
    ? json.data.find((c: any) => c.country_code === countryCode) ?? json.data[0]
    : json.data[0];
  return { key: String(preferred.key), name: preferred.name, country_code: preferred.country_code };
}

export async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  args: {
    name: string;
    page_id: string;
    image_hash?: string;
    video_id?: string;
    thumbnail_url?: string | null;
    headline: string;
    description: string;
    cta: string;
    landing_url: string;
    lead_gen_form_id?: string;
    instagram_user_id?: string | null;
  },
) {
  const cta_type = CTA_MAP[args.cta] || "LEARN_MORE";
  const isTel = args.landing_url && /^tel:/i.test(args.landing_url);
  const isHttp = args.landing_url && /^https?:\/\//i.test(args.landing_url) && !/facebook\.com/i.test(args.landing_url);
  const link = isTel || isHttp ? args.landing_url : "https://adpilot.ro";
  const call_to_action: Record<string, unknown> = { type: cta_type };
  if (args.lead_gen_form_id) {
    call_to_action.value = { lead_gen_form_id: args.lead_gen_form_id };
  } else {
    call_to_action.value = { link };
  }
  if (args.video_id) {
    const video_data: Record<string, unknown> = {
      video_id: args.video_id,
      title: args.headline,
      message: args.description,
      call_to_action,
    };
    if (args.thumbnail_url) video_data.image_url = args.thumbnail_url;
    return metaPOST(`/act_${adAccountId}/adcreatives`, accessToken, {
      name: args.name.slice(0, 200),
      object_story_spec: {
        page_id: args.page_id,
        ...(args.instagram_user_id ? { instagram_user_id: args.instagram_user_id } : {}),
        video_data,
      },
    });
  }
  if (!args.image_hash) {
    throw new Error("createAdCreative needs image_hash or video_id");
  }
  return metaPOST(`/act_${adAccountId}/adcreatives`, accessToken, {
    name: args.name.slice(0, 200),
    object_story_spec: {
      page_id: args.page_id,
      ...(args.instagram_user_id ? { instagram_user_id: args.instagram_user_id } : {}),
      link_data: {
        image_hash: args.image_hash,
        link,
        message: args.description,
        name: args.headline,
        call_to_action,
      },
    },
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