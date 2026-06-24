import { createFileRoute } from "@tanstack/react-router";

/** Cron-only. Runs hourly. */
export const Route = createFileRoute("/api/public/hooks/anomaly-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { runAnomalyScan } = await import("@/lib/wa-reports.server");
        const result = await runAnomalyScan();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
