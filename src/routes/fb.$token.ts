import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";

/**
 * Linkul personal de conectare Facebook trimis pe WhatsApp (/fb/<token>). Pornește OAuth-ul
 * Meta pentru userul din link; revenirea pe `/api/meta/auth/callback` salvează conexiunea
 * și trimite omul pe /conectat.
 */
export const Route = createFileRoute("/fb/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { verifyMetaConnectToken } = await import("@/lib/connect-link.server");
        const userId = verifyMetaConnectToken(params.token);
        if (!userId) {
          return new Response(null, { status: 302, headers: { Location: "/conectat?meta=expired" } });
        }
        const { buildAuthorizeUrl } = await import("@/lib/meta.server");
        const state = `${userId}.${randomBytes(16).toString("hex")}`;
        const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 15 };
        setCookie("meta_oauth_state", state, cookie);
        setCookie("meta_oauth_return", "/conectat", cookie);
        return new Response(null, { status: 302, headers: { Location: buildAuthorizeUrl(state) } });
      },
    },
  },
});
