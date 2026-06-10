import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/meta/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const back = (q: string) =>
          new Response(null, { status: 302, headers: { Location: `/settings?${q}` } });

        if (error) return back(`meta=error&reason=${encodeURIComponent(error)}`);
        if (!code || !state) return back("meta=error&reason=missing_params");

        const cookieState = getCookie("meta_oauth_state");
        if (!cookieState || cookieState !== state) return back("meta=error&reason=bad_state");
        deleteCookie("meta_oauth_state", { path: "/" });

        const userId = state.split(".")[0];
        if (!userId) return back("meta=error&reason=bad_state");

        try {
          const {
            exchangeCodeForToken,
            exchangeForLongLivedToken,
            fetchMetaUser,
            fetchAdAccounts,
            fetchPages,
            META_SCOPES,
          } = await import("@/lib/meta.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const short = await exchangeCodeForToken(code);
          let accessToken = short.access_token;
          let expiresIn = short.expires_in;
          try {
            const long = await exchangeForLongLivedToken(accessToken);
            accessToken = long.access_token;
            expiresIn = long.expires_in;
          } catch {
            // Long-lived exchange is optional; keep short-lived token.
          }

          const me = await fetchMetaUser(accessToken);
          const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

          const { data: conn, error: connErr } = await supabaseAdmin
            .from("meta_connections")
            .upsert(
              {
                user_id: userId,
                meta_user_id: me.id,
                meta_user_name: me.name ?? null,
                access_token: accessToken,
                token_expires_at: expiresAt,
                scopes: META_SCOPES.join(","),
                is_active: true,
              },
              { onConflict: "user_id,meta_user_id" },
            )
            .select("id")
            .single();
          if (connErr || !conn) throw new Error(connErr?.message ?? "Failed to save connection");

          // Sync ad accounts (best-effort)
          try {
            const ads = await fetchAdAccounts(accessToken);
            const rows = (ads?.data ?? []).map((a: any) => ({
              user_id: userId,
              connection_id: conn.id,
              ad_account_id: a.account_id,
              account_name: a.name ?? null,
              currency: a.currency ?? null,
              timezone_name: a.timezone_name ?? null,
              status: a.account_status ?? null,
              is_active: true,
            }));
            if (rows.length) {
              await supabaseAdmin
                .from("meta_ad_accounts")
                .upsert(rows, { onConflict: "connection_id,ad_account_id" });
            }
          } catch (e) {
            console.warn("Meta ad accounts sync failed", e);
          }

          // Sync pages (best-effort)
          try {
            const pages = await fetchPages(accessToken);
            const rows = (pages?.data ?? []).map((p: any) => ({
              user_id: userId,
              connection_id: conn.id,
              page_id: p.id,
              page_name: p.name ?? null,
              category: p.category ?? null,
              page_access_token: p.access_token ?? null,
              is_active: true,
            }));
            if (rows.length) {
              await supabaseAdmin
                .from("meta_pages")
                .upsert(rows, { onConflict: "connection_id,page_id" });
            }
          } catch (e) {
            console.warn("Meta pages sync failed", e);
          }

          return back("meta=connected");
        } catch (e) {
          console.error("Meta OAuth callback error", e);
          return back("meta=error&reason=callback_failed");
        }
      },
    },
  },
});