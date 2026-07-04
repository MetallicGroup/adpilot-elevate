import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron — every hour.
 * Keeps the WhatsApp 24h customer service window alive by sending a
 * short feedback question to users who have gone silent close to the 24h mark.
 */
export const Route = createFileRoute("/api/public/hooks/wa-keepalive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { runWhatsAppKeepalive } = await import("@/lib/wa-keepalive.server");
        const result = await runWhatsAppKeepalive();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});