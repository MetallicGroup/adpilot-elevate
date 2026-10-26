/**
 * Google (OAuth prin Supabase) creează contul automat la prima intrare. Înscrierile noi se fac
 * însă doar prin /start (telefon + WhatsApp), așa că un cont abia creat de Google și încă gol
 * îl ștergem imediat, iar omul e trimis la /start.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FRESH_MS = 10 * 60 * 1000;

export const discardFreshOAuthAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ discarded: boolean }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const user = data?.user;
    if (!user) return { discarded: false };
    const providers: string[] = (user.app_metadata as any)?.providers ?? [(user.app_metadata as any)?.provider];
    const fresh = Date.now() - new Date(user.created_at).getTime() < FRESH_MS;
    const onlyOAuth = providers.length > 0 && providers.every((p) => p && p !== "email" && p !== "phone");
    if (!fresh || !onlyOAuth || (user.user_metadata as any)?.signup_method === "phone") {
      return { discarded: false };
    }

    // Doar conturi complet goale: fără WhatsApp, Meta, TikTok sau abonament.
    const tables = ["whatsapp_connections", "meta_connections", "tiktok_connections", "subscriptions"];
    for (const t of tables) {
      const { count, error } = await db.from(t).select("user_id", { count: "exact", head: true }).eq("user_id", userId);
      if (error) {
        console.error("[oauth-guard] check", t, error.message);
        return { discarded: false };
      }
      if ((count ?? 0) > 0) return { discarded: false };
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[oauth-guard] delete failed", userId, error.message);
      return { discarded: false };
    }
    return { discarded: true };
  });
