import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";

/**
 * Pornește OAuth-ul Facebook pentru un CLIENT care se conectează la o agenție,
 * prin /connect/[slug]. Nu creează user — callback-ul (state `agency.<slug>...`)
 * salvează în agency_clients. Fără login necesar.
 */
export const Route = createFileRoute("/api/agency/connect/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
        if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) {
          return new Response("Bad slug", { status: 400 });
        }
        const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
        const supabaseAdmin: any = _sa;
        const { data: ag } = await supabaseAdmin
          .from("agencies")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!ag) return new Response("Agency not found", { status: 404 });

        const { buildAuthorizeUrl } = await import("@/lib/meta.server");
        const nonce = randomBytes(16).toString("hex");
        const state = `agency.${slug}.${nonce}`;
        setCookie("meta_oauth_state", state, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 10,
        });
        return new Response(null, { status: 302, headers: { Location: buildAuthorizeUrl(state) } });
      },
    },
  },
});
