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
            fetchMetaPermissions,
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
          const permissions = await fetchMetaPermissions(accessToken);
          const granted = new Set(
            (permissions?.data ?? [])
              .filter((p: any) => p.status === "granted")
              .map((p: any) => p.permission),
          );
          if (!granted.has("pages_manage_ads")) {
            return back("meta=error&reason=pages_manage_ads_missing");
          }
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
            const adData = ads?.data ?? [];
            const fallbackAdAccountId =
              adData.find((a: any) => a.account_status === 1)?.account_id ?? adData[0]?.account_id;
            const rows = adData.map((a: any) => ({
              user_id: userId,
              connection_id: conn.id,
              ad_account_id: a.account_id,
              account_name: a.name ?? null,
              currency: a.currency ?? null,
              timezone_name: a.timezone_name ?? null,
              status: a.account_status ?? null,
              is_active: fallbackAdAccountId === a.account_id,
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
            const pageData = pages?.data ?? [];
            const fallbackPageId = pageData[0]?.id;
            const rows = pageData.map((p: any) => ({
              user_id: userId,
              connection_id: conn.id,
              page_id: p.id,
              page_name: p.name ?? null,
              category: p.category ?? null,
              page_access_token: p.access_token ?? null,
              is_active: fallbackPageId === p.id,
            }));
            if (rows.length) {
              await supabaseAdmin
                .from("meta_pages")
                .upsert(rows, { onConflict: "connection_id,page_id" });
            }

            // Subscribe app to `leadgen` webhooks for each page so leads flow in automatically.
            const { metaApiVersion } = await import("@/lib/meta.server");
            const version = metaApiVersion();
            await Promise.all(
              pageData
                .filter((p: any) => p.id && p.access_token)
                .map(async (p: any) => {
                  try {
                    const subUrl = new URL(
                      `https://graph.facebook.com/${version}/${p.id}/subscribed_apps`,
                    );
                    subUrl.searchParams.set("subscribed_fields", "leadgen");
                    subUrl.searchParams.set("access_token", p.access_token);
                    const res = await fetch(subUrl.toString(), { method: "POST" });
                    if (!res.ok) {
                      console.warn(
                        `[meta] subscribed_apps failed for page ${p.id}: ${res.status} ${await res.text()}`,
                      );
                    }
                  } catch (err) {
                    console.warn(`[meta] subscribed_apps error for page ${p.id}`, err);
                  }
                }),
            );
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