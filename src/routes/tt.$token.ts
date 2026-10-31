import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";

/**
 * Linkul personal de conectare TikTok trimis pe WhatsApp (/tt/<token>). Pornește OAuth-ul
 * TikTok pentru userul din link; revenirea salvează conexiunea și trimite omul pe /conectat.
 */
export const Route = createFileRoute("/tt/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { verifyMetaConnectToken } = await import("@/lib/connect-link.server");
        const userId = verifyMetaConnectToken(params.token);
        if (!userId) {
          return new Response(null, { status: 302, headers: { Location: "/conectat?tiktok=expired" } });
        }
        const { buildTikTokAuthorizeUrl } = await import("@/lib/tiktok.server");
        const state = `${userId}.${randomBytes(16).toString("hex")}`;
        const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 10 };
        setCookie("tiktok_oauth_state", state, cookie);
        setCookie("tiktok_oauth_return", "/conectat", cookie);
        return new Response(null, { status: 302, headers: { Location: buildTikTokAuthorizeUrl(state) } });
      },
    },
  },
});
