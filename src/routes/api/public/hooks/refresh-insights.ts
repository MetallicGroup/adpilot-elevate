import { createFileRoute } from "@tanstack/react-router";

/** Cron — every minute. Refreshes performance_data for all active Meta campaigns. */
export const Route = createFileRoute("/api/public/hooks/refresh-insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key =
          request.headers.get("apikey") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!key || !expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { refreshAllInsights } = await import("@/lib/wa-periodic.server");
        const result = await refreshAllInsights();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});