import { createFileRoute } from "@tanstack/react-router";

/** Cron-only. Runs hourly. */
export const Route = createFileRoute("/api/public/hooks/anomaly-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!key || !expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runAnomalyScan } = await import("@/lib/wa-reports.server");
        const result = await runAnomalyScan();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
