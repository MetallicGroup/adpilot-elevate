import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";

/**
 * Signup/login cu Facebook care conectează ȘI ads-ul într-un singur dialog.
 * Public (fără sesiune): pornește OAuth-ul Meta cu scope-urile de ads + `email`.
 * Revenirea se face pe același redirect înregistrat (`/api/meta/auth/callback`),
 * unde un `state` care începe cu `signup.` declanșează crearea/legarea contului.
 */
export const Route = createFileRoute("/api/meta/signup/start")({
  server: {
    handlers: {
      GET: async () => {
        const { buildAuthorizeUrl } = await import("@/lib/meta.server");

        const nonce = randomBytes(16).toString("hex");
        const state = `signup.${nonce}`;

        setCookie("meta_oauth_state", state, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 10,
        });
        // Dacă ceva pică și ajungem la ramura `back()`, trimitem în onboarding.
        setCookie("meta_oauth_return", "/onboarding", {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 10,
        });

        const url = buildAuthorizeUrl(state);
        return new Response(null, { status: 302, headers: { Location: url } });
      },
    },
  },
});
