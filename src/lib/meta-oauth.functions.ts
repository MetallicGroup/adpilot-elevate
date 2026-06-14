import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the Meta authorize URL for the currently authenticated user and
 * sets the httpOnly `meta_oauth_state` cookie. The caller's user id is taken
 * from the verified Supabase session — never trust a client-supplied value.
 */
export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
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

    return { url: buildAuthorizeUrl(state) };
  });