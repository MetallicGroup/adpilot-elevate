import { createServerFn } from "@tanstack/react-start";

type ProviderCheck = {
  provider: "meta" | "tiktok" | "google";
  configured: boolean;
  redirectUri: string | null;
  expectedPath: string;
  issues: string[];
};

function checkProvider(
  provider: ProviderCheck["provider"],
  redirectUri: string | undefined | null,
  appOrigin: string,
  expectedPath: string,
): ProviderCheck {
  const issues: string[] = [];
  if (!redirectUri) {
    return {
      provider,
      configured: false,
      redirectUri: null,
      expectedPath,
      issues: [],
    };
  }

  let parsed: URL | null = null;
  try {
    parsed = new URL(redirectUri);
  } catch {
    issues.push(`redirect_uri is not a valid URL: ${redirectUri}`);
  }

  if (parsed) {
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      issues.push(`redirect_uri must use https (got ${parsed.protocol})`);
    }
    if (parsed.pathname.replace(/\/$/, "") !== expectedPath.replace(/\/$/, "")) {
      issues.push(
        `redirect_uri path is "${parsed.pathname}" but the app callback route is "${expectedPath}"`,
      );
    }
    try {
      const appUrl = new URL(appOrigin);
      if (parsed.host !== appUrl.host && appUrl.hostname !== "localhost") {
        issues.push(
          `redirect_uri host "${parsed.host}" differs from app host "${appUrl.host}"`,
        );
      }
    } catch {
      // ignore invalid appOrigin
    }
  }

  return {
    provider,
    configured: true,
    redirectUri,
    expectedPath,
    issues,
  };
}

export const validateOAuthConfig = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { appOrigin?: string };
    return { appOrigin: typeof d.appOrigin === "string" ? d.appOrigin : "" };
  })
  .handler(async ({ data }) => {
    const appOrigin = data.appOrigin || "";
    const checks: ProviderCheck[] = [
      checkProvider("meta", process.env.META_REDIRECT_URI, appOrigin, "/api/meta/auth/callback"),
      checkProvider("tiktok", process.env.TIKTOK_REDIRECT_URI, appOrigin, "/api/tiktok/auth/callback"),
    ];
    return { appOrigin, checks };
  });