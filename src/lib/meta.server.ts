/**
 * Server-only Meta Graph API helpers. The `.server.ts` extension prevents
 * this module from being bundled into any client chunk.
 */

const GRAPH_BASE = "https://graph.facebook.com";

export function metaApiVersion() {
  return process.env.META_API_VERSION || "v20.0";
}

export function metaAppId() {
  const id = process.env.META_APP_ID;
  if (!id) throw new Error("META_APP_ID is not configured");
  return id;
}

export function metaAppSecret() {
  const s = process.env.META_APP_SECRET;
  if (!s) throw new Error("META_APP_SECRET is not configured");
  return s;
}

export function metaRedirectUri() {
  const r = process.env.META_REDIRECT_URI;
  if (!r) throw new Error("META_REDIRECT_URI is not configured");
  return r;
}

export const META_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "leads_retrieval",
  "pages_read_engagement",
  "pages_show_list",
];

export function buildAuthorizeUrl(state: string) {
  const url = new URL(`https://www.facebook.com/${metaApiVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const url = new URL(`${GRAPH_BASE}/${metaApiVersion()}/oauth/access_token`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("code", code);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function exchangeForLongLivedToken(shortToken: string) {
  const url = new URL(`${GRAPH_BASE}/${metaApiVersion()}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta long-lived exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in?: number; token_type?: string }>;
}

export async function metaGet(path: string, accessToken: string) {
  const url = new URL(`${GRAPH_BASE}/${metaApiVersion()}${path}`);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function fetchMetaUser(accessToken: string) {
  return metaGet("/me?fields=id,name", accessToken);
}

export async function fetchAdAccounts(accessToken: string) {
  return metaGet(
    "/me/adaccounts?fields=account_id,name,currency,timezone_name,account_status&limit=200",
    accessToken,
  );
}

export async function fetchPages(accessToken: string) {
  return metaGet("/me/accounts?fields=id,name,category,access_token&limit=200", accessToken);
}