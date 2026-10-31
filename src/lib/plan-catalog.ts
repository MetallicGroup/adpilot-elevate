/**
 * Pachetele AdPilot (client + server). `id` = lookup key-ul prețului din Stripe.
 * Un clip consumă 10 unități, o poză 1, din același total lunar: de aici „2 clipuri sau 20 de poze”.
 */
export type PlanId = "clips2_monthly" | "clips6_monthly" | "afacere_monthly" | "zilnic_monthly";

export type CatalogPlan = {
  id: PlanId;
  name: string;
  lei: number;
  clips: number;
  /** Reclame și agentul de pe WhatsApp, doar de la 495 lei. */
  ads: boolean;
  tagline: string;
  featured?: boolean;
};

export const PLAN_CATALOG: CatalogPlan[] = [
  { id: "clips2_monthly", name: "Start", lei: 89, clips: 2, ads: false, tagline: "Primele tale clipuri și poze" },
  { id: "clips6_monthly", name: "Creator", lei: 249, clips: 6, ads: false, tagline: "Conținut nou în fiecare săptămână" },
  { id: "afacere_monthly", name: "Afacere", lei: 495, clips: 16, ads: true, featured: true, tagline: "Clipuri și reclame care aduc clienți" },
  { id: "zilnic_monthly", name: "Zilnic", lei: 949, clips: 32, ads: true, tagline: "Un clip nou pentru fiecare zi" },
];

export const CREDITS_PER_CLIP = 10;

/** Ex.: „2 clipuri sau 20 de poze”, „32 de clipuri sau 320 de poze”. */
export function planVolume(p: CatalogPlan): string {
  return `${p.clips}${p.clips >= 20 ? " de" : ""} clipuri sau ${p.clips * CREDITS_PER_CLIP} de poze`;
}

/** Prețul lunar pentru calculul diferenței la upgrade; include planurile vechi. */
export function planMonthlyLei(priceId?: string | null): number {
  const v = (priceId ?? "").toLowerCase();
  const hit = PLAN_CATALOG.find((p) => p.id === v);
  if (hit) return hit.lei;
  if (v.includes("comp")) return 0;
  if (v.includes("premium")) return 995;
  if (v.includes("pro")) return 495;
  if (v.includes("starter")) return 249;
  return 0;
}

/** Numele afișat al unui plan, inclusiv pentru planurile vechi. */
export function planLabel(priceId?: string | null): string {
  const v = (priceId ?? "").toLowerCase();
  const hit = PLAN_CATALOG.find((p) => p.id === v);
  if (hit) return hit.name;
  if (v.includes("comp")) return "Comp (gratuit)";
  if (v.includes("premium")) return "Premium";
  if (v.includes("pro")) return "Pro";
  if (v.includes("starter")) return "Starter";
  return "Necunoscut";
}
