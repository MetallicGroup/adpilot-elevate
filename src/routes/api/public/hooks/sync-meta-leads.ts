import { createFileRoute } from "@tanstack/react-router";

/** Cron — every 3 minutes. Incremental Meta lead sync (no webhook required). */
export const Route = createFileRoute("/api/public/hooks/sync-meta-leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronAuth } = await import("@/lib/cron-auth.server");
        if (!verifyCronAuth(request)) return new Response("Unauthorized", { status: 401 });
        const { syncAllMetaLeads } = await import("@/lib/leads-sync.server");
        const result = await syncAllMetaLeads();
        // Closer: reamintirea de la 10 minute și „A venit?” de a doua zi.
        let followups: { reminded: number; asked: number } | { error: string };
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runLeadFollowups } = await import("@/lib/lead-closer.server");
          followups = await runLeadFollowups(supabaseAdmin);
        } catch (e) {
          followups = { error: (e as Error).message };
        }
        return Response.json({ ok: true, ...result, followups });
      },
    },
  },
});
