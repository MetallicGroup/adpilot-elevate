import process from "node:process";

export const META_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "leads_retrieval",
  "pages_read_engagement",
].join(",");

export function getMetaConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  const apiVersion = process.env.META_API_VERSION || "v20.0";

  if (!appId || !appSecret || !redirectUri) {
    const missing = [
      ...(!appId ? ["META_APP_ID"] : []),
      ...(!appSecret ? ["META_APP_SECRET"] : []),
      ...(!redirectUri ? ["META_REDIRECT_URI"] : []),
    ];
    throw new Error(`Missing Meta environment variable(s): ${missing.join(", ")}`);
  }

  return { appId, appSecret, redirectUri, apiVersion };
}

export function getMetaGraphBase(apiVersion?: string) {
  const version = apiVersion || process.env.META_API_VERSION || "v20.0";
  return `https://graph.facebook.com/${version}`;
}
