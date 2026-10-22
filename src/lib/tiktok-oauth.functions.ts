import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TikTokStatus = {
  configured: boolean;
  connection: { id: string; created_at: string } | null;
  advertisers: Array<{
    id: string;
    advertiser_id: string;
    advertiser_name: string | null;
    currency: string | null;
    is_active: boolean;
  }>;
};

/** Starea integrării TikTok pentru userul curent (fără token). */
export const getTikTokStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TikTokStatus> => {
    const { tiktokConfigured } = await import("@/lib/tiktok.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: conn } = await db
      .from("tiktok_connections")
      .select("id, created_at")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn) return { configured: tiktokConfigured(), connection: null, advertisers: [] };

    const { data: advertisers } = await db
      .from("tiktok_advertisers")
      .select("id, advertiser_id, advertiser_name, currency, is_active")
      .eq("connection_id", conn.id)
      .order("advertiser_name");
    return { configured: tiktokConfigured(), connection: conn, advertisers: advertisers ?? [] };
  });

/**
 * Întoarce URL-ul de autorizare TikTok pentru userul logat și setează cookie-ul
 * httpOnly `tiktok_oauth_state`. User id-ul vine din sesiunea verificată.
 */
export const startTikTokOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { returnTo?: string };
    return { returnTo: d.returnTo === "/start" ? "/start" : "/settings" };
  })
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const { buildTikTokAuthorizeUrl } = await import("@/lib/tiktok.server");
    const state = `${context.userId}.${randomBytes(16).toString("hex")}`;
    setCookie("tiktok_oauth_return", data.returnTo, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    setCookie("tiktok_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return { url: buildTikTokAuthorizeUrl(state) };
  });

export const selectTikTokAdvertiser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { advertiserRowId?: string };
    if (typeof d.advertiserRowId !== "string" || !d.advertiserRowId) {
      throw new Error("advertiserRowId lipsă");
    }
    return { advertiserRowId: d.advertiserRowId };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    await db.from("tiktok_advertisers").update({ is_active: false }).eq("user_id", context.userId);
    const { error } = await db
      .from("tiktok_advertisers")
      .update({ is_active: true })
      .eq("user_id", context.userId)
      .eq("id", data.advertiserRowId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("tiktok_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
