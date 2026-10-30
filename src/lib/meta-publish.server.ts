/**
 * Server-only Meta Marketing API publish helpers.
 */
import { createHash } from "node:crypto";
import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

/** Eroare Meta cu codurile originale, ca să poată fi explicată omului (vezi meta-errors.server.ts). */
export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
  title?: string;
  constructor(message: string, info: { code?: number; subcode?: number; title?: string } = {}) {
    super(message);
    this.name = "MetaApiError";
    Object.assign(this, info);
  }
}

export const COUNTRY_CODES: Record<string, string> = {
  // Romanian labels — what the wizard UI actually produces
  România: "RO",
  "Republica Moldova": "MD",
  "Marea Britanie": "GB",
  Germania: "DE",
  Italia: "IT",
  Spania: "ES",
  Franța: "FR",
  SUA: "US",
  // English labels — legacy drafts / other surfaces
  Romania: "RO",
  Moldova: "MD",
  "United States": "US",
  "United Kingdom": "GB",
  Canada: "CA",
  Australia: "AU",
  Germany: "DE",
  France: "FR",
  Italy: "IT",
  Spain: "ES",
  Brazil: "BR",
  Mexico: "MX",
  Japan: "JP",
  India: "IN",
};

const CTA_MAP: Record<string, string> = {
  // Romanian labels — what the wizard UI produces
  "Află mai mult": "LEARN_MORE",
  "Înscrie-te": "SIGN_UP",
  "Cumpără acum": "SHOP_NOW",
  Descarcă: "DOWNLOAD",
  "Aplică acum": "APPLY_NOW",
  "Rezervă acum": "BOOK_TRAVEL",
  "Sună acum": "CALL_NOW",
  // English labels — legacy / other surfaces
  "Learn More": "LEARN_MORE",
  "Sign Up": "SIGN_UP",
  "Shop Now": "SHOP_NOW",
  Download: "DOWNLOAD",
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
  const json = await res.json().catch(() => null);
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
  const err = json?.error;
  if (!res.ok || err) {
    const msg = err?.error_user_msg || err?.message || `Meta ${path} failed`;
    const title = err?.error_user_title && err.error_user_title !== msg ? `${err.error_user_title}: ` : "";
    const codes = err?.code ? ` #${err.code}${err?.error_subcode ? `/${err.error_subcode}` : ""}` : "";
    throw new MetaApiError(`${title}${msg} (${res.status}${codes}) [pas: ${step}]`, {
      code: err?.code,
      subcode: err?.error_subcode,
      title: err?.error_user_title,
    });
  }
  // Crearea unui obiect trebuie să întoarcă un ID; altfel nu continuăm cu un pas „gol”.
  if (body.execution_options === undefined && /\/(campaigns|adsets|adcreatives|ads|leadgen_forms)$/.test(path) && !json?.id) {
    throw new MetaApiError(`Meta n-a întors niciun ID (răspuns: ${JSON.stringify(json).slice(0, 200)}) [pas: ${step}]`);
  }
  return json;
}

/** Linkul unde administratorul paginii acceptă Condițiile Meta pentru reclame cu formular. */
export function leadTermsUrl(pageId: string) {
  // Linkul direct /ads/leadgen/tos dă des „Something went wrong” (mai ales pe telefon);
  // prin Business Suite → Formulare instant → „Creează formular”, Facebook cere singur acceptarea.
  return `https://business.facebook.com/latest/instant_forms?asset_id=${pageId}`;
}

/**
 * A acceptat pagina Condițiile Meta pentru formulare (lead ads)? Fără ele, Meta refuză setul de reclame.
 * null = nu am putut verifica (nu blocăm din cauza asta).
 */
export async function pageLeadTermsAccepted(pageId: string, pageAccessToken: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${metaApiVersion()}/${pageId}?fields=leadgen_tos_accepted&access_token=${encodeURIComponent(pageAccessToken)}`,
    );
    const json: any = await res.json();
    if (!res.ok || typeof json?.leadgen_tos_accepted !== "boolean") return null;
    return json.leadgen_tos_accepted;
  } catch {
    return null;
  }
}

/** „0725…", „40725…", „+40 725…" → „+40725…" (formatul acceptat de Meta cu country_code RO). */
function normalizeThankYouPhone(raw?: string | null): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("40") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+4${digits}`;
  if (digits.length === 9 && digits.startsWith("7")) return `+40${digits}`;
  return null;
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
    /**
     * Butonul de la finalul formularului: „Scrie-ne pe WhatsApp” (numărul afacerii), altfel
     * site-ul clientului, altfel „Sună acum” pe numărul lui.
     */
    thank_you?: { website?: string | null; phone?: string | null; whatsapp?: string | null; whatsapp_text?: string | null };
    /** Titlul ecranului de început (oferta pe scurt). */
    intro_title?: string;
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
  // Meta cere nume unic pe pagină; refolosim un formular doar dacă are EXACT același conținut
  // (altfel, după o modificare, omul ar primi formularul vechi, cu întrebările vechi).
  const fingerprint = createHash("sha1")
    .update(JSON.stringify([spec.fields, spec.custom_questions ?? [], spec.intro ?? "", spec.intro_title ?? "", spec.thank_you ?? {}]))
    .digest("hex")
    .slice(0, 6);
  const formName = `${spec.name.slice(0, 230)} (RO ${fingerprint})`;
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

  const website = (spec.thank_you?.website ?? "").trim();
  const hasWebsite = /^https?:\/\//i.test(website) && !/(^|\.)adpilot\.ro/i.test(website);
  const phone = normalizeThankYouPhone(spec.thank_you?.phone);
  const wa = normalizeThankYouPhone(spec.thank_you?.whatsapp)?.replace(/\D/g, "");
  const waText = (spec.thank_you?.whatsapp_text ?? "").trim();
  const thankYou = wa
    ? {
        button_type: "VIEW_WEBSITE",
        button_text: "Scrie-ne pe WhatsApp",
        website_url: `https://wa.me/${wa}${waText ? `?text=${encodeURIComponent(waText.slice(0, 200))}` : ""}`,
      }
    : hasWebsite
      ? { button_type: "VIEW_WEBSITE", button_text: "Vizitează site-ul", website_url: website }
      : phone
        ? { button_type: "CALL_BUSINESS", button_text: "Sună acum", business_phone_number: phone, country_code: "RO" }
        : null;
  const thankYouBasic = hasWebsite
    ? { button_type: "VIEW_WEBSITE", button_text: "Vizitează site-ul", website_url: website }
    : phone
      ? { button_type: "CALL_BUSINESS", button_text: "Sună acum", business_phone_number: phone, country_code: "RO" }
      : null;
  // Ecranul de început: oferta, ca omul să știe la ce se înscrie.
  const intro = (spec.intro ?? "").trim();
  const contextCard = intro
    ? {
        context_card: {
          title: (spec.intro_title ?? spec.name).trim().slice(0, 60),
          style: "PARAGRAPH_STYLE",
          content: [intro.slice(0, 500)],
          button_text: "Continuă",
        },
      }
    : {};

  const formBody = (withExtras: boolean) => ({
    name: formName,
    questions,
    privacy_policy: { url: spec.privacy_url, link_text: "Politica de confidențialitate" },
    locale: "RO_RO",
    ...(withExtras ? contextCard : {}),
    ...((withExtras ? thankYou : thankYouBasic)
      ? {
          thank_you_page: {
            title: "Mulțumim!",
            body:
              withExtras && wa
                ? "Te contactăm în cel mai scurt timp. Dacă vrei să stabilim mai repede, scrie-ne direct pe WhatsApp."
                : "Te contactăm în cel mai scurt timp.",
            ...(withExtras ? thankYou : thankYouBasic),
          },
        }
        : // Fără site și fără telefon: butonul duce pe pagina de Facebook a afacerii, nu pe AdPilot.
          { follow_up_action_url: `https://www.facebook.com/${pageId}` }),
  });
  try {
    try {
      return await metaPOST(`/${pageId}/leadgen_forms`, pageAccessToken, formBody(true));
    } catch (e: any) {
      // Ecranul de început e un bonus: dacă Meta nu-l acceptă, formularul pleacă fără el.
      if ((!Object.keys(contextCard).length && !wa) || !/param|context_card|invalid|url/i.test(String(e?.message ?? ""))) throw e;
      console.warn("[lead form] context card refuzat, reîncerc fără", e?.message);
      return await metaPOST(`/${pageId}/leadgen_forms`, pageAccessToken, formBody(false));
    }
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
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_SALES" | "OUTCOME_ENGAGEMENT" = "OUTCOME_LEADS",
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

/**
 * Găsește primul Pixel Meta existent pe contul publicitar (pentru campanii de
 * vânzări către site-ul clientului). NU creează unul — dacă nu există, clientul
 * trebuie să instaleze Pixel-ul pe site ca să se poată optimiza pe achiziții.
 */
/**
 * Verifică dacă un cont de reclame poate rula reclame ACUM (account_status=1).
 * Fail-fast înainte de a crea ceva pe Meta — altfel rămân campanii pe jumătate
 * create. Întoarce un mesaj clar în română pentru fiecare status problematic.
 */
export async function checkAdAccountRunnable(
  adAccountId: string,
  accessToken: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await fetch(
      `${GRAPH}/${metaApiVersion()}/act_${adAccountId}?fields=account_status,disable_reason&access_token=${encodeURIComponent(accessToken)}`,
    );
    const j: any = await r.json();
    if (!r.ok) return { ok: true }; // nu putem verifica → nu blocăm (fallback pe eroarea reală)
    const status = Number(j?.account_status);
    if (status === 1) return { ok: true };
    const messages: Record<number, string> = {
      2: "⚠️ Contul tău de reclame este *dezactivat* la Facebook. Intră în Facebook Ads Manager → Calitatea contului ca să vezi motivul și să faci contestație.",
      3: "⚠️ Contul tău de reclame are un *sold neplătit* la Facebook, așa că nu poate rula reclame noi. Intră în *Facebook Ads Manager → Facturare* și achită suma restantă — apoi îmi scrii și lansăm.",
      7: "⚠️ Contul tău de reclame este *în verificare* la Facebook (pending review). Așteaptă aprobarea Meta (de obicei câteva ore), apoi reîncercăm.",
      8: "⚠️ Contul tău are o *plată în procesare* la Facebook. Așteaptă să se finalizeze plata, apoi reîncercăm.",
      9: "⚠️ Contul tău e într-o *perioadă de grație* de plată la Facebook. Rezolvă plata în Facturare ca să poți lansa.",
      100: "⚠️ Contul tău de reclame este *în curs de închidere* la Facebook. Folosește alt cont de reclame din Setări.",
      101: "⚠️ Contul tău de reclame este *închis* la Facebook. Folosește alt cont de reclame din Setări.",
    };
    return {
      ok: false,
      message:
        messages[status] ??
        `⚠️ Contul tău de reclame nu este activ la Facebook (status ${status}). Verifică-l în Facebook Ads Manager (facturare / calitatea contului) înainte să lansăm.`,
    };
  } catch {
    return { ok: true };
  }
}

export async function findExistingPixel(
  adAccountId: string,
  accessToken: string,
): Promise<{ id: string; name: string } | null> {
  const res = await fetch(
    `${GRAPH}/${metaApiVersion()}/act_${adAccountId}/adspixels?fields=id,name&limit=25&access_token=${encodeURIComponent(accessToken)}`,
  );
  const json: any = await res.json();
  if (!res.ok || !Array.isArray(json?.data) || !json.data.length) return null;
  const p = json.data[0];
  return p?.id ? { id: String(p.id), name: String(p.name ?? "Pixel") } : null;
}

export type AdPixelInfo = {
  id: string;
  name: string;
  last_fired_time: string | null;
  /** true dacă a trimis evenimente în ultimele 30 zile (semnal util pentru Sales/Signups). */
  active: boolean;
};

/** Listează TOȚI pixelii Meta de pe contul de reclame (nume + id + health). */
export async function listAdPixels(
  adAccountId: string,
  accessToken: string,
): Promise<AdPixelInfo[]> {
  try {
    const res = await fetch(
      `${GRAPH}/${metaApiVersion()}/act_${adAccountId}/adspixels?fields=id,name,last_fired_time&limit=50&access_token=${encodeURIComponent(accessToken)}`,
    );
    const json: any = await res.json();
    if (!res.ok || !Array.isArray(json?.data)) return [];
    const now = Date.now();
    return json.data
      .filter((p: any) => p?.id)
      .map((p: any) => {
        const last = p.last_fired_time ? String(p.last_fired_time) : null;
        const active = !!last && now - new Date(last).getTime() < 30 * 86_400_000;
        return {
          id: String(p.id),
          name: String(p.name ?? "Pixel"),
          last_fired_time: last,
          active,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Caută în Meta un INTERES după nume; întoarce primul rezultat.
 * (Doar `adinterest` — căutarea de `behaviors` ignoră query-ul și întoarce mereu
 * primul comportament, deci ar atașa targetare greșită.)
 */
export async function searchAdTargeting(
  accessToken: string,
  query: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const url = `${GRAPH}/${metaApiVersion()}/search?type=adinterest&q=${encodeURIComponent(query)}&limit=1&access_token=${encodeURIComponent(accessToken)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (r.ok && Array.isArray(j?.data) && j.data.length) {
      return { id: String(j.data[0].id), name: String(j.data[0].name) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Rezolvă o listă de nume de interese în ID-uri Meta. */
export async function resolveAdTargeting(
  accessToken: string,
  names: string[],
): Promise<{
  interests: Array<{ id: string; name: string }>;
  behaviors: Array<{ id: string; name: string }>;
  matched: string[];
  missed: string[];
}> {
  const interests: Array<{ id: string; name: string }> = [];
  const matched: string[] = [];
  const missed: string[] = [];
  for (const name of names.slice(0, 12)) {
    const m = await searchAdTargeting(accessToken, name);
    if (!m) {
      missed.push(name);
      continue;
    }
    interests.push({ id: m.id, name: m.name });
    matched.push(m.name);
  }
  return { interests, behaviors: [], matched, missed };
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
      interests?: Array<{ id: string; name: string }>;
      behaviors?: Array<{ id: string; name: string }>;
    };
    status: "ACTIVE" | "PAUSED";
    objective?: "leads" | "traffic" | "bookings" | "landing_lead" | "sales" | "signups" | "messages";
    /** Doar pentru objective="messages": unde ajunge omul când apasă „Trimite mesaj”. */
    message_destination?: MessageDestination;
    pixel_id?: string;
    dsa_beneficiary?: string;
    dsa_payor?: string;
    /**
     * Advantage+ placements (default true): Meta alege placement-urile pe FB+IG.
     * false = doar Feed Facebook (legacy / test controlat).
     */
    advantage_placements?: boolean;
  },
) {
  const targeting = buildTargeting(args.targeting, args.advantage_placements !== false);
  return createAdSetWithTargeting(adAccountId, accessToken, args, targeting);
}

export type TargetingInput = {
  countries: string[];
  age_min: number;
  age_max: number;
  genders?: number[];
  cities?: Array<{ key: string; radius?: number; distance_unit?: "kilometer" | "mile" }>;
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
};

/** Specificația de targetare Meta (aceeași la creare și la verificarea dinainte de lansare). */
export function buildTargeting(input: TargetingInput, advantagePlacements = true): Record<string, unknown> {
  const args = { targeting: input };
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
    // FB + IG only (fără Audience Network by default). Fără poziții fixe =
    // Advantage+ placements pe feed, stories, reels, etc.
    publisher_platforms: ["facebook", "instagram"],
    targeting_automation: { advantage_audience: 1 },
  };
  if (!advantagePlacements) {
    targeting.facebook_positions = ["feed"];
    targeting.instagram_positions = ["stream"];
  }
  if (args.targeting.genders && args.targeting.genders.length) {
    targeting.genders = args.targeting.genders;
    // Cu Advantage+ audience, genul e doar o sugestie — când clientul cere explicit un gen, îl respectăm strict.
    targeting.targeting_automation = { advantage_audience: 0 };
  }
  // Cu Advantage+ audience, Meta refuză o vârstă maximă sub 65 (o acceptă doar ca sugestie).
  // Când clientul cere o vârstă maximă, o respectăm strict.
  if (args.targeting.age_max < 65) {
    targeting.targeting_automation = { advantage_audience: 0 };
  }
  // Interese + comportamente (targetare detaliată) — OR în cadrul unui grup
  // flexible_spec. Ex B2B: „Small business owners" + „Beauty salon"; B2C: „Makeup".
  const flex: Record<string, unknown> = {};
  if (args.targeting.interests && args.targeting.interests.length) {
    flex.interests = args.targeting.interests.map((i) => ({ id: i.id, name: i.name }));
  }
  if (args.targeting.behaviors && args.targeting.behaviors.length) {
    flex.behaviors = args.targeting.behaviors.map((b) => ({ id: b.id, name: b.name }));
  }
  if (Object.keys(flex).length) targeting.flexible_spec = [flex];
  return targeting;
}

async function createAdSetWithTargeting(
  adAccountId: string,
  accessToken: string,
  args: Parameters<typeof createAdSet>[2],
  targeting: Record<string, unknown>,
) {
  // Conversii pe site/landing (evenimente trimise prin Pixel + CAPI).
  const isConversion =
    args.objective === "bookings" ||
    args.objective === "landing_lead" ||
    args.objective === "sales" ||
    args.objective === "signups";
  const isMessages = args.objective === "messages";
  const optimization_goal = isMessages
    ? "CONVERSATIONS"
    : args.objective === "traffic"
      ? "LINK_CLICKS"
      : isConversion
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
    destination_type: isMessages
      ? (args.message_destination ?? "MESSENGER")
      : args.objective === "leads"
        ? "ON_AD"
        : "WEBSITE",
  };
  if (isConversion) {
    // Optimizare pe conversii reale (evenimente trimise prin Pixel + CAPI).
    if (!args.pixel_id) throw new Error("Lipsește pixelul Meta pentru această campanie.");
    body.promoted_object = {
      pixel_id: args.pixel_id,
      custom_event_type:
        args.objective === "bookings"
          ? "SCHEDULE"
          : args.objective === "sales"
            ? "PURCHASE"
            : args.objective === "signups"
              ? "COMPLETE_REGISTRATION"
              : "LEAD",
    };
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

/** Butoanele pe care Meta le acceptă la reclamele cu formular de clienți. */
const LEAD_FORM_CTAS = new Set(["SIGN_UP", "LEARN_MORE", "APPLY_NOW", "GET_QUOTE", "SUBSCRIBE", "DOWNLOAD"]);

/** Unde ajunge omul la o reclamă de mesaje. */
export type MessageDestination = "WHATSAPP" | "MESSENGER" | "INSTAGRAM_DIRECT";

export type AdStoryArgs = {
  /** Reclamă de mesaje: butonul „Trimite mesaj” deschide direct chatul (fără formular, fără site). */
  message_destination?: MessageDestination;
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
};

/** object_story_spec pentru o reclamă (imagine sau video), folosit la creare și la previzualizare. */
export function buildAdStorySpec(args: AdStoryArgs, opts: { previewOnly?: boolean } = {}) {
  if (args.message_destination) return buildMessageStorySpec(args);
  let cta_type = CTA_MAP[args.cta] || "LEARN_MORE";
  // Formularele nu acceptă „Book Now” & co. — Meta respinge creativul; „Înscrie-te” e cel mai apropiat.
  if (args.lead_gen_form_id && !LEAD_FORM_CTAS.has(cta_type)) cta_type = "SIGN_UP";
  const isTel = args.landing_url && /^tel:/i.test(args.landing_url);
  const isHttp = args.landing_url && /^https?:\/\//i.test(args.landing_url) && !/facebook\.com/i.test(args.landing_url);
  const link = isTel || isHttp ? args.landing_url : "https://adpilot.ro";
  const call_to_action: Record<string, unknown> = { type: cta_type };
  if (args.lead_gen_form_id && !opts.previewOnly) {
    call_to_action.value = { lead_gen_form_id: args.lead_gen_form_id };
  } else {
    call_to_action.value = { link: isTel ? "https://adpilot.ro" : link };
  }
  const base = {
    page_id: args.page_id,
    ...(args.instagram_user_id ? { instagram_user_id: args.instagram_user_id } : {}),
  };
  if (args.video_id) {
    const video_data: Record<string, unknown> = {
      video_id: args.video_id,
      title: args.headline,
      message: args.description,
      call_to_action,
    };
    if (args.thumbnail_url) video_data.image_url = args.thumbnail_url;
    return { ...base, video_data };
  }
  if (!args.image_hash) throw new Error("Reclama are nevoie de image_hash sau video_id");
  return {
    ...base,
    link_data: { image_hash: args.image_hash, link, message: args.description, name: args.headline, call_to_action },
  };
}

const MESSAGE_CTA: Record<MessageDestination, { type: string; link: string }> = {
  WHATSAPP: { type: "WHATSAPP_MESSAGE", link: "https://api.whatsapp.com/send" },
  MESSENGER: { type: "MESSAGE_PAGE", link: "https://fb.com/messenger_doc/" },
  INSTAGRAM_DIRECT: { type: "INSTAGRAM_MESSAGE", link: "https://www.instagram.com/" },
};

function buildMessageStorySpec(args: AdStoryArgs) {
  const dest = args.message_destination!;
  const cta = MESSAGE_CTA[dest];
  const call_to_action = { type: cta.type, value: { app_destination: dest } };
  const base = {
    page_id: args.page_id,
    ...(args.instagram_user_id ? { instagram_user_id: args.instagram_user_id } : {}),
  };
  if (args.video_id) {
    const video_data: Record<string, unknown> = {
      video_id: args.video_id,
      title: args.headline,
      message: args.description,
      call_to_action,
    };
    if (args.thumbnail_url) video_data.image_url = args.thumbnail_url;
    return { ...base, video_data };
  }
  if (!args.image_hash) throw new Error("Reclama are nevoie de image_hash sau video_id");
  return {
    ...base,
    link_data: { image_hash: args.image_hash, link: cta.link, message: args.description, name: args.headline, call_to_action },
  };
}

/** Numărul de WhatsApp legat de pagina de Facebook (necesar pentru reclame „Trimite mesaj pe WhatsApp”). */
export async function pageWhatsAppNumber(pageId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${metaApiVersion()}/${pageId}?fields=whatsapp_number&access_token=${encodeURIComponent(accessToken)}`,
    );
    const json: any = await res.json();
    const n = String(json?.whatsapp_number ?? "").replace(/\D/g, "");
    return res.ok && n ? n : null;
  } catch {
    return null;
  }
}

/**
 * Verificare înainte de lansare: Meta validează targetarea și întoarce mărimea estimată a publicului.
 * Nu creează nimic. Prinde din timp erori de vârstă / oraș / Advantage+.
 */
export async function estimateAudience(
  adAccountId: string,
  accessToken: string,
  targeting: Record<string, unknown>,
  optimizationGoal = "LEAD_GENERATION",
): Promise<{ ok: true; lower: number | null; upper: number | null } | { ok: false; error: string }> {
  try {
    const qs = new URLSearchParams({
      targeting_spec: JSON.stringify(targeting),
      optimization_goal: optimizationGoal,
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH}/${metaApiVersion()}/act_${adAccountId}/delivery_estimate?${qs.toString()}`);
    const json: any = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      const e = json?.error;
      return { ok: false, error: `${e?.error_user_msg || e?.message || `Meta ${res.status}`}${e?.code ? ` (#${e.code}${e?.error_subcode ? `/${e.error_subcode}` : ""})` : ""}` };
    }
    const d = json?.data?.[0];
    const lower = Number(d?.estimate_mau_lower_bound ?? d?.estimate_mau ?? NaN);
    const upper = Number(d?.estimate_mau_upper_bound ?? d?.estimate_mau ?? NaN);
    return { ok: true, lower: Number.isFinite(lower) ? lower : null, upper: Number.isFinite(upper) ? upper : null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Validează campania la Meta fără s-o creeze (`validate_only`). */
export async function validateCampaign(
  adAccountId: string,
  accessToken: string,
  name: string,
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_SALES" | "OUTCOME_ENGAGEMENT",
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await metaPOST(`/act_${adAccountId}/campaigns`, accessToken, {
      name,
      objective,
      status: "PAUSED",
      special_ad_categories: [],
      buying_type: "AUCTION",
      is_adset_budget_sharing_enabled: false,
      execution_options: ["validate_only"],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  args: AdStoryArgs & { name: string },
) {
  return metaPOST(`/act_${adAccountId}/adcreatives`, accessToken, {
    name: args.name.slice(0, 200),
    object_story_spec: buildAdStorySpec(args),
  });
}

/**
 * Previzualizare reală Meta (feed mobil) pentru o reclamă care încă nu există — nu creează nimic în cont.
 * Întoarce URL-ul iframe-ului Meta (valabil câteva ore) sau null.
 */
export async function generateAdPreviewUrl(
  adAccountId: string,
  accessToken: string,
  args: AdStoryArgs,
  adFormat = "MOBILE_FEED_STANDARD",
): Promise<string | null> {
  const spec = buildAdStorySpec(args, { previewOnly: true });
  const qs = new URLSearchParams({
    creative: JSON.stringify({ object_story_spec: spec }),
    ad_format: adFormat,
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH}/${metaApiVersion()}/act_${adAccountId}/generatepreviews?${qs.toString()}`);
  const json: any = await res.json().catch(() => null);
  const body: string | undefined = json?.data?.[0]?.body;
  const m = body?.match(/src="([^"]+)"/);
  return m ? m[1].replace(/&amp;/g, "&") : null;
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
  // Empty result = all genders. "Toți"/"All" mean all; a specific pick narrows it.
  const out: number[] = [];
  for (const g of genders) {
    if (g === "Male" || g === "Bărbați") out.push(1);
    if (g === "Female" || g === "Femei") out.push(2);
  }
  return [...new Set(out)];
}

export function mapLocationsToCountries(locations: string[]): string[] {
  const codes = [...new Set(locations.map((l) => COUNTRY_CODES[l]).filter(Boolean))];
  // Romanian-first product: fall back to RO, never silently to the US.
  return codes.length ? codes : ["RO"];
}