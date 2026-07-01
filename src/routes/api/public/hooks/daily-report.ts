import { createFileRoute } from "@tanstack/react-router";

/** Cron-only. Triggered by pg_cron with apikey header = anon key. */
export const Route = createFileRoute("/api/public/hooks/daily-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        // TEMP: disabled during Meta App Review to prevent background API errors
        return Response.json({ ok: true, disabled: true, reason: "meta-review-quiet-period" });
      },
    },
  },
});
