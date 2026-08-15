/**
 * TikTok Events API (server-side) — pentru reclamele AdPilot pe TikTok.
 * Trimite conversii de pe server (CompleteRegistration, Purchase) ca să nu
 * depindem doar de pixelul din browser (mai precis, rezistent la ad-blockere).
 *
 * Token-ul e SECRET → vine din env `TIKTOK_EVENTS_ACCESS_TOKEN` (setat pe Vercel).
 * PII (email/telefon/user id) se trimite HASH-uit SHA-256, conform cerinței TikTok.
 * Best-effort: dacă lipsește tokenul sau pică request-ul, nu blocăm fluxul.
 */
import { createHash, randomUUID } from "crypto";

const TIKTOK_PIXEL_ID = "DA07Q8RC77U9RA6QKUJ0";
const ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

function sha256(v: string): string {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

export type TikTokEventUser = {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  ttclid?: string | null;
  ttp?: string | null;
};

export async function sendTikTokEvent(
  event: string,
  opts: {
    eventId?: string;
    url?: string;
    user?: TikTokEventUser;
    value?: number;
    currency?: string;
    contentId?: string;
    contentName?: string;
  } = {},
): Promise<void> {
  const token = process.env.TIKTOK_EVENTS_ACCESS_TOKEN;
  if (!token) return; // neconfigurat → skip silențios

  try {
    const u = opts.user ?? {};
    const user: Record<string, string> = {};
    if (u.email) user.email = sha256(u.email);
    if (u.phone) user.phone = sha256(u.phone.replace(/[^\d+]/g, ""));
    if (u.externalId) user.external_id = sha256(u.externalId);
    // IP și user_agent NU se hashează.
    if (u.ip) user.ip = u.ip;
    if (u.userAgent) user.user_agent = u.userAgent;
    if (u.ttclid) user.ttclid = u.ttclid;
    if (u.ttp) user.ttp = u.ttp;

    const properties: Record<string, unknown> = {};
    if (typeof opts.value === "number") properties.value = opts.value;
    if (opts.currency) properties.currency = opts.currency;
    if (opts.contentId) {
      properties.content_id = opts.contentId;
      properties.content_type = "product";
    }
    if (opts.contentName) properties.content_name = opts.contentName;

    const body = {
      event_source: "web",
      event_source_id: TIKTOK_PIXEL_ID,
      data: [
        {
          event,
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId ?? randomUUID(),
          user,
          ...(opts.url ? { page: { url: opts.url } } : {}),
          ...(Object.keys(properties).length ? { properties } : {}),
        },
      ],
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn("[tiktok-events]", event, res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("[tiktok-events] failed", event, e);
  }
}
