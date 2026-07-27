import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/debug-meta-token")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("meta_connections")
          .select("id, user_id, access_token, updated_at")
          .eq("is_active", true)
          .order("updated_at", { ascending: false });

        const appId = process.env.META_APP_ID!;
        const appSecret = process.env.META_APP_SECRET!;
        const appToken = `${appId}|${appSecret}`;

        const results = [];
        for (const c of data ?? []) {
          if (!c.access_token) {
            results.push({ user_id: c.user_id, error: "no_token" });
            continue;
          }
          const r = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(c.access_token)}&access_token=${encodeURIComponent(appToken)}`,
          );
          const j: any = await r.json();
          results.push({
            user_id: c.user_id,
            token_app_id: j?.data?.app_id,
            is_valid: j?.data?.is_valid,
            expires_at: j?.data?.expires_at,
            scopes_count: j?.data?.scopes?.length,
            error: j?.data?.error ?? j?.error,
          });
        }

        return new Response(
          JSON.stringify({ configured_app_id: appId, connections: results }, null, 2),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});