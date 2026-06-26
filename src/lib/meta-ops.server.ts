/**
 * Extra Meta Marketing API helpers for the WhatsApp agent's advanced tools:
 *  - duplicate campaign (with optional new copy)
 *  - A/B test creative inside an existing adset
 *  - change targeting (age, cities, genders) on an existing adset
 *  - blacklist placements (drop Audience Network / Stories / etc.)
 *  - fetch last Meta invoice / transactions
 */
import { metaApiVersion } from "./meta.server";
import {
  createAd,
  createAdCreative,
  createAdSet,
  createCampaign,
  findCityKey,
  uploadAdImageFromBytes,
  uploadAdVideoFromBytes,
} from "./meta-publish.server";

const GRAPH = "https://graph.facebook.com";

async function metaGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}/${metaApiVersion()}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  const r = await fetch(url.toString());
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `${path} ${r.status}`);
  return j;
}

async function metaPost(path: string, accessToken: string, body: Record<string, unknown>) {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v == null) continue;
    form.append(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  form.append("access_token", accessToken);
  const r = await fetch(`${GRAPH}/${metaApiVersion()}${path}`, {
    method: "POST",
    body: form,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `${path} ${r.status}`);
  return j;
}

/** Returns adset details we need to clone/edit (targeting + budget). */
async function getAdSet(adsetId: string, accessToken: string) {
  return metaGet(`/${adsetId}`, accessToken, {
    fields:
      "id,name,daily_budget,lifetime_budget,billing_event,optimization_goal,targeting,destination_type,promoted_object,status",
  });
}

/** Read one creative so we can rebuild it with new copy. */
async function getCreative(creativeId: string, accessToken: string) {
  return metaGet(`/${creativeId}`, accessToken, {
    fields:
      "id,name,object_story_spec,image_hash,video_id,thumbnail_url,call_to_action_type",
  });
}

/** PATCH targeting on an existing adset. */
export async function patchAdSetTargeting(
  adsetId: string,
  accessToken: string,
  patch: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    cities?: Array<{ key: string; radius?: number }>;
    countries?: string[];
    publisher_platforms?: string[];
    facebook_positions?: string[];
    instagram_positions?: string[];
    audience_network_positions?: string[];
  },
) {
  const current = await getAdSet(adsetId, accessToken);
  const targeting = { ...(current.targeting ?? {}) };
  if (patch.age_min != null) targeting.age_min = patch.age_min;
  if (patch.age_max != null) targeting.age_max = patch.age_max;
  if (patch.genders != null) targeting.genders = patch.genders;
  if (patch.cities && patch.cities.length) {
    targeting.geo_locations = {
      ...(targeting.geo_locations ?? {}),
      cities: patch.cities.map((c) => ({
        key: c.key,
        radius: c.radius ?? 25,
        distance_unit: "kilometer",
      })),
    };
    delete targeting.geo_locations.countries;
  } else if (patch.countries && patch.countries.length) {
    targeting.geo_locations = { countries: patch.countries };
  }
  if (patch.publisher_platforms) targeting.publisher_platforms = patch.publisher_platforms;
  if (patch.facebook_positions) targeting.facebook_positions = patch.facebook_positions;
  if (patch.instagram_positions) targeting.instagram_positions = patch.instagram_positions;
  if (patch.audience_network_positions)
    targeting.audience_network_positions = patch.audience_network_positions;
  return metaPost(`/${adsetId}`, accessToken, { targeting });
}

/** Remove a placement family entirely (e.g. "audience_network", "messenger", "stories"). */
export async function blacklistPlacement(
  adsetId: string,
  accessToken: string,
  exclude: Array<"audience_network" | "messenger" | "stories" | "reels" | "right_column">,
) {
  const current = await getAdSet(adsetId, accessToken);
  const t = { ...(current.targeting ?? {}) };
  const platforms: string[] = Array.isArray(t.publisher_platforms)
    ? [...t.publisher_platforms]
    : ["facebook", "instagram", "audience_network", "messenger"];
  const fbPos: string[] = Array.isArray(t.facebook_positions)
    ? [...t.facebook_positions]
    : ["feed", "story", "video_feeds", "marketplace"];
  const igPos: string[] = Array.isArray(t.instagram_positions)
    ? [...t.instagram_positions]
    : ["stream", "story", "reels", "explore"];

  const updates: Record<string, unknown> = {};

  if (exclude.includes("audience_network")) {
    updates.publisher_platforms = platforms.filter((p) => p !== "audience_network");
  }
  if (exclude.includes("messenger")) {
    updates.publisher_platforms = (
      (updates.publisher_platforms as string[]) ?? platforms
    ).filter((p) => p !== "messenger");
  }
  if (exclude.includes("stories")) {
    updates.facebook_positions = fbPos.filter((p) => p !== "story");
    updates.instagram_positions = igPos.filter((p) => p !== "story");
  }
  if (exclude.includes("reels")) {
    updates.instagram_positions = (
      (updates.instagram_positions as string[]) ?? igPos
    ).filter((p) => p !== "reels");
  }
  if (exclude.includes("right_column")) {
    updates.facebook_positions = (
      (updates.facebook_positions as string[]) ?? fbPos
    ).filter((p) => p !== "right_column");
  }

  return patchAdSetTargeting(adsetId, accessToken, updates as any);
}

/**
 * Duplicate an existing campaign — same audience and budget, optional new copy.
 * Starts PAUSED so the user can review before going live.
 */
export async function duplicateCampaign(opts: {
  adAccountId: string;
  accessToken: string;
  sourceMetaCampaignId: string;
  sourceMetaAdsetId: string;
  sourceMetaAdId: string;
  pageId: string;
  newName: string;
  newCopy?: { headline?: string; primary_text?: string; description?: string };
}) {
  // Pull current campaign for objective
  const camp = await metaGet(`/${opts.sourceMetaCampaignId}`, opts.accessToken, {
    fields: "id,name,objective",
  });
  const objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" =
    camp.objective === "OUTCOME_TRAFFIC" ? "OUTCOME_TRAFFIC" : "OUTCOME_LEADS";

  // Source adset
  const srcAdset = await getAdSet(opts.sourceMetaAdsetId, opts.accessToken);
  const dailyCents = Number(srcAdset.daily_budget ?? 0) || undefined;
  const targeting = srcAdset.targeting ?? {};

  // Source ad → creative
  const srcAd = await metaGet(`/${opts.sourceMetaAdId}`, opts.accessToken, {
    fields: "creative{id}",
  });
  const srcCreativeId = srcAd?.creative?.id;
  const srcCreative = srcCreativeId ? await getCreative(srcCreativeId, opts.accessToken) : null;
  const oss = srcCreative?.object_story_spec ?? {};
  const linkData = oss.link_data ?? {};
  const videoData = oss.video_data ?? {};
  const cta = linkData.call_to_action ?? videoData.call_to_action ?? { type: "LEARN_MORE" };
  const leadFormId =
    cta?.value?.lead_gen_form_id ?? linkData?.call_to_action?.value?.lead_gen_form_id;

  // 1. New campaign (PAUSED)
  const newCamp = await createCampaign(
    opts.adAccountId,
    opts.accessToken,
    opts.newName,
    "PAUSED",
    objective,
  );

  // 2. New adset (clone)
  const newAdsetBody: Record<string, unknown> = {
    name: `${opts.newName} — AdSet`,
    campaign_id: newCamp.id,
    optimization_goal: srcAdset.optimization_goal,
    billing_event: srcAdset.billing_event ?? "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    status: "PAUSED",
    destination_type: srcAdset.destination_type,
  };
  if (srcAdset.promoted_object) newAdsetBody.promoted_object = srcAdset.promoted_object;
  if (dailyCents) newAdsetBody.daily_budget = dailyCents;
  const newAdset = await metaPost(`/act_${opts.adAccountId}/adsets`, opts.accessToken, newAdsetBody);

  // 3. New creative (apply new copy if provided)
  const headline = opts.newCopy?.headline ?? linkData.name ?? videoData.title ?? opts.newName;
  const message = opts.newCopy?.primary_text ?? linkData.message ?? videoData.message ?? "";
  const description = opts.newCopy?.description ?? linkData.description;
  let creativeBody: Record<string, unknown>;
  if (videoData.video_id) {
    creativeBody = {
      name: `${opts.newName} — Creative`,
      object_story_spec: {
        page_id: opts.pageId,
        video_data: {
          video_id: videoData.video_id,
          title: headline,
          message,
          ...(videoData.image_url ? { image_url: videoData.image_url } : {}),
          call_to_action: cta,
        },
      },
    };
  } else {
    creativeBody = {
      name: `${opts.newName} — Creative`,
      object_story_spec: {
        page_id: opts.pageId,
        link_data: {
          image_hash: linkData.image_hash,
          link: linkData.link ?? "https://adpilot.ro",
          message,
          name: headline,
          ...(description ? { description } : {}),
          call_to_action: cta,
        },
      },
    };
  }
  const newCreative = await metaPost(
    `/act_${opts.adAccountId}/adcreatives`,
    opts.accessToken,
    creativeBody,
  );

  // 4. New ad
  const newAd = await createAd(opts.adAccountId, opts.accessToken, {
    name: `${opts.newName} — Ad`,
    adset_id: newAdset.id,
    creative_id: newCreative.id,
    status: "PAUSED",
  });

  return {
    campaign_id: newCamp.id,
    adset_id: newAdset.id,
    ad_id: newAd.id,
    lead_form_id: leadFormId ?? null,
    status: "PAUSED",
  };
}

/**
 * Add a second ad ("B") inside the same adset, using a different image/video.
 * Returns the new ad id. Caller already uploaded the new media (image_hash or video_id).
 */
export async function createAbTestAd(opts: {
  adAccountId: string;
  accessToken: string;
  pageId: string;
  adsetId: string;
  headline: string;
  primary_text: string;
  cta: string;
  landing_url: string;
  image_hash?: string;
  video_id?: string;
  thumbnail_url?: string | null;
  lead_gen_form_id?: string | null;
  variant: "A" | "B";
}) {
  const cta_map: Record<string, string> = {
    "Learn More": "LEARN_MORE",
    "Sign Up": "SIGN_UP",
    "Shop Now": "SHOP_NOW",
    Download: "DOWNLOAD",
    "Apply Now": "APPLY_NOW",
    "Book Now": "BOOK_TRAVEL",
  };
  const callToAction: Record<string, unknown> = {
    type: cta_map[opts.cta] || "LEARN_MORE",
    value: opts.lead_gen_form_id
      ? { lead_gen_form_id: opts.lead_gen_form_id }
      : { link: opts.landing_url },
  };
  const name = `Variant ${opts.variant}`;
  let creativeBody: Record<string, unknown>;
  if (opts.video_id) {
    creativeBody = {
      name,
      object_story_spec: {
        page_id: opts.pageId,
        video_data: {
          video_id: opts.video_id,
          title: opts.headline,
          message: opts.primary_text,
          ...(opts.thumbnail_url ? { image_url: opts.thumbnail_url } : {}),
          call_to_action: callToAction,
        },
      },
    };
  } else {
    creativeBody = {
      name,
      object_story_spec: {
        page_id: opts.pageId,
        link_data: {
          image_hash: opts.image_hash,
          link: opts.landing_url,
          message: opts.primary_text,
          name: opts.headline,
          call_to_action: callToAction,
        },
      },
    };
  }
  const cr = await metaPost(
    `/act_${opts.adAccountId}/adcreatives`,
    opts.accessToken,
    creativeBody,
  );
  const ad = await createAd(opts.adAccountId, opts.accessToken, {
    name,
    adset_id: opts.adsetId,
    creative_id: cr.id,
    status: "ACTIVE",
  });
  return { ad_id: ad.id, creative_id: cr.id, variant: opts.variant };
}

/** Fetch last invoice / transactions for an ad account. */
export async function getMetaInvoices(adAccountId: string, accessToken: string, months = 1) {
  const j = await metaGet(`/act_${adAccountId}/transactions`, accessToken, {
    limit: "20",
    fields: "id,billing_period_start_time,billing_period_end_time,amount,vat,billing_reason,product_type,status,download_url",
  });
  const since = Date.now() - months * 31 * 24 * 60 * 60 * 1000;
  const all: any[] = Array.isArray(j?.data) ? j.data : [];
  const recent = all.filter((t) => {
    const d = t.billing_period_end_time ? new Date(t.billing_period_end_time).getTime() : 0;
    return d >= since;
  });
  return { invoices: recent.length ? recent : all.slice(0, 3) };
}

// Re-export so the agent can import everything from one place if needed.
export {
  uploadAdImageFromBytes,
  uploadAdVideoFromBytes,
  createAdSet,
  createAdCreative,
  createAd,
  findCityKey,
};
