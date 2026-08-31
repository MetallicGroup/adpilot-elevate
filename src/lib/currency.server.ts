/**
 * Conversie buget din LEI (cum vorbește userul) în valuta contului de reclame.
 * Meta interpretează bugetul în valuta contului — dacă contul e pe USD și userul
 * zice „50 lei", fără conversie s-ar seta $50/zi (~4,5x mai mult). Aici convertim.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Fallback aproximativ dacă API-ul live pică (RON → valută).
const FALLBACK_RON_RATES: Record<string, number> = {
  RON: 1,
  USD: 0.22,
  EUR: 0.2,
  GBP: 0.17,
  MDL: 3.9,
  BGN: 0.39,
  HUF: 79,
  PLN: 0.85,
};

/** Valuta contului de reclame (din DB, cu fallback live de la Meta). */
export async function getAdAccountCurrency(
  adAccountId: string,
  accessToken: string,
): Promise<string> {
  const plain = adAccountId.replace(/^act_/, "");
  try {
    const { data } = await (supabaseAdmin as any)
      .from("meta_ad_accounts")
      .select("currency")
      .eq("ad_account_id", plain)
      .maybeSingle();
    if (data?.currency) return String(data.currency).toUpperCase();
  } catch {
    /* fallback live */
  }
  try {
    const { metaApiVersion } = await import("@/lib/meta.server");
    const id = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/${metaApiVersion()}/${id}?fields=currency&access_token=${encodeURIComponent(accessToken)}`;
    const r = await fetch(url).then((res) => res.json());
    if (r?.currency) return String(r.currency).toUpperCase();
  } catch {
    /* fallback RON */
  }
  return "RON";
}

/**
 * Convertește o sumă în LEI către `currency`. Întoarce suma convertită, cursul,
 * și dacă s-a făcut vreo conversie (false pentru RON sau valută necunoscută).
 */
export async function convertRon(
  ronAmount: number,
  currency: string,
): Promise<{ amount: number; rate: number; converted: boolean; currency: string }> {
  const cur = (currency || "RON").toUpperCase();
  if (cur === "RON") return { amount: ronAmount, rate: 1, converted: false, currency: cur };

  let rate: number | null = null;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/RON").then((res) => res.json());
    if (r?.result === "success" && r?.rates?.[cur]) rate = Number(r.rates[cur]);
  } catch {
    /* fallback table */
  }
  if (!rate || !isFinite(rate) || rate <= 0) rate = FALLBACK_RON_RATES[cur] ?? null;
  if (!rate || !isFinite(rate) || rate <= 0) {
    // Valută necunoscută și API picat → NU riscăm o conversie greșită; păstrăm suma.
    return { amount: ronAmount, rate: 1, converted: false, currency: cur };
  }
  return { amount: ronAmount * rate, rate, converted: true, currency: cur };
}

/** Helper compus: buget în lei → cents în valuta contului, + notă pentru user. */
export async function ronBudgetToAccountCents(
  ronAmount: number,
  adAccountId: string,
  accessToken: string,
): Promise<{ cents: number; currency: string; converted: boolean; amount: number; note: string | null }> {
  const currency = await getAdAccountCurrency(adAccountId, accessToken);
  const conv = await convertRon(ronAmount, currency);
  const cents = Math.round(conv.amount * 100);
  const note = conv.converted
    ? `contul tău e în ${currency}, am convertit ${ronAmount} lei ≈ ${conv.amount.toFixed(2)} ${currency}/zi`
    : null;
  return { cents, currency, converted: conv.converted, amount: conv.amount, note };
}
