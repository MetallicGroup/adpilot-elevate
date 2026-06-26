// @ts-nocheck
import type { BusinessNiche, PromotionGoal } from "./types";

export const PROMOTION_GOALS: Array<{
  id: PromotionGoal;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  { id: "appointments", title: "Mai multe programări", subtitle: "Clienții îți lasă datele și te contactezi rapid", icon: "📅" },
  { id: "leads", title: "Mai mulți clienți interesați", subtitle: "Primești cereri de ofertă direct în AdPilot", icon: "📩" },
  { id: "service", title: "Promovează un serviciu", subtitle: "Prezintă ce faci și de ce ești alegerea potrivită", icon: "✨" },
  { id: "product", title: "Promovează un produs", subtitle: "Atrage cumpărători din zona ta", icon: "🛍️" },
  { id: "offer", title: "Promovează o ofertă", subtitle: "Reduceri, pachete speciale, promoții limitate", icon: "🎁" },
  { id: "course", title: "Promovează un curs / eveniment", subtitle: "Workshop-uri, cursuri, evenimente private", icon: "🎓" },
];

export const BUSINESS_NICHES: Array<{
  id: BusinessNiche;
  title: string;
  services: string[];
}> = [
  {
    id: "beauty_makeup",
    title: "Beauty / Machiaj",
    services: ["Machiaj de mireasă", "Machiaj de seară", "Curs de automachiaj", "Programare salon", "Ofertă specială"],
  },
  {
    id: "hair_salon",
    title: "Salon de coafură",
    services: ["Tuns & coafat", "Vopsit", "Tratamente păr", "Coafat mireasă", "Ofertă salon"],
  },
  {
    id: "nails",
    title: "Unghii",
    services: ["Manichiură", "Pedichiură", "Unghii gel", "Nail art", "Pachet complet"],
  },
  {
    id: "fitness",
    title: "Fitness / Coaching",
    services: ["Antrenament personal", "Plan nutriție", "Curs online", "Abonament sală", "Consultație gratuită"],
  },
  {
    id: "restaurant",
    title: "Restaurant / Cafenea",
    services: ["Rezervare masă", "Meniu special", "Catering evenimente", "Livrare locală", "Ofertă weekend"],
  },
  {
    id: "clinic",
    title: "Clinică / Cabinet",
    services: ["Consultație", "Tratament estetic", "Control periodic", "Pachet promo", "Programare online"],
  },
  {
    id: "construction",
    title: "Construcții / Renovări",
    services: ["Renovări apartamente", "Zugrăveli", "Instalații", "Estimare gratuită", "Proiect complet"],
  },
  {
    id: "auto",
    title: "Service auto",
    services: ["Revizie", "ITP", "Detailing", "Anvelope", "Ofertă service"],
  },
  {
    id: "ecommerce",
    title: "Magazin online",
    services: ["Produs nou", "Reduceri sezon", "Livrare rapidă", "Colecție limitată", "Ofertă bundle"],
  },
  {
    id: "general",
    title: "Alt tip de business",
    services: ["Serviciul principal", "Ofertă specială", "Consultație gratuită"],
  },
];

export const BUDGET_PRESETS_RON = [30, 50, 100] as const;

export const DEFAULT_LEAD_FIELDS = [
  { key: "full_name" as const, label: "Nume complet", required: true },
  { key: "phone" as const, label: "Număr de telefon", required: true },
];

export const OPTIONAL_LEAD_FIELDS = [
  { key: "email" as const, label: "Email", required: false },
  { key: "service_interest" as const, label: "Serviciu dorit", required: false },
  { key: "preferred_date" as const, label: "Data preferată", required: false },
  { key: "preferred_time" as const, label: "Ora preferată", required: false },
  { key: "budget" as const, label: "Buget estimativ", required: false },
  { key: "company_name" as const, label: "Nume companie", required: false },
  { key: "address" as const, label: "Adresă / Zonă", required: false },
  { key: "custom" as const, label: "Întrebare personalizată", required: false },
];

export function getNicheAudience(niche: BusinessNiche): { age_min: number; age_max: number; interests: string[]; genders: string[] } {
  const map: Record<BusinessNiche, { age_min: number; age_max: number; interests: string[]; genders: string[] }> = {
    beauty_makeup: { age_min: 18, age_max: 45, interests: ["beauty", "weddings", "fashion", "skincare", "cosmetics"], genders: ["female"] },
    hair_salon: { age_min: 18, age_max: 55, interests: ["beauty", "hair", "fashion"], genders: ["female", "all"] },
    nails: { age_min: 16, age_max: 50, interests: ["beauty", "nails", "fashion"], genders: ["female"] },
    fitness: { age_min: 18, age_max: 55, interests: ["fitness", "health", "wellness"], genders: ["all"] },
    restaurant: { age_min: 18, age_max: 65, interests: ["food", "dining", "local"], genders: ["all"] },
    clinic: { age_min: 25, age_max: 65, interests: ["health", "wellness", "beauty"], genders: ["all"] },
    construction: { age_min: 28, age_max: 65, interests: ["home", "renovation", "real_estate"], genders: ["all"] },
    auto: { age_min: 22, age_max: 65, interests: ["automotive", "cars"], genders: ["all"] },
    ecommerce: { age_min: 18, age_max: 55, interests: ["shopping", "fashion", "deals"], genders: ["all"] },
    general: { age_min: 18, age_max: 65, interests: [], genders: ["all"] },
  };
  return map[niche];
}

export function suggestLeadFields(niche: BusinessNiche) {
  const base = [...DEFAULT_LEAD_FIELDS];
  if (["beauty_makeup", "hair_salon", "nails", "clinic", "fitness"].includes(niche)) {
    base.push(
      { key: "service_interest", label: "Serviciu dorit", required: true },
      { key: "preferred_date", label: "Data preferată", required: false },
    );
  }
  if (niche === "restaurant") {
    base.push({ key: "preferred_date", label: "Data rezervării", required: true });
  }
  if (niche === "construction" || niche === "auto") {
    base.push({ key: "address", label: "Zona / Adresa", required: false });
  }
  return base;
}