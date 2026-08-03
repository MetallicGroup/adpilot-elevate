// @ts-nocheck
// TEMP diagnostic route — remove after debugging.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/diag-page")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("k") !== "adpilot-diag-2026") {
          return new Response("no", { status: 401 });
        }
        const { data: p } = await supabaseAdmin
          .from("meta_pages")
          .select("page_id,page_access_token,connection_id")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (!p) return Response.json({ error: "no page" });
        const { data: c } = await supabaseAdmin
          .from("meta_connections")
          .select("access_token")
          .eq("id", p.connection_id)
          .maybeSingle();
        const v = "v20.0";
        const g = async (u: string) =>
          (await fetch(`https://graph.facebook.com/${v}${u}`)).json();
        const out: Record<string, unknown> = { page_id: p.page_id };
        out.page = await g(`/${p.page_id}?fields=id,name,tasks&access_token=${encodeURIComponent(p.page_access_token)}`);
        out.userPerms = (await g(`/me/permissions?access_token=${encodeURIComponent(c!.access_token)}`)).data;
        out.debugPageToken = (await g(`/debug_token?input_token=${encodeURIComponent(p.page_access_token)}&access_token=${encodeURIComponent(c!.access_token)}`)).data;
        out.formsRead = await g(`/${p.page_id}/leadgen_forms?limit=1&access_token=${encodeURIComponent(p.page_access_token)}`);
        return Response.json(out);
      },
    },
  },
});
