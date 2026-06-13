/**
 * Server-only WhatsApp Cloud API helpers.
 */
import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

export type WAMessageContent =
  | { type: "text"; text: string }
  | { type: "image"; mediaId: string; caption?: string }
  | { type: "image_link"; url: string; caption?: string };

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  toPhone: string,
  content: WAMessageContent,
): Promise<{ id: string }> {
  const url = `${GRAPH}/${metaApiVersion()}/${phoneNumberId}/messages`;
  let body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhone,
  };
  if (content.type === "text") {
    body.type = "text";
    body.text = { body: content.text.slice(0, 4096), preview_url: true };
  } else if (content.type === "image") {
    body.type = "image";
    body.image = { id: content.mediaId, ...(content.caption ? { caption: content.caption } : {}) };
  } else if (content.type === "image_link") {
    body.type = "image";
    body.image = { link: content.url, ...(content.caption ? { caption: content.caption } : {}) };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.error_user_msg || json?.error?.message || "WA send failed";
    throw new Error(`${msg} (${res.status})`);
  }
  const id = json?.messages?.[0]?.id as string | undefined;
  return { id: id ?? "" };
}

export async function getWhatsAppMediaUrl(mediaId: string, accessToken: string): Promise<{ url: string; mime_type: string }> {
  const r = await fetch(`${GRAPH}/${metaApiVersion()}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `getMediaUrl ${r.status}`);
  return { url: j.url, mime_type: j.mime_type };
}

export async function downloadWhatsAppMedia(mediaUrl: string, accessToken: string): Promise<Uint8Array> {
  const r = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`download media ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Upload bytes as WhatsApp media (for outgoing messages). Returns media id. */
export async function uploadWhatsAppMedia(
  phoneNumberId: string,
  accessToken: string,
  bytes: Uint8Array,
  mime: string,
  filename = "image.jpg",
): Promise<string> {
  const url = `${GRAPH}/${metaApiVersion()}/${phoneNumberId}/media`;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), filename);
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `WA media upload ${r.status}`);
  return j.id as string;
}

export function generateVerifyToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify Meta x-hub-signature-256 against raw body using app secret. */
export async function verifyWaSignature(rawBody: string, sigHeader: string | null, appSecret: string): Promise<boolean> {
  if (!sigHeader || !sigHeader.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
  const expected = `sha256=${hex}`;
  if (expected.length !== sigHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
  return diff === 0;
}