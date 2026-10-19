/**
 * TikTok Marketing API — crearea campaniilor de clienți potențiali (Upgraded Smart+).
 * Din 2027, /campaign/create/ & co. nu mai creează campanii Lead Generation, deci
 * folosim doar /smart_plus/*. Destinația e pagina AdPilot cu formular + pixel TikTok.
 *
 * Tokenul e al clientului (OAuth, din tiktok_connections) și nu iese niciodată din server.
 */
import { createHash, randomInt } from "node:crypto";

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

/** România (țară) în /tool/region/. Județele au id-uri proprii (nivel PROVINCE). */
export const TIKTOK_LOCATION_ROMANIA = "798549";

type TikTokEnvelope<T> = { code: number; message: string; data: T };

export class TikTokApiError extends Error {
  constructor(
    message: string,
    public code: number,
    public step: string,
  ) {
    super(message);
  }
}

async function ttRequest<T>(
  token: string,
  method: "GET" | "POST",
  path: string,
  params: Record<string, unknown>,
  step: string,
): Promise<T> {
  let url = `${TIKTOK_API}${path}`;
  const init: RequestInit = { method, headers: { "Access-Token": token } };
  if (method === "GET") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    url += `?${qs.toString()}`;
  } else {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(params);
  }
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as TikTokEnvelope<T> | null;
  if (!res.ok || !json || json.code !== 0) {
    throw new TikTokApiError(
      `TikTok: ${json?.message ?? `HTTP ${res.status}`} [pas: ${step}]`,
      json?.code ?? res.status,
      step,
    );
  }
  return json.data;
}

/** request_id pentru endpoint-urile Smart+: string cu un întreg pe 64 de biți (idempotență). */
function requestId(): string {
  return `${Date.now()}${randomInt(100000, 999999)}`;
}

/** UTC „YYYY-MM-DD HH:MM:SS”, formatul cerut de TikTok. */
function tiktokTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export type TikTokAdContext = { token: string; advertiserId: string; currency: string | null };

/** Contul de reclame TikTok activ al userului (sau null dacă nu e conectat). */
export async function getTikTokAdContext(
  supabaseAdmin: any,
  userId: string,
): Promise<TikTokAdContext | null> {
  const { data: conn } = await supabaseAdmin
    .from("tiktok_connections")
    .select("id, access_token")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!conn?.access_token) return null;
  const { data: adv } = await supabaseAdmin
    .from("tiktok_advertisers")
    .select("advertiser_id, currency")
    .eq("connection_id", conn.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!adv?.advertiser_id) return null;
  return { token: conn.access_token, advertiserId: adv.advertiser_id, currency: adv.currency ?? null };
}

/** Contul TikTok de pe care rulează reclama (Spark Ads: identitate TT_USER care poate primi video). */
export async function getPushIdentity(ctx: TikTokAdContext) {
  const data = await ttRequest<{ identity_list?: any[] }>(
    ctx.token,
    "GET",
    "/identity/get/",
    { advertiser_id: ctx.advertiserId, identity_type: "TT_USER" },
    "identitate",
  );
  const id = (data.identity_list ?? []).find(
    (i) => i.available_status === "AVAILABLE" && i.can_push_video,
  );
  return id
    ? { identityId: String(id.identity_id), identityType: "TT_USER" as const, name: id.display_name as string }
    : null;
}

/** Încarcă un video după URL public; întoarce video_id. */
export async function uploadVideoByUrl(ctx: TikTokAdContext, videoUrl: string, fileName: string) {
  const data = await ttRequest<any>(
    ctx.token,
    "POST",
    "/file/video/ad/upload/",
    {
      advertiser_id: ctx.advertiserId,
      upload_type: "UPLOAD_BY_URL",
      video_url: videoUrl,
      file_name: `${fileName.slice(0, 80)}-${Date.now()}`,
    },
    "încărcare video",
  );
  const item = Array.isArray(data) ? data[0] : data;
  const videoId = item?.video_id;
  if (!videoId) throw new TikTokApiError("TikTok nu a întors video_id.", -1, "încărcare video");
  return String(videoId);
}

/** Încarcă o imagine după URL public; întoarce image_id (folosit ca web_uri). */
export async function uploadImageByUrl(ctx: TikTokAdContext, imageUrl: string, fileName: string) {
  const data = await ttRequest<any>(
    ctx.token,
    "POST",
    "/file/image/ad/upload/",
    {
      advertiser_id: ctx.advertiserId,
      upload_type: "UPLOAD_BY_URL",
      image_url: imageUrl,
      file_name: `${fileName.slice(0, 80)}-${Date.now()}`,
    },
    "încărcare imagine",
  );
  const imageId = data?.image_id ?? data?.id;
  if (!imageId) throw new TikTokApiError("TikTok nu a întors image_id.", -1, "încărcare imagine");
  return String(imageId);
}

/**
 * Coperta video-ului: TikTok propune cadre după ce procesează clipul (30 s – 5 min).
 * Încercăm de câteva ori; dacă nu apare, întoarcem null și apelantul folosește altă imagine.
 */
export async function suggestVideoCover(ctx: TikTokAdContext, videoId: string, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const data = await ttRequest<{ list?: Array<{ id?: string; image_id?: string }> }>(
        ctx.token,
        "GET",
        "/file/video/suggestcover/",
        { advertiser_id: ctx.advertiserId, video_id: videoId, poster_number: 1 },
        "copertă video",
      );
      const first = data.list?.[0];
      const id = first?.id ?? first?.image_id;
      if (id) return String(id);
    } catch {
      /* încă se procesează */
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

const CTA_PREFERENCE = ["Aplică acum", "Înscrie-te", "Află mai multe", "Interesat"];

/** Butonul reclamei (CTA dinamic, în română) → call_to_action_id. */
export async function createCtaPortfolio(ctx: TikTokAdContext) {
  const rec = await ttRequest<{ recommend_assets?: Array<{ asset_content: string; asset_ids: string[] }> }>(
    ctx.token,
    "GET",
    "/creative/cta/recommend/",
    {
      advertiser_id: ctx.advertiserId,
      new_version: true,
      objective_type: "LEAD_GENERATION",
      promotion_type: "LEAD_GENERATION",
      language: "ro",
    },
    "buton reclamă",
  );
  const assets = rec.recommend_assets ?? [];
  const picked =
    CTA_PREFERENCE.map((p) => assets.find((a) => a.asset_content.trim() === p)).find(Boolean) ??
    assets[0];
  if (!picked) throw new TikTokApiError("TikTok nu a propus niciun buton.", -1, "buton reclamă");
  const created = await ttRequest<{ creative_portfolio_id: string }>(
    ctx.token,
    "POST",
    "/creative/portfolio/create/",
    {
      advertiser_id: ctx.advertiserId,
      creative_portfolio_type: "CTA",
      portfolio_content: [{ asset_content: picked.asset_content.trim(), asset_ids: picked.asset_ids }],
    },
    "buton reclamă",
  );
  return String(created.creative_portfolio_id);
}

export type TikTokLeadCampaignInput = {
  name: string;
  dailyBudget: number;
  pixelId: string;
  landingUrl: string;
  locationIds: string[];
  ageGroups?: string[];
  adText: string;
  creative:
    | { kind: "video"; videoId: string; coverImageId: string }
    | { kind: "carousel"; imageIds: string[]; musicId?: string };
  identity: { identityId: string; identityType: "TT_USER" };
  callToActionId: string;
  /** ENABLE pornește livrarea după aprobare; DISABLE creează tot oprit (teste). */
  status: "ENABLE" | "DISABLE";
};

/**
 * Campanie Smart+ de clienți potențiali cu destinație site (pagina AdPilot cu formular):
 * 1 campanie → 1 grup de reclame → 1 reclamă. Optimizare pe evenimentul FORM al pixelului.
 */
export async function createTikTokLeadCampaign(ctx: TikTokAdContext, input: TikTokLeadCampaignInput) {
  const campaign = await ttRequest<{ campaign_id: string }>(
    ctx.token,
    "POST",
    "/smart_plus/campaign/create/",
    {
      advertiser_id: ctx.advertiserId,
      request_id: requestId(),
      objective_type: "LEAD_GENERATION",
      campaign_name: input.name.slice(0, 500),
      budget_optimize_on: true,
      budget_mode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
      budget: input.dailyBudget,
      operation_status: input.status,
    },
    "campanie",
  );

  const targeting: Record<string, unknown> = { location_ids: input.locationIds };
  if (input.ageGroups?.length) targeting.age_groups = input.ageGroups;

  const adgroup = await ttRequest<{ adgroup_id: string }>(
    ctx.token,
    "POST",
    "/smart_plus/adgroup/create/",
    {
      advertiser_id: ctx.advertiserId,
      campaign_id: campaign.campaign_id,
      request_id: requestId(),
      adgroup_name: input.name.slice(0, 500),
      promotion_type: "LEAD_GENERATION",
      promotion_target_type: "EXTERNAL_WEBSITE",
      optimization_goal: "CONVERT",
      pixel_id: input.pixelId,
      optimization_event: "FORM",
      bid_type: "BID_TYPE_NO_BID",
      billing_event: "OCPM",
      schedule_type: "SCHEDULE_FROM_NOW",
      schedule_start_time: tiktokTime(new Date()),
      targeting_optimization_mode: input.ageGroups?.length ? "MANUAL" : "AUTOMATIC",
      targeting_spec: targeting,
      operation_status: input.status,
    },
    "grup de reclame",
  );

  const creativeInfo =
    input.creative.kind === "video"
      ? {
          ad_format: "SINGLE_VIDEO",
          video_info: { video_id: input.creative.videoId },
          image_info: [{ web_uri: input.creative.coverImageId }],
        }
      : {
          ad_format: "CAROUSEL_ADS",
          image_info: input.creative.imageIds.map((id) => ({ web_uri: id })),
          ...(input.creative.musicId ? { music_info: { music_id: input.creative.musicId } } : {}),
        };

  const ad = await ttRequest<any>(
    ctx.token,
    "POST",
    "/smart_plus/ad/create/",
    {
      advertiser_id: ctx.advertiserId,
      adgroup_id: adgroup.adgroup_id,
      ad_name: input.name.slice(0, 500),
      landing_page_url_list: [{ landing_page_url: input.landingUrl }],
      creative_list: [
        {
          creative_info: {
            ...creativeInfo,
            identity_type: input.identity.identityType,
            identity_id: input.identity.identityId,
          },
        },
      ],
      ad_text_list: [{ ad_text: input.adText.slice(0, 100) }],
      ad_configuration: { call_to_action_id: input.callToActionId },
      operation_status: input.status,
    },
    "reclamă",
  );

  return {
    campaignId: String(campaign.campaign_id),
    adgroupId: String(adgroup.adgroup_id),
    adId: String(ad?.smart_plus_ad_id ?? ad?.ad_id ?? ""),
  };
}

/** Șterge o campanie Smart+ (folosit la teste și la publicări eșuate la jumătate). */
export async function deleteTikTokCampaign(ctx: TikTokAdContext, campaignId: string) {
  await ttRequest(
    ctx.token,
    "POST",
    "/smart_plus/campaign/status/update/",
    { advertiser_id: ctx.advertiserId, campaign_ids: [campaignId], operation_status: "DELETE" },
    "ștergere campanie",
  );
}

const LEAD_PIXEL_NAME = "AdPilot Leads";

/**
 * Pixelul pe care optimizează campaniile TikTok ale clientului: îl refolosim dacă există,
 * altfel îl creăm, și ne asigurăm că are evenimentul FORM (trimis ca „Lead” de pe pagină).
 */
export async function ensureLeadPixel(ctx: TikTokAdContext) {
  const list = async () =>
    (
      await ttRequest<{ pixels?: any[] }>(
        ctx.token,
        "GET",
        "/pixel/list/",
        { advertiser_id: ctx.advertiserId, page_size: 20 },
        "pixel",
      )
    ).pixels ?? [];

  let pixel = (await list()).find((p) => p.pixel_name === LEAD_PIXEL_NAME);
  if (!pixel) {
    pixel = await ttRequest<any>(
      ctx.token,
      "POST",
      "/pixel/create/",
      { advertiser_id: ctx.advertiserId, pixel_name: LEAD_PIXEL_NAME },
      "pixel",
    );
  }
  const pixelId = String(pixel.pixel_id);
  const pixelCode = String(pixel.pixel_code);
  const hasForm = (pixel.events ?? []).some((e: any) => e.optimization_event === "FORM" || e.event_type === "FORM");
  if (!hasForm) {
    await ttRequest(
      ctx.token,
      "POST",
      "/pixel/event/create/",
      {
        advertiser_id: ctx.advertiserId,
        pixel_id: pixelId,
        pixel_events: [{ event_type: "FORM", event_name: "Lead" }],
      },
      "eveniment pixel",
    );
  }
  return { pixelId, pixelCode };
}

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

/** Telefon românesc → E.164 (+40…), cum cere TikTok înainte de hash. */
function e164(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("40") && d.length === 11) return `+${d}`;
  if (d.startsWith("0") && d.length === 10) return `+4${d}`;
  if (d.length >= 10) return `+${d}`;
  return null;
}

/**
 * Trimite „Lead” de pe server pe pixelul clientului (Events API 2.0), deduplicat cu ttq prin event_id.
 * Necesită scope-ul „Measurement → Report Conversion Event” pe aplicația TikTok; fără el, TikTok
 * refuză cererea și ne bazăm doar pe pixelul din browser. Best-effort, nu aruncă.
 */
export async function sendClientTikTokFormEvent(
  supabaseAdmin: any,
  userId: string,
  pixelCode: string,
  opts: {
    eventId: string;
    url: string | null;
    phone?: string | null;
    email?: string | null;
    ttclid?: string | null;
    ttp?: string | null;
  },
) {
  const ctx = await getTikTokAdContext(supabaseAdmin, userId);
  if (!ctx) return;
  const user: Record<string, string> = {};
  const phone = opts.phone ? e164(opts.phone) : null;
  if (phone) user.phone = sha256(phone);
  if (opts.email) user.email = sha256(opts.email.trim().toLowerCase());
  if (opts.ttclid) user.ttclid = opts.ttclid;
  if (opts.ttp) user.ttp = opts.ttp;
  try {
    await ttRequest(
      ctx.token,
      "POST",
      "/event/track/",
      {
        event_source: "web",
        event_source_id: pixelCode,
        data: [
          {
            event: "Lead",
            event_time: Math.floor(Date.now() / 1000),
            event_id: opts.eventId,
            user,
            page: { url: opts.url ?? "https://www.adpilot.ro" },
          },
        ],
      },
      "eveniment Lead",
    );
  } catch (e) {
    console.warn("[tiktok] Lead event not sent", (e as Error).message);
  }
}

/** Județele României în TikTok (/tool/region/, nivel PROVINCE). TikTok nu are orașe pentru RO. */
const RO_COUNTIES: Record<string, string> = {
  alba: "686583", arad: "686253", arges: "686192", bacau: "685948", bihor: "684878",
  "bistrita-nasaud": "684647", botosani: "684039", braila: "683902", brasov: "683844",
  bucuresti: "683504", buzau: "683123", calarasi: "673150", "caras-severin": "682714",
  cluj: "681290", constanta: "680962", covasna: "680428", dambovita: "679385", dolj: "679134",
  galati: "677697", giurgiu: "677104", gorj: "676898", harghita: "676309", hunedoara: "675917",
  ialomita: "675848", iasi: "675810", ilfov: "865518", maramures: "673887", mehedinti: "673612",
  mures: "672628", neamt: "672460", olt: "671857", prahova: "669737", salaj: "668248",
  "satu mare": "667869", sibiu: "667267", suceava: "665849", teleorman: "665283", timis: "665091",
  tulcea: "664517", valcea: "662893", vaslui: "663116", vrancea: "662447",
};

/** Orașe mari → județul lor. */
const RO_CITY_TO_COUNTY: Record<string, string> = {
  bucharest: "bucuresti", "cluj-napoca": "cluj", timisoara: "timis", craiova: "dolj",
  ploiesti: "prahova", oradea: "bihor", pitesti: "arges", "targu mures": "mures",
  "baia mare": "maramures", "ramnicu valcea": "valcea", "piatra neamt": "neamt",
  "drobeta-turnu severin": "mehedinti", "targu jiu": "gorj", focsani: "vrancea", resita: "caras-severin",
  slatina: "olt", "alba iulia": "alba", deva: "hunedoara", zalau: "salaj", "sfantu gheorghe": "covasna",
  barlad: "vaslui", bistrita: "bistrita-nasaud", alexandria: "teleorman", targoviste: "dambovita",
  slobozia: "ialomita", "miercurea ciuc": "harghita", voluntari: "ilfov", otopeni: "ilfov",
  "popesti-leordeni": "ilfov", medias: "sibiu", mangalia: "constanta", "campina": "prahova",
};

function normRo(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Orașe/județe din conversație → location_ids TikTok. Fără potrivire → toată România. */
export function tiktokLocationIds(places?: string[] | null): string[] {
  const ids = new Set<string>();
  for (const raw of places ?? []) {
    const p = normRo(raw).replace(/^(municipiul|judetul|jud\.?)\s+/, "");
    const county = RO_COUNTIES[p] ? p : RO_CITY_TO_COUNTY[p];
    if (county && RO_COUNTIES[county]) ids.add(RO_COUNTIES[county]);
  }
  return ids.size ? [...ids] : [TIKTOK_LOCATION_ROMANIA];
}

const AGE_GROUPS: Array<[string, number, number]> = [
  ["AGE_18_24", 18, 24],
  ["AGE_25_34", 25, 34],
  ["AGE_35_44", 35, 44],
  ["AGE_45_54", 45, 54],
  ["AGE_55_100", 55, 100],
];

/** Interval de vârstă → grupele TikTok care se suprapun. Tot intervalul 18+ → undefined (automat). */
export function tiktokAgeGroups(min = 18, max = 65): string[] | undefined {
  const groups = AGE_GROUPS.filter(([, a, b]) => b >= min && a <= max).map(([g]) => g);
  return groups.length === AGE_GROUPS.length ? undefined : groups;
}

/** Pornește / oprește o campanie Smart+ (ENABLE / DISABLE). */
export async function setTikTokCampaignStatus(
  ctx: TikTokAdContext,
  campaignId: string,
  status: "ENABLE" | "DISABLE",
) {
  await ttRequest(
    ctx.token,
    "POST",
    "/smart_plus/campaign/status/update/",
    { advertiser_id: ctx.advertiserId, campaign_ids: [campaignId], operation_status: status },
    status === "ENABLE" ? "pornire campanie" : "pauză campanie",
  );
}

/** Bugetul zilnic al campaniei (bugetul e la nivel de campanie, CBO). TikTok cere minimum 50 lei. */
export async function updateTikTokCampaignBudget(ctx: TikTokAdContext, campaignId: string, dailyBudget: number) {
  await ttRequest(
    ctx.token,
    "POST",
    "/smart_plus/campaign/update/",
    { advertiser_id: ctx.advertiserId, campaign_id: campaignId, budget: dailyBudget },
    "buget campanie",
  );
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Cheltuieli, afișări, click-uri pe ultimele `days` zile (inclusiv azi), sau pe un interval dat. */
export async function getTikTokCampaignStats(
  ctx: TikTokAdContext,
  campaignId: string,
  days: number,
  range?: { start: Date; end: Date },
) {
  const end = range?.end ?? new Date();
  const start = range?.start ?? new Date(Date.now() - (Math.max(1, days) - 1) * 86400_000);
  const data = await ttRequest<{ list?: Array<{ metrics?: Record<string, string> }> }>(
    ctx.token,
    "GET",
    "/report/integrated/get/",
    {
      advertiser_id: ctx.advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id"],
      metrics: ["spend", "impressions", "clicks"],
      start_date: ymd(start),
      end_date: ymd(end),
      filtering: [{ field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify([campaignId]) }],
      page_size: 10,
    },
    "raport",
  );
  const m = data.list?.[0]?.metrics ?? {};
  return {
    spend: Number(m.spend ?? 0),
    impressions: Number(m.impressions ?? 0),
    clicks: Number(m.clicks ?? 0),
  };
}

/** Starea campaniei pe TikTok (operation_status + secondary_status). */
export async function getTikTokCampaignState(ctx: TikTokAdContext, campaignId: string) {
  const data = await ttRequest<{ list?: any[] }>(
    ctx.token,
    "GET",
    "/smart_plus/campaign/get/",
    {
      advertiser_id: ctx.advertiserId,
      filtering: { campaign_ids: [campaignId] },
    },
    "stare campanie",
  );
  const c = data.list?.[0];
  return c
    ? { operationStatus: String(c.operation_status ?? ""), secondaryStatus: String(c.secondary_status ?? ""), budget: Number(c.budget ?? 0) }
    : null;
}
