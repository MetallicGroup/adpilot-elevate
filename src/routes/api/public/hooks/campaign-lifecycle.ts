import { createFileRoute } from "@tanstack/react-router";

/** Cron — la ~10 minute. Aprobare / respingere / primele afișări → mesaj pe WhatsApp, o singură dată. */
export const Route = createFileRoute("/api/public/hooks/campaign-lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { runCampaignLifecycle } = await import("@/lib/campaign-lifecycle.server");
        const result = await runCampaignLifecycle();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
