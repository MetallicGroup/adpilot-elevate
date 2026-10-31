/**
 * Răspunsurile automate pe WhatsApp pentru conturile fără agent (fără plan sau pe Start și Creator).
 * Nu trec prin Claude, deci nu costă nimic.
 */
import { loginLink } from "./login-link.server";
import { PLAN_CATALOG } from "./plan-catalog";
import type { PlanTier } from "./plan.server";

const TIER_LEI: Partial<Record<PlanTier, number>> = { clips2: PLAN_CATALOG[0].lei, clips6: PLAN_CATALOG[1].lei };

export function paywallBotReply(userId: string, tier: PlanTier, buttonId: string): string {
  const current = TIER_LEI[tier];
  if (current === undefined) {
    return `Clipul tău te așteaptă în cont. Îl vezi și îl deblochezi aici: ${loginLink(userId, "s")}`;
  }
  if (buttonId === "demo_more") {
    return `Clipurile noi le ceri din contul tău: ${loginLink(userId, "m")}`;
  }
  const target = PLAN_CATALOG.find((p) => p.ads)!;
  return (
    `Reclamele și asistentul de aici sunt incluse de la pachetul *${target.name}* (${target.lei} lei pe lună). ` +
    `Plătești doar diferența de ${target.lei - current} lei: ${loginLink(userId, "u")}`
  );
}
