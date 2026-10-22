import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";

/**
 * Revenirea din autorizarea TikTok (Marketing API). TikTok trimite `auth_code` + `state`;
 * `state` = `<userId>.<nonce>` și trebuie să fie identic cu cookie-ul httpOnly.
 */
export const Route = createFileRoute("/api/tiktok/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const authCode = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const returnTo = getCookie("tiktok_oauth_return") === "/start" ? "/start" : "/settings";
        deleteCookie("tiktok_oauth_return", { path: "/" });
        const back = (q: string) =>
          new Response(null, { status: 302, headers: { Location: `${returnTo}?${q}` } });

        if (!authCode || !state) return back("tiktok=error&reason=missing_params");

        const cookieState = getCookie("tiktok_oauth_state");
        deleteCookie("tiktok_oauth_state", { path: "/" });
        if (!cookieState || cookieState !== state) return back("tiktok=error&reason=bad_state");
        const userId = state.split(".")[0];
        if (!userId) return back("tiktok=error&reason=bad_state");

        try {
          const { exchangeTikTokAuthCode, fetchTikTokAdvertisers } = await import(
            "@/lib/tiktok.server"
          );
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any;

          const token = await exchangeTikTokAuthCode(authCode);
          const { data: conn, error: connErr } = await db
            .from("tiktok_connections")
            .upsert(
              {
                user_id: userId,
                access_token: token.access_token,
                scopes: (token.scope ?? []).join(","),
                is_active: true,
              },
              { onConflict: "user_id" },
            )
            .select("id")
            .single();
          if (connErr || !conn) throw new Error(connErr?.message ?? "Failed to save connection");

          // Sync conturi de reclame (best-effort)
          try {
            const ids = token.advertiser_ids ?? [];
            const info = await fetchTikTokAdvertisers(token.access_token, ids);
            const byId = new Map(info.map((a) => [String(a.advertiser_id), a]));
            const rows = ids.map((id, i) => {
              const a = byId.get(String(id));
              return {
                user_id: userId,
                connection_id: conn.id,
                advertiser_id: String(id),
                advertiser_name: a?.name ?? null,
                currency: a?.currency ?? null,
                timezone: a?.timezone ?? null,
                status: a?.status ?? null,
                is_active: i === 0,
              };
            });
            if (rows.length) {
              await db
                .from("tiktok_advertisers")
                .upsert(rows, { onConflict: "user_id,advertiser_id" });
            }
          } catch (e) {
            console.warn("TikTok advertisers sync failed", e);
          }

          return back("tiktok=connected");
        } catch (e) {
          console.error("TikTok OAuth callback error", e);
          return back("tiktok=error&reason=callback_failed");
        }
      },
    },
  },
});
