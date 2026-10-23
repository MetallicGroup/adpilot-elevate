/** Plan cards shown on public pages. Prices mirror the Stripe lookup keys. */
export type PublicPlan = {
  id: "starter_free" | "pro_monthly" | "premium_monthly";
  name: string;
  free?: boolean;
  featured?: boolean;
  /** Monthly price label once the free days end; empty for the free plan. */
  price: string;
  tag: string;
  then: string;
  items: string[];
  cta: string;
};

export const PUBLIC_PLANS: PublicPlan[] = [
  {
    id: "starter_free",
    name: "Starter",
    free: true,
    price: "",
    tag: "7 zile gratuite pe lună",
    then: "gratuit mereu, 7 zile de rulare pe lună",
    items: [
      "Asistent AdPilot pe WhatsApp",
      "Reclame pe Facebook, Instagram și TikTok",
      "1 clip și 2 poze generate cu AI, la înscriere",
      "O campanie activă, 7 zile în fiecare lună",
    ],
    cta: "Începe gratuit",
  },
  {
    id: "pro_monthly",
    name: "Pro",
    featured: true,
    price: "495 lei",
    tag: "Cel mai ales · gratis primele 7 zile",
    then: "primele 7 zile, apoi 495 lei pe lună",
    items: [
      "Campanii nelimitate, non-stop, pe Facebook, Instagram și TikTok",
      "Primele 7 zile: 1 clip și 2 poze generate cu AI",
      "După abonare: 4 clipuri și 10 poze AI pe lună",
      "Asistent AdPilot pe WhatsApp",
      "Suport prioritar",
    ],
    cta: "Începe gratuit 7 zile",
  },
  {
    id: "premium_monthly",
    name: "Premium",
    price: "995 lei",
    tag: "Gratis primele 7 zile",
    then: "primele 7 zile, apoi 995 lei pe lună",
    items: [
      "Tot ce are Pro",
      "Primele 7 zile: 1 clip și 2 poze generate cu AI",
      "După abonare: 15 clipuri și poze AI nelimitate pe lună",
      "Manager dedicat",
    ],
    cta: "Începe gratuit 7 zile",
  },
];
