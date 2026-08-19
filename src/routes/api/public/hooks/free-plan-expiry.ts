import { createFileRoute } from "@tanstack/react-router";

/** Cron (30 min): consumul planului „Starter gratuit" → pauză campanii + mesaj WhatsApp. */
export const Route = createFileRoute("/api/public/hooks/free-plan-expiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { runFreePlanExpiry } = await import("@/lib/free-plan.server");
        const result = await runFreePlanExpiry();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
