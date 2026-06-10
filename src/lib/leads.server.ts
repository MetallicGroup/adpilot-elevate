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