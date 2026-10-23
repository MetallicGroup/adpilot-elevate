import { createFileRoute } from "@tanstack/react-router";

/** Cron — la 30 de minute. Reamintire pe WhatsApp pentru cei opriți la jumătatea lui /start. */
export const Route = createFileRoute("/api/public/hooks/start-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { runStartReminders } = await import("@/lib/start-reminders.server");
        return Response.json({ ok: true, ...(await runStartReminders()) });
      },
    },
  },
});
