import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";

export const Route = createFileRoute("/api/meta/auth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("uid");
        if (!userId) return new Response("Missing uid", { status: 400 });

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