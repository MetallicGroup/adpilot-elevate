/** Plan cards shown on public pages. Prices mirror the Stripe lookup keys. */
import { PLAN_CATALOG, planVolume, type PlanId } from "@/lib/plan-catalog";

export type PublicPlan = {
  id: PlanId;
  name: string;
  featured?: boolean;
  price: string;
  tag: string;
  items: string[];
  cta: string;
};

export const PUBLIC_PLANS: PublicPlan[] = PLAN_CATALOG.map((p) => ({
  id: p.id,
  name: p.name,
  featured: p.featured,
  price: `${p.lei} lei`,
  tag: p.featured ? "Recomandat" : p.tagline,
  items: [
    `${planVolume(p)} pe lună`,
    "Voce în română, subtitrări și muzică",
    ...(p.ads
      ? ["Reclame pe Facebook, Instagram și TikTok", "Asistent AdPilot pe WhatsApp, care le pornește și le urmărește"]
      : ["Primești clipurile și pe WhatsApp", "Treci pe reclame oricând, plătești doar diferența"]),
  ],
  cta: `Alege ${p.name}`,
}));
