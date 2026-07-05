import { validateOAuthConfig } from "./oauth-config.functions";
import { authCallbackUrl } from "./auth";

let didRun = false;

/**
 * Runs once on app boot in the browser. Verifies that OAuth redirect URIs
 * (Google via Lovable, Meta and TikTok via env) are consistent with the
 * app origin and expected callback routes, and logs actionable warnings
 * so we don't hit provider-side `invalid_request` errors in production.
 */
export function runOAuthConfigCheck() {
  if (didRun || typeof window === "undefined") return;
  didRun = true;

  const appOrigin = window.location.origin;

  // Google (client-side): the Lovable OAuth broker uses window.location.origin
  // as redirect_uri. Just sanity-check the callback route we advertise.
  try {
    const cb = new URL(authCallbackUrl());
    if (cb.origin !== appOrigin) {
      console.warn(
        `[oauth-config] Google callback origin "${cb.origin}" differs from app origin "${appOrigin}"`,
      );
    }
    if (cb.protocol !== "https:" && cb.hostname !== "localhost") {
      console.warn(`[oauth-config] Google callback should use https, got ${cb.protocol}`);
    }
  } catch (err) {
    console.warn("[oauth-config] Failed to parse Google callback URL", err);
  }

  // Server-side providers (Meta/TikTok). Non-blocking.
  validateOAuthConfig({ data: { appOrigin } })
    .then((res) => {
      for (const check of res.checks) {
        if (!check.configured) continue;
        if (check.issues.length === 0) continue;
        console.warn(
          `[oauth-config] ${check.provider} redirect_uri misconfigured — this will cause invalid_request errors:`,
          {
            redirectUri: check.redirectUri,
            expectedPath: check.expectedPath,
            appOrigin: res.appOrigin,
            issues: check.issues,
          },
        );
      }
    })
    .catch((err) => {
      console.warn("[oauth-config] validation call failed", err);
    });
}