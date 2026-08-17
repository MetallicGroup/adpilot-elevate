import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdReadinessResult = {
  connected: boolean;
  hasAdAccount: boolean;
  hasCard: boolean;
  adAccountId: string | null;
  adAccountName: string | null;
  businessId: string | null;
  paymentUrl: string | null;
};

/** Verifică dacă userul are cont de reclame utilizabil + card. Gating înainte de plan. */
export const getMetaAdReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdReadinessResult> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const empty: AdReadinessResult = {
      connected: false,
      hasAdAccount: false,
      hasCard: false,
      adAccountId: null,
      adAccountName: null,
      businessId: null,
      paymentUrl: null,
    };

    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) return empty;

    const { data: selected } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("ad_account_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { getAdAccountReadiness } = await import("@/lib/meta-ad-readiness.server");
    const r = await getAdAccountReadiness(conn.access_token, selected?.ad_account_id ?? null);
    return { connected: true, ...r };
  });

/** Creează automat un cont de reclame cu numele Paginii Facebook (dacă e posibil). */
export const autoCreateAdAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("id, access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) {
      return { ok: false as const, error: "Conectează Meta întâi.", needsManual: false };
    }

    const { data: page } = await supabaseAdmin
      .from("meta_pages")
      .select("page_name")
      .eq("user_id", userId)
      .order("is_active", { ascending: false })
      .limit(1)
      .maybeSingle();
    const name = page?.page_name || "AdPilot";

    const { createAdAccountViaMeta, paymentSettingsUrl } = await import("@/lib/meta-ad-readiness.server");
    const res = await createAdAccountViaMeta(conn.access_token, name);
    if (!res.ok) return { ok: false as const, error: res.error, needsManual: res.needsManual };

    // Salvează contul creat și marchează-l ca activ (deselectează restul).
    await supabaseAdmin.from("meta_ad_accounts").upsert(
      {
        user_id: userId,
        connection_id: conn.id,
        ad_account_id: res.adAccountId,
        account_name: name,
        status: "1",
        is_active: true,
      },
      { onConflict: "user_id,ad_account_id" },
    );
    await supabaseAdmin
      .from("meta_ad_accounts")
      .update({ is_active: false })
      .eq("user_id", userId)
      .neq("ad_account_id", res.adAccountId);

    return {
      ok: true as const,
      adAccountId: res.adAccountId,
      paymentUrl: paymentSettingsUrl(res.adAccountId),
    };
  });
