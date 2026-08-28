import { createFileRoute } from "@tanstack/react-router";

/** Cron (orar): drip de activare pe email (24/48/72h) pentru cei fără Facebook conectat. */
export const Route = createFileRoute("/api/public/hooks/activation-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const body: any = await request.json().catch(() => ({}));
        if (Array.isArray(body?.test_emails) && body.test_emails.length) {
          const { sendActivationTest } = await import("@/lib/activation.server");
          return Response.json({ ok: true, test: await sendActivationTest(body.test_emails) });
        }
        const { runActivationReminders } = await import("@/lib/activation.server");
        const result = await runActivationReminders();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
