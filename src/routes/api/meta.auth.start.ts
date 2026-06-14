import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";

export const Route = createFileRoute("/api/meta/auth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Derive the user id from the authenticated session, NEVER from a
        // caller-controlled query parameter. Otherwise an attacker could
        // associate their own Meta account with another user's workspace.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data.user) return new Response("Unauthorized", { status: 401 });
        const userId = data.user.id;

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

        return new Response(null, {
          status: 302,
          headers: { Location: buildAuthorizeUrl(state) },
        });
      },
    },
  },
});