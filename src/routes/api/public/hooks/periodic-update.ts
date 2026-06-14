import { createFileRoute } from "@tanstack/react-router";

/** Cron — every 30 min. Sends per-campaign WhatsApp pulse to each user. */
export const Route = createFileRoute("/api/public/hooks/periodic-update")({
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
        const { runPeriodicUpdates } = await import("@/lib/wa-periodic.server");
        const result = await runPeriodicUpdates();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});