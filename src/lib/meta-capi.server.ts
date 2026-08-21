/**
 * Meta Conversions API (CAPI) — evenimente server-side către pixelul AdPilot.
 * Folosit pentru evenimente care se întâmplă când userul NU e pe site (ex.
 * „TrialExpired" din cron-ul de consum). PII (email) se trimite hash-uit SHA-256.
 *
 * Token: env `META_CAPI_TOKEN` (generat în Events Manager → Settings →
 * Conversions API). Dacă lipsește, funcția e no-op (nu blochează nimic).
 */
import { createHash } from "crypto";

const META_PIXEL_ID = "1700191534426325";
const GRAPH = "https://graph.facebook.com/v20.0";

function sha256(v: string): string {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

export async function sendMetaCapiEvent(
  eventName: string,
  opts: {
    email?: string | null;
    phone?: string | null;
    eventId?: string;
    eventSourceUrl?: string;
  } = {},
): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { sent: false, error: "capi_not_configured" };

  try {
    const user_data: Record<string, unknown> = {};
    if (opts.email) user_data.em = [sha256(opts.email)];
    if (opts.phone) user_data.ph = [sha256(opts.phone.replace(/[^\d+]/g, ""))];

    const body = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          ...(opts.eventId ? { event_id: opts.eventId } : {}),
          ...(opts.eventSourceUrl ? { event_source_url: opts.eventSourceUrl } : {}),
          user_data,
        },
      ],
    };

    const res = await fetch(
      `${GRAPH}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      let msg = `Meta CAPI ${res.status}`;
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        msg = j?.error?.message || msg;
      } catch {
        /* non-JSON */
      }
      console.warn("[meta-capi]", eventName, msg);
      return { sent: false, error: msg };
    }
    return { sent: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[meta-capi] failed", eventName, e);
    return { sent: false, error: err };
  }
}
