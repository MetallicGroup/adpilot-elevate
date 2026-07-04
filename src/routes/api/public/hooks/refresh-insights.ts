import { createFileRoute } from "@tanstack/react-router";

/** Cron — every minute. Refreshes performance_data for all active Meta campaigns. */
export const Route = createFileRoute("/api/public/hooks/refresh-insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { refreshAllInsights } = await import("@/lib/wa-periodic.server");
        const result = await refreshAllInsights();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});