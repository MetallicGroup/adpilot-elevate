import { createFileRoute } from "@tanstack/react-router";

/**
 * Redirect-ul pentru autorizarea contului TikTok (profilul de pe care rulează reclama).
 * Înregistrat în aplicația TikTok; fluxul nu e implementat încă, așa că doar
 * întoarcem userul în Setări cu un mesaj clar, fără să stocăm nimic.
 */
export const Route = createFileRoute("/api/tiktok/account/callback")({
  server: {
    handlers: {
      GET: async () =>
        new Response(null, {
          status: 302,
          headers: { Location: "/settings?tiktok=error&reason=account_flow_unavailable" },
        }),
    },
  },
});
