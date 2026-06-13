import { createFileRoute } from "@tanstack/react-router";

/** Cron-only. Triggered by pg_cron with apikey header = anon key. */
export const Route = createFileRoute("/api/public/hooks/daily-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!key || !expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runDailyReports } = await import("@/lib/wa-reports.server");
        const result = await runDailyReports();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
