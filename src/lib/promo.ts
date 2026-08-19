/**
 * Ofertă activă: -50% în prima lună (aplicat automat pe Stripe, cupon
 * `adpilot_first_month_50`, duration "once"). Helper client-safe pentru afișaj
 * consistent pe tot site-ul + în aplicație.
 */
export const FIRST_MONTH_DISCOUNT_PERCENT = 50;

export const FIRST_MONTH_BADGE = `-${FIRST_MONTH_DISCOUNT_PERCENT}% prima lună`;

/** Planul Starter: gratuit 3 zile/lună, cu asistent WhatsApp inclus. */
export const FREE_STARTER_LABEL = "Gratuit 3 zile";
export const FREE_STARTER_SUBLABEL = "Asistent WhatsApp AI inclus";

/**
 * Din eticheta de preț ("249 lei") calculează prețul primei luni cu reducere.
 * Întoarce eticheta întreagă și cea redusă (formatate în lei, virgulă zecimală).
 */
export function firstMonthPrice(priceLabel: string): { full: string; first: string } {
  const num = parseFloat(priceLabel.replace(/[^\d.,]/g, "").replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return { full: priceLabel, first: priceLabel };
  const discounted = num * (1 - FIRST_MONTH_DISCOUNT_PERCENT / 100);
  const fmt = (n: number) =>
    Number.isInteger(n) ? `${n} lei` : `${n.toFixed(2).replace(".", ",")} lei`;
  return { full: priceLabel, first: fmt(discounted) };
}
