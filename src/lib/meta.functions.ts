import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Re-sync ad accounts + pages for a given Meta connection by calling the
 * Meta Graph API with the stored (server-only) access token.
 */
export const resyncMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ connectionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAdAccounts, fetchPages } = await import("@/lib/meta.server");

    const { data: conn, error } = await supabaseAdmin
      .from("meta_connections")
      .select("id, user_id, access_token")
      .eq("id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conn || !conn.access_token) throw new Error("Connection not found");

    const ads = await fetchAdAccounts(conn.access_token);
    const adRows = (ads?.data ?? []).map((a: any) => ({
      user_id: userId,
      connection_id: conn.id,
      ad_account_id: a.account_id,
      account_name: a.name ?? null,
      currency: a.currency ?? null,
      timezone_name: a.timezone_name ?? null,
      status: a.account_status ?? null,
      is_active: true,
    }));
    if (adRows.length) {
      await supabaseAdmin
        .from("meta_ad_accounts")
        .upsert(adRows, { onConflict: "connection_id,ad_account_id" });
    }

    const pages = await fetchPages(conn.access_token);
    const pageRows = (pages?.data ?? []).map((p: any) => ({
      user_id: userId,
      connection_id: conn.id,
      page_id: p.id,
      page_name: p.name ?? null,
      category: p.category ?? null,
      page_access_token: p.access_token ?? null,
      is_active: true,
    }));
    if (pageRows.length) {
      await supabaseAdmin
        .from("meta_pages")
        .upsert(pageRows, { onConflict: "connection_id,page_id" });
    }

    return { adAccounts: adRows.length, pages: pageRows.length };
  });