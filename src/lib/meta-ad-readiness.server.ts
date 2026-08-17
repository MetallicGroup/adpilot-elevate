/**
 * Pregătirea contului de reclame Meta înainte de a alege un plan.
 *
 * Verifică dacă userul are un cont de reclame utilizabil ȘI o metodă de plată
 * (card) adăugată pe el. Cardul NU se poate adăuga prin API (restricție Meta) —
 * îl ducem în interfața Facebook și verificăm continuu (polling) când a apărut.
 * Contul de reclame ÎL putem crea automat dacă userul are un Business Manager.
 */
import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

export type AdReadiness = {
  hasAdAccount: boolean;
  hasCard: boolean;
  adAccountId: string | null; // fără prefix act_
  adAccountName: string | null;
  businessId: string | null;
  paymentUrl: string | null;
};

type RawAccount = {
  account_id: string;
  name?: string;
  account_status?: number;
  funding_source_details?: { id?: string; type?: number; display_string?: string } | null;
  business?: { id?: string } | null;
};

async function listAccountsWithFunding(accessToken: string): Promise<RawAccount[]> {
  const v = metaApiVersion();
  const fields = "account_id,name,account_status,funding_source_details,business";
  const seen = new Set<string>();
  const out: RawAccount[] = [];
  const add = (rows: any[]) => {
    for (const r of rows ?? []) {
      const id = r?.account_id ?? String(r?.id ?? "").replace(/^act_/, "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ ...r, account_id: id });
    }
  };
  try {
    const r = await fetch(
      `${GRAPH}/${v}/me/adaccounts?fields=${fields}&limit=200&access_token=${encodeURIComponent(accessToken)}`,
    );
    const j: any = await r.json();
    add(j?.data ?? []);
  } catch (e) {
    console.warn("[ad-readiness] list failed", e);
  }
  return out;
}

function hasFunding(acc?: RawAccount | null): boolean {
  const f = acc?.funding_source_details;
  return !!(f && (f.id || f.display_string || typeof f.type === "number"));
}

/** Deep-link direct în pagina de billing a contului de reclame (adaugă card). */
export function paymentSettingsUrl(adAccountId: string): string {
  return `https://business.facebook.com/ads/manager/account_settings/account_billing/?act=${adAccountId}`;
}

export async function getAdAccountReadiness(
  accessToken: string,
  preferredAdAccountId?: string | null,
): Promise<AdReadiness> {
  const accounts = await listAccountsWithFunding(accessToken);
  if (!accounts.length) {
    return {
      hasAdAccount: false,
      hasCard: false,
      adAccountId: null,
      adAccountName: null,
      businessId: null,
      paymentUrl: null,
    };
  }
  // Contul verificat: cel selectat de user (dacă e dat), altfel primul ACTIV, altfel primul.
  const pick =
    (preferredAdAccountId && accounts.find((a) => a.account_id === preferredAdAccountId)) ||
    accounts.find((a) => a.account_status === 1) ||
    accounts[0];
  return {
    hasAdAccount: true,
    hasCard: hasFunding(pick),
    adAccountId: pick.account_id,
    adAccountName: pick.name ?? null,
    businessId: pick.business?.id ?? null,
    paymentUrl: paymentSettingsUrl(pick.account_id),
  };
}

/**
 * Creează automat un cont de reclame pe primul Business Manager al userului.
 * Poate eșua (fără BM, business neverificat, limite Meta) → `needsManual`.
 */
export async function createAdAccountViaMeta(
  accessToken: string,
  name: string,
): Promise<
  | { ok: true; adAccountId: string; businessId: string }
  | { ok: false; error: string; needsManual: boolean }
> {
  const v = metaApiVersion();
  let businessId: string | null = null;
  try {
    const r = await fetch(
      `${GRAPH}/${v}/me/businesses?fields=id,name&limit=10&access_token=${encodeURIComponent(accessToken)}`,
    );
    const j: any = await r.json();
    businessId = j?.data?.[0]?.id ?? null;
  } catch {
    /* ignore */
  }
  if (!businessId) {
    return {
      ok: false,
      needsManual: true,
      error:
        "Nu ai un Business Manager pe Facebook. Creează-l o dată pe business.facebook.com, apoi revino și creăm contul de reclame.",
    };
  }
  const body = new URLSearchParams({
    name: (name || "AdPilot").slice(0, 100),
    currency: "RON",
    timezone_id: "76", // Europe/Bucharest
    end_advertiser: businessId,
    media_agency: "NONE",
    partner: "NONE",
    access_token: accessToken,
  });
  try {
    const res = await fetch(`${GRAPH}/${v}/${businessId}/adaccount`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const j: any = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        needsManual: true,
        error: j?.error?.error_user_msg || j?.error?.message || `Meta ${res.status}`,
      };
    }
    const adAccountId = String(j?.id ?? j?.account_id ?? "").replace(/^act_/, "");
    if (!adAccountId) return { ok: false, needsManual: true, error: "Meta nu a returnat contul creat." };
    return { ok: true, adAccountId, businessId };
  } catch (e: any) {
    return { ok: false, needsManual: true, error: e?.message ?? "Creare eșuată" };
  }
}
