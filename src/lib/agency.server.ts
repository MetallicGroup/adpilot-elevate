/**
 * Helper-e server-only pentru conturile de agenție. Datele clientului se iau
 * LIVE din Meta cu tokenul clientului (nu din DB-ul nostru) — deci nu atingem
 * fluxul business. Toate verifică proprietatea (agenția logată deține clientul).
 */
import { supabaseAdmin as _supabaseAdmin } from "@/integrations/supabase/client.server";
import { metaApiVersion } from "@/lib/meta.server";

// Tabelele agency* nu-s încă în tipurile generate Supabase → any (ca în restul repo-ului).
const supabaseAdmin: any = _supabaseAdmin;

const GRAPH = "https://graph.facebook.com";

export type AgencyClientRow = {
  id: string;
  agency_id: string;
  client_name: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  access_token: string | null;
  status: string;
};

/** Agenția userului logat (sau null). */
export async function getOwnerAgency(ownerUserId: string) {
  const { data } = await supabaseAdmin
    .from("agencies")
    .select("id, name, slug, logo_url, white_label_enabled, client_slots, extra_slots")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  return data;
}

/** Clientul, DOAR dacă agenția userului logat îl deține. Include tokenul (server-only). */
export async function getClientForOwner(
  ownerUserId: string,
  clientId: string,
): Promise<AgencyClientRow | null> {
  const ag = await getOwnerAgency(ownerUserId);
  if (!ag) return null;
  const { data } = await supabaseAdmin
    .from("agency_clients")
    .select(
      "id, agency_id, client_name, facebook_page_id, facebook_page_name, ad_account_id, ad_account_name, access_token, status",
    )
    .eq("id", clientId)
    .eq("agency_id", ag.id)
    .maybeSingle();
  return (data as AgencyClientRow) ?? null;
}

/**
 * Finalizează conectarea unui CLIENT la o agenție (din /connect). Salvează
 * tokenul + prima Pagină + primul cont de reclame în agency_clients. Fără user nou.
 */
export async function finishAgencyConnect(params: {
  slug: string;
  accessToken: string;
  expiresIn?: number | null;
}): Promise<{ ok: true; slug: string } | { ok: false; reason: "noagency" | "full" | "noassets" }> {
  const { slug, accessToken, expiresIn = null } = params;
  const { data: ag } = await supabaseAdmin
    .from("agencies")
    .select("id, client_slots, extra_slots")
    .eq("slug", slug)
    .maybeSingle();
  if (!ag) return { ok: false, reason: "noagency" as const };

  const { fetchMetaUser, fetchAdAccounts, fetchPages } = await import("@/lib/meta.server");
  const me = await fetchMetaUser(accessToken).catch(() => null);
  if (!me?.id) return { ok: false, reason: "noassets" };

  const ads = await fetchAdAccounts(accessToken).catch(() => ({ data: [] }));
  const pages = await fetchPages(accessToken).catch(() => ({ data: [] }));
  const adData: any[] = ads?.data ?? [];
  const pageData: any[] = pages?.data ?? [];
  const acct = adData.find((a) => a.account_status === 1) ?? adData[0];
  const page = pageData[0];

  // Dedupe: același client (meta_user_id) pe aceeași agenție → update.
  const { data: existing } = await supabaseAdmin
    .from("agency_clients")
    .select("id")
    .eq("agency_id", ag.id)
    .eq("meta_user_id", me.id)
    .maybeSingle();

  // Varianta B: fără plafon — clienții peste cei incluși se facturează automat (+249/lună).
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const row = {
    agency_id: ag.id,
    client_name: me.name ?? null,
    meta_user_id: me.id,
    access_token: accessToken,
    token_expires_at: expiresAt,
    ad_account_id: acct?.account_id ?? null,
    ad_account_name: acct?.name ?? null,
    facebook_page_id: page?.id ?? null,
    facebook_page_name: page?.name ?? null,
    status: "connected",
    connected_at: new Date().toISOString(),
  };
  if (existing) {
    await (supabaseAdmin as any).from("agency_clients").update(row).eq("id", existing.id);
  } else {
    await (supabaseAdmin as any).from("agency_clients").insert(row);
  }
  // Sincronizează cantitatea facturată (client nou peste cei incluși = +249/lună).
  try {
    const { syncAgencyBilling } = await import("@/lib/agency-billing.server");
    await syncAgencyBilling(ag.id);
  } catch {
    /* best-effort */
  }
  return { ok: true, slug };
}

function leadsFromActions(actions: any[]): number {
  const a = (actions ?? []).find(
    (x) => x.action_type === "lead" || x.action_type === "leadgen.other",
  );
  return a ? Number(a.value) : 0;
}

/** Insights la nivel de cont (toate campaniile), pe o perioadă. Spend convertit în lei. */
export async function clientAccountInsights(
  token: string,
  adAccountId: string,
  datePreset: "today" | "last_7d" | "last_30d" | "maximum",
): Promise<{ spend: number; leads: number; clicks: number; impressions: number }> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url = new URL(`${GRAPH}/${metaApiVersion()}/${acct}/insights`);
  url.searchParams.set("fields", "spend,clicks,impressions,actions,account_currency");
  url.searchParams.set("date_preset", datePreset);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) return { spend: 0, leads: 0, clicks: 0, impressions: 0 };
  const row = json?.data?.[0] ?? {};
  let spend = Number(row.spend ?? 0);
  const cur = String(row.account_currency ?? "RON").toUpperCase();
  if (cur !== "RON" && spend > 0) {
    const { currencyToRon } = await import("@/lib/currency.server");
    spend = await currencyToRon(spend, cur);
  }
  return {
    spend,
    leads: leadsFromActions(row.actions),
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
  };
}

/** Lista campaniilor clientului + insights per campanie (lifetime), spend în lei. */
export async function clientCampaigns(
  token: string,
  adAccountId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    spend: number;
    leads: number;
    clicks: number;
    impressions: number;
  }>
> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url = new URL(`${GRAPH}/${metaApiVersion()}/${acct}/campaigns`);
  url.searchParams.set(
    "fields",
    "name,effective_status,objective,insights.date_preset(maximum){spend,clicks,impressions,actions,account_currency}",
  );
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) return [];
  let convert: ((s: number, c: string) => Promise<number>) | null = null;
  const out = [];
  for (const c of json?.data ?? []) {
    const ins = c?.insights?.data?.[0] ?? {};
    let spend = Number(ins.spend ?? 0);
    const cur = String(ins.account_currency ?? "RON").toUpperCase();
    if (cur !== "RON" && spend > 0) {
      if (!convert) convert = (await import("@/lib/currency.server")).currencyToRon;
      spend = await convert(spend, cur);
    }
    out.push({
      id: c.id,
      name: c.name,
      status: c.effective_status,
      objective: c.objective ?? "",
      spend,
      leads: leadsFromActions(ins.actions),
      clicks: Number(ins.clicks ?? 0),
      impressions: Number(ins.impressions ?? 0),
    });
  }
  return out;
}
