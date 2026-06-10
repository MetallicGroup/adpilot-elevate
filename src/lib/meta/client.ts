import { getMetaConfig, getMetaGraphBase } from "./config.server";

type GraphRequestInit = {
  method?: string;
  body?: Record<string, unknown>;
  accessToken: string;
};

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly subcode?: number,
    public readonly type?: string,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export async function metaGraphRequest<T>(
  path: string,
  { method = "GET", body, accessToken }: GraphRequestInit,
): Promise<T> {
  const { apiVersion } = getMetaConfig();
  const base = getMetaGraphBase(apiVersion);
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (method === "GET") {
    url.searchParams.set("access_token", accessToken);
    if (body) {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
        }
      }
    }
  } else {
    const form = new URLSearchParams();
    form.set("access_token", accessToken);
    if (body) {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          form.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
        }
      }
    }
    init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    init.body = form.toString();
  }

  const response = await fetch(url.toString(), init);
  const json = (await response.json()) as T & {
    error?: { message: string; code?: number; error_subcode?: number; type?: string };
  };

  if (!response.ok || json.error) {
    const err = json.error;
    throw new MetaApiError(
      err?.message ?? `Meta API request failed (${response.status})`,
      err?.code,
      err?.error_subcode,
      err?.type,
    );
  }

  return json;
}

export async function exchangeCodeForToken(code: string) {
  const { appId, appSecret, redirectUri, apiVersion } = getMetaConfig();
  const url = new URL(`${getMetaGraphBase(apiVersion)}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString());
  const json = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message: string };
  };

  if (!response.ok || !json.access_token) {
    throw new MetaApiError(json.error?.message ?? "Failed to exchange OAuth code");
  }

  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
  };
}

export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const { appId, appSecret, apiVersion } = getMetaConfig();
  const url = new URL(`${getMetaGraphBase(apiVersion)}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url.toString());
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };

  if (!response.ok || !json.access_token) {
    throw new MetaApiError(json.error?.message ?? "Failed to get long-lived token");
  }

  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
  };
}
