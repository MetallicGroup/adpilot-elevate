/**
 * Persistă o conexiune Meta (token + conturi de reclame + pagini) pentru un user.
 * Extras din callback-ul OAuth ca să fie refolosit și de fluxul de signup-cu-Facebook,
 * care obține tokenul în același dialog cu autentificarea.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function persistMetaConnection(params: {
  userId: string;
  accessToken: string;
  expiresIn?: number | null;
  granted: Set<string>;
  metaUser: { id: string; name?: string | null };
}): Promise<{ connectionId: string }> {
  const { userId, accessToken, expiresIn, granted, metaUser } = params;
  const {
    fetchAdAccounts,
    fetchPages,
    metaApiVersion,
    META_SCOPES,
  } = await import("@/lib/meta.server");

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  const { data: conn, error: connErr } = await supabaseAdmin
    .from("meta_connections")
    .upsert(
      {
        user_id: userId,
        meta_user_id: metaUser.id,
        meta_user_name: metaUser.name ?? null,
        access_token: accessToken,
        token_expires_at: expiresAt,
        scopes: Array.from(granted).join(",") || META_SCOPES.join(","),
        is_active: true,
      },
      { onConflict: "user_id,meta_user_id" },
    )
    .select("id")
    .single();
  if (connErr || !conn) throw new Error(connErr?.message ?? "Failed to save connection");

  // Sync ad accounts (best-effort)
  try {
    const ads = await fetchAdAccounts(accessToken);
    const adData = ads?.data ?? [];
    const fallbackAdAccountId =
      adData.find((a: any) => a.account_status === 1)?.account_id ?? adData[0]?.account_id;
    const rows = adData.map((a: any) => ({
      user_id: userId,
      connection_id: conn.id,
      ad_account_id: a.account_id,
      account_name: a.name ?? null,
      currency: a.currency ?? null,
      timezone: a.timezone_name ?? null,
      status: String(a.account_status ?? ""),
      is_active: fallbackAdAccountId === a.account_id,
    }));
    if (rows.length) {
      await supabaseAdmin
        .from("meta_ad_accounts")
        .upsert(rows, { onConflict: "user_id,ad_account_id" });
    }
  } catch (e) {
    console.warn("Meta ad accounts sync failed", e);
  }

  // Sync pages (best-effort) + abonare la leadgen
  try {
    const pages = await fetchPages(accessToken);
    const pageData = pages?.data ?? [];
    const fallbackPageId = pageData[0]?.id;
    const rows = pageData.map((p: any) => ({
      user_id: userId,
      connection_id: conn.id,
      page_id: p.id,
      page_name: p.name ?? null,
      category: p.category ?? null,
      page_access_token: p.access_token ?? null,
      is_active: fallbackPageId === p.id,
    }));
    if (rows.length) {
      await supabaseAdmin
        .from("meta_pages")
        .upsert(rows, { onConflict: "connection_id,page_id" });
    }

    const version = metaApiVersion();
    await Promise.all(
      pageData
        .filter((p: any) => p.id && p.access_token)
        .map(async (p: any) => {
          try {
            const subUrl = new URL(
              `https://graph.facebook.com/${version}/${p.id}/subscribed_apps`,
            );
            subUrl.searchParams.set("subscribed_fields", "leadgen");
            subUrl.searchParams.set("access_token", p.access_token);
            const res = await fetch(subUrl.toString(), { method: "POST" });
            if (!res.ok) {
              console.warn(
                `[meta] subscribed_apps failed for page ${p.id}: ${res.status} ${await res.text()}`,
              );
            }
          } catch (err) {
            console.warn(`[meta] subscribed_apps error for page ${p.id}`, err);
          }
        }),
    );
  } catch (e) {
    console.warn("Meta pages sync failed", e);
  }

  return { connectionId: conn.id };
}
