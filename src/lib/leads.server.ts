/**
 * Server-only lead helpers. `.server.ts` keeps this out of client bundles.
 */
import { metaApiVersion } from "./meta.server";

const GRAPH_BASE = "https://graph.facebook.com";

export type MetaLeadField = { name: string; values: string[] };

export type MetaLeadgenPayload = {
  id: string;
  created_time?: string;
  ad_id?: string;
  adgroup_id?: string;
  form_id?: string;
  field_data: MetaLeadField[];
};

export async function fetchMetaLead(leadgenId: string, pageAccessToken: string): Promise<MetaLeadgenPayload> {
  const url = new URL(`${GRAPH_BASE}/${metaApiVersion()}/${leadgenId}`);
  url.searchParams.set(
    "fields",
    "id,created_time,ad_id,adgroup_id,form_id,field_data",
  );
  url.searchParams.set("access_token", pageAccessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`fetchMetaLead ${leadgenId} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Normalises Meta lead form field_data into our internal lead shape.
 * Meta field names are typically: full_name, first_name, last_name, email,
 * phone_number, city, company_name, custom_question_*.
 */
/** Câmpurile standard (nume/telefon/email) — le excludem din întrebările custom. */
const STANDARD_LEAD_FIELDS = new Set([
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "phone",
]);

/** Meta transformă labelul întrebării în slug: lowercase + runuri de caractere
 * ne-alfanumerice (inclusiv diacritice) → „_". Reproducem asta ca să potrivim
 * un câmp Meta cu întrebarea originală salvată în campanie. */
function metaSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/**
 * Extrage întrebările custom din formular cu răspunsurile lor (tot ce NU e
 * nume/telefon/email). Dacă avem întrebările salvate în campanie
 * (`storedQuestions`), folosim labelul ORIGINAL (cu diacritice) și rezolvăm
 * răspunsurile grilă `option_N` → textul real al opțiunii. Altfel, umanizăm
 * slug-ul de la Meta ca fallback.
 */
export function extractLeadQuestions(
  field_data: MetaLeadField[],
  storedQuestions?: Array<{ label: string; options?: string[] }> | null,
): Array<{ q: string; a: string }> {
  const bySlug = new Map<string, { label: string; options?: string[] }>();
  for (const sq of storedQuestions ?? []) {
    if (sq?.label) bySlug.set(metaSlug(sq.label), sq);
  }
  return (field_data ?? [])
    .filter((f) => f.name && !STANDARD_LEAD_FIELDS.has(f.name.toLowerCase()))
    .map((f) => {
      const stored = f.name ? bySlug.get(f.name.toLowerCase()) : undefined;
      const rawSlug = (f.name ?? "").replace(/_/g, " ").trim();
      const q =
        stored?.label ??
        (rawSlug ? rawSlug.charAt(0).toUpperCase() + rawSlug.slice(1) : "Întrebare");
      const a = (f.values ?? [])
        .map((v) => {
          const val = String(v).trim();
          const m = /^option_(\d+)$/i.exec(val);
          if (m && stored?.options) {
            const idx = parseInt(m[1], 10) - 1;
            if (idx >= 0 && idx < stored.options.length) return stored.options[idx];
          }
          return val;
        })
        .filter(Boolean)
        .join(", ");
      return { q, a };
    })
    .filter((x) => x.a);
}

export function mapMetaLeadFields(field_data: MetaLeadField[]) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const f = field_data.find((x) => x.name?.toLowerCase() === k);
      if (f && f.values?.[0]) return f.values[0].trim();
    }
    return null;
  };
  const full_name =
    get("full_name") ||
    [get("first_name"), get("last_name")].filter(Boolean).join(" ").trim() ||
    null;
  const email = (get("email") || "").toLowerCase() || null;
  const phone = normalizePhone(get("phone_number", "phone"));
  const message =
    get("message", "comments", "questions", "custom_question") ||
    field_data
      .filter((f) => f.name?.toLowerCase().startsWith("custom_"))
      .map((f) => `${f.name}: ${f.values?.[0] ?? ""}`)
      .join(" • ") ||
    null;
  return { full_name: full_name || null, email, phone, message };
}

function normalizePhone(p: string | null) {
  if (!p) return null;
  const cleaned = p.replace(/[^\d+]/g, "");
  return cleaned || null;
}

/** HMAC-SHA256 verification for Meta `X-Hub-Signature-256` */
export async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const expectedHex = header.slice("sha256=".length).trim();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const actualHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (actualHex.length !== expectedHex.length) return false;
  // timing-safe compare
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}