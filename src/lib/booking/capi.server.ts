import { createHash } from "crypto";

const API_VERSION = process.env["META_API_VERSION"] || "v21.0";

function sha256(v: string) {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("40")) return digits;
  if (digits.startsWith("0")) return `4${digits}`;
  return digits;
}

export type CapiEvent = {
  eventName: "Schedule" | "Lead" | "Purchase" | "ViewContent";
  eventId: string;
  eventTime?: number;
  actionSource?: "website" | "phone_call" | "system_generated";
  eventSourceUrl?: string | null;
  value?: number | null;
  currency?: string;
  user: {
    phone?: string | null;
    email?: string | null;
    fullName?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    fbc?: string | null;
    fbp?: string | null;
  };
  customData?: Record<string, unknown>;
};

/** Trimite un eveniment către Meta Conversions API pentru dataset-ul (pixel-ul) dat. */
export async function sendCapiEvent(
  pixelId: string,
  accessToken: string,
  event: CapiEvent,
): Promise<{ ok: boolean; error?: string }> {
  const nameParts = (event.user.fullName ?? "").trim().split(/\s+/);
  const user_data: Record<string, unknown> = {};
  if (event.user.phone) user_data.ph = [sha256(normalizePhone(event.user.phone))];
  if (event.user.email) user_data.em = [sha256(event.user.email)];
  if (nameParts[0]) user_data.fn = [sha256(nameParts[0])];
  if (nameParts.length > 1) user_data.ln = [sha256(nameParts[nameParts.length - 1]!)];
  if (event.user.ip) user_data.client_ip_address = event.user.ip;
  if (event.user.userAgent) user_data.client_user_agent = event.user.userAgent;
  if (event.user.fbc) user_data.fbc = event.user.fbc;
  if (event.user.fbp) user_data.fbp = event.user.fbp;

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: event.actionSource ?? "website",
        ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
        user_data,
        custom_data: {
          currency: event.currency ?? "RON",
          ...(event.value != null ? { value: event.value } : {}),
          ...(event.customData ?? {}),
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const json: any = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "network error" };
  }
}

/** Găsește sau creează dataset-ul (pixel) folosit pentru campaniile de programări. */
export async function ensurePixelForAdAccount(
  adAccountId: string,
  accessToken: string,
  name: string,
): Promise<string> {
  const listRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/act_${adAccountId}/adspixels?fields=id,name&limit=25&access_token=${encodeURIComponent(accessToken)}`,
  );
  const list: any = await listRes.json();
  if (listRes.ok && Array.isArray(list?.data) && list.data.length) {
    const existing = list.data.find((p: any) => p.name === name) ?? list.data[0];
    if (existing?.id) return String(existing.id);
  }

  const createRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/act_${adAccountId}/adspixels?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.slice(0, 50) }),
    },
  );
  const created: any = await createRes.json();
  if (!createRes.ok || !created?.id) {
    throw new Error(created?.error?.message ?? "Nu am putut crea pixelul Meta pentru contul publicitar.");
  }
  return String(created.id);
}