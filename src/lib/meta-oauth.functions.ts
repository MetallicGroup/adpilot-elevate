import { createServerFn } from "@tanstack/react-start";
import { setCookie, getRequest } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_RETURN = new Set(["/settings", "/onboarding"]);

/**
 * Returns the Meta authorize URL for the currently authenticated user and
 * sets the httpOnly `meta_oauth_state` cookie. The caller's user id is taken
 * from the verified Supabase session — never trust a client-supplied value.
 */
export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { returnTo?: string };
    const rt = typeof d.returnTo === "string" && ALLOWED_RETURN.has(d.returnTo)
      ? d.returnTo
      : "/settings";
    return { returnTo: rt };
  })
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const { userId } = context;
    const { buildAuthorizeUrl } = await import("@/lib/meta.server");

    const nonce = randomBytes(16).toString("hex");
    const state = `${userId}.${nonce}`;

    setCookie("meta_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    setCookie("meta_oauth_return", data.returnTo, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return { url: buildAuthorizeUrl(state) };
  });

/**
 * Config public pentru SDK-ul JS de Facebook (App ID + versiune + scopuri).
 * App ID e public (apare oricum în URL-ul de OAuth). Fără auth — folosit la signup.
 */
export const getMetaPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { metaAppId, metaApiVersion, META_SCOPES } = await import("@/lib/meta.server");
  return {
    appId: metaAppId(),
    apiVersion: metaApiVersion(),
    scopes: [...META_SCOPES, "email", "public_profile"].join(","),
  };
});

/**
 * Finalizează signup-ul cu Facebook pornind de la un access token obținut prin
 * SDK-ul JS (pe mobil, dialogul se poate deschide în aplicația Facebook).
 * Verifică întâi că tokenul e emis pentru app-ul nostru (anti-injection), apoi
 * creează/leagă contul și întoarce magic link-ul de sesiune.
 */
export const completeFacebookSignup = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { accessToken?: string };
    const t = typeof d.accessToken === "string" ? d.accessToken.trim() : "";
    if (t.length < 20 || t.length > 1000) throw new Error("Invalid token");
    return { accessToken: t };
  })
  .handler(async ({ data }) => {
    const { metaAppId, metaAppSecret, exchangeForLongLivedToken } = await import("@/lib/meta.server");
    const { finishFacebookSignup } = await import("@/lib/facebook-signup.server");

    // 1) Verifică faptul că tokenul aparține app-ului nostru (nu unui alt app).
    const appToken = `${metaAppId()}|${metaAppSecret()}`;
    const dbg = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(data.accessToken)}&access_token=${encodeURIComponent(appToken)}`,
    )
      .then((r) => r.json())
      .catch(() => null);
    const info = dbg?.data;
    if (!info?.is_valid || String(info?.app_id) !== String(metaAppId())) {
      return { ok: false as const, reason: "bad_token" as const };
    }

    // 2) Long-lived exchange (best-effort).
    let token = data.accessToken;
    let expiresIn: number | null = null;
    try {
      const long = await exchangeForLongLivedToken(token);
      token = long.access_token;
      expiresIn = long.expires_in ?? null;
    } catch {
      /* păstrăm tokenul scurt */
    }

    // 3) Origin pentru redirect-ul magic link-ului.
    let origin = "https://www.adpilot.ro";
    try {
      const req = getRequest();
      if (req?.url) origin = new URL(req.url).origin;
    } catch {
      /* fallback pe domeniul prod */
    }

    return finishFacebookSignup({ accessToken: token, expiresIn, origin });
  });