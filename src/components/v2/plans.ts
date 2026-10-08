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
    items: ["Asistent AdPilot pe WhatsApp", "Campanii pe Facebook și Instagram", "O campanie activă, 7 zile în fiecare lună"],
    cta: "Începe gratuit",
  },
  {
    id: "pro_monthly",
    name: "Pro",
    featured: true,
    price: "495 lei",
    tag: "Cel mai ales · gratis primele 7 zile",
    then: "primele 7 zile, apoi 495 lei pe lună",
    items: ["Campanii nelimitate, care rulează non-stop", "10 poze generate cu AI pe lună", "Asistent AdPilot pe WhatsApp", "Suport prioritar"],
    cta: "Începe gratuit 7 zile",
  },
  {
    id: "premium_monthly",
    name: "Premium",
    price: "995 lei",
    tag: "Gratis primele 7 zile",
    then: "primele 7 zile, apoi 995 lei pe lună",
    items: ["Tot ce are Pro", "Poze generate cu AI, nelimitat", "Manager dedicat"],
    cta: "Începe gratuit 7 zile",
  },
];
