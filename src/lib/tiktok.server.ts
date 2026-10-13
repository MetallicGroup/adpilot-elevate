/**
 * TikTok Marketing API (TikTok API for Business) — config + OAuth + apeluri de bază.
 * Credențialele vin doar din env (TIKTOK_APP_ID / TIKTOK_APP_SECRET / TIKTOK_REDIRECT_URI).
 */
const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

export function tiktokConfigured() {
  return Boolean(
    process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_REDIRECT_URI,
  );
}

export function tiktokAppId() {
  const id = process.env.TIKTOK_APP_ID;
  if (!id) throw new Error("TIKTOK_APP_ID is not set");
  return id;
}

function tiktokAppSecret() {
  const s = process.env.TIKTOK_APP_SECRET;
  if (!s) throw new Error("TIKTOK_APP_SECRET is not set");
  return s;
}

export function tiktokRedirectUri() {
  const r = process.env.TIKTOK_REDIRECT_URI;
  if (!r) throw new Error("TIKTOK_REDIRECT_URI is not set");
  return r;
}

export function buildTikTokAuthorizeUrl(state: string) {
  const url = new URL("https://business-api.tiktok.com/portal/auth");
  url.searchParams.set("app_id", tiktokAppId());
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", tiktokRedirectUri());
  return url.toString();
}

type TikTokEnvelope<T> = { code: number; message: string; data: T };

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as TikTokEnvelope<T> | null;
  if (!res.ok || !json || json.code !== 0) {
    throw new Error(`TikTok API error: ${json?.message ?? `HTTP ${res.status}`}`);
  }
  return json.data;
}

/** Schimbă `auth_code` pe un access token (tokenul de advertiser nu expiră). */
export async function exchangeTikTokAuthCode(authCode: string) {
  const res = await fetch(`${TIKTOK_API}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: tiktokAppId(),
      secret: tiktokAppSecret(),
      auth_code: authCode,
    }),
  });
  return unwrap<{ access_token: string; advertiser_ids?: string[]; scope?: number[] }>(res);
}

export type TikTokAdvertiser = {
  advertiser_id: string;
  name?: string;
  currency?: string;
  timezone?: string;
  status?: string;
};

export async function fetchTikTokAdvertisers(accessToken: string, advertiserIds: string[]) {
  if (!advertiserIds.length) return [] as TikTokAdvertiser[];
  const url = new URL(`${TIKTOK_API}/advertiser/info/`);
  url.searchParams.set("advertiser_ids", JSON.stringify(advertiserIds.slice(0, 100)));
  url.searchParams.set(
    "fields",
    JSON.stringify(["advertiser_id", "name", "currency", "timezone", "status"]),
  );
  const res = await fetch(url, { headers: { "Access-Token": accessToken } });
  const data = await unwrap<{ list?: TikTokAdvertiser[] }>(res);
  return data.list ?? [];
}
