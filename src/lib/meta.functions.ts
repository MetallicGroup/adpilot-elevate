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

    const { data: selectedAd } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("ad_account_id")
      .eq("user_id", userId)
      .eq("connection_id", conn.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { data: selectedPage } = await supabaseAdmin
      .from("meta_pages")
      .select("page_id")
      .eq("user_id", userId)
      .eq("connection_id", conn.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const ads = await fetchAdAccounts(conn.access_token);
    const adRows = (ads?.data ?? []).map((a: any) => ({
      user_id: userId,
      connection_id: conn.id,
      ad_account_id: a.account_id,
      account_name: a.name ?? null,
      currency: a.currency ?? null,
      timezone_name: a.timezone_name ?? null,
      status: a.account_status ?? null,
      is_active: selectedAd?.ad_account_id
        ? selectedAd.ad_account_id === a.account_id
        : a.account_status === 1,
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
      is_active: selectedPage?.page_id ? selectedPage.page_id === p.id : false,
    }));
    if (pageRows.length) {
      await supabaseAdmin
        .from("meta_pages")
        .upsert(pageRows, { onConflict: "connection_id,page_id" });
    }

    return { adAccounts: adRows.length, pages: pageRows.length };
  });

const SelectMetaItemInput = z.object({
  connectionId: z.string().uuid(),
  rowId: z.string().uuid(),
});

export const selectMetaAdAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SelectMetaItemInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: account, error: findError } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("id")
      .eq("id", data.rowId)
      .eq("connection_id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!account) throw new Error("Ad account not found");

    const { error: clearError } = await supabaseAdmin
      .from("meta_ad_accounts")
      .update({ is_active: false })
      .eq("connection_id", data.connectionId)
      .eq("user_id", userId);
    if (clearError) throw new Error(clearError.message);

    const { error: selectError } = await supabaseAdmin
      .from("meta_ad_accounts")
      .update({ is_active: true })
      .eq("id", data.rowId)
      .eq("user_id", userId);
    if (selectError) throw new Error(selectError.message);

    return { ok: true };
  });

export const selectMetaPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SelectMetaItemInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: page, error: findError } = await supabaseAdmin
      .from("meta_pages")
      .select("id")
      .eq("id", data.rowId)
      .eq("connection_id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!page) throw new Error("Page not found");

    const { error: clearError } = await supabaseAdmin
      .from("meta_pages")
      .update({ is_active: false })
      .eq("connection_id", data.connectionId)
      .eq("user_id", userId);
    if (clearError) throw new Error(clearError.message);

    const { error: selectError } = await supabaseAdmin
      .from("meta_pages")
      .update({ is_active: true })
      .eq("id", data.rowId)
      .eq("user_id", userId);
    if (selectError) throw new Error(selectError.message);

    return { ok: true };
  });