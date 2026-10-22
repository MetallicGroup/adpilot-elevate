import { createFileRoute } from "@tanstack/react-router";

/** Cron — în fiecare minut. Avansează clipurile demo din onboarding și trimite șablonul celor gata. */
export const Route = createFileRoute("/api/public/hooks/demo-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { tickDemos } = await import("@/lib/demo-video.server");
        const result = await tickDemos();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
