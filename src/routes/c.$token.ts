import { createFileRoute } from "@tanstack/react-router";

/**
 * Linkul personal din mail sau WhatsApp (/c/<token>): creează sesiunea pentru omul din link
 * și îl duce pe pagina cerută. Dacă linkul a expirat, ajunge la autentificarea cu telefonul.
 */
export const Route = createFileRoute("/c/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const go = (to: string) => new Response(null, { status: 302, headers: { Location: to } });
        const { verifyLoginLink } = await import("@/lib/login-link.server");
        const hit = verifyLoginLink(params.token);
        if (!hit) return go("/start");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(hit.userId);
        const email = u?.user?.email;
        if (!email) return go("/start");
        const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
        const hash = link?.properties?.hashed_token;
        if (error || !hash) {
          console.error("[login-link]", error?.message);
          return go("/start");
        }
        return go(`/intra?h=${encodeURIComponent(hash)}&next=${encodeURIComponent(hit.next)}`);
      },
    },
  },
});
