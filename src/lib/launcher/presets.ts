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
  {
    id: "dentist",
    title: "Clinică stomatologică",
    services: ["Implant dentar", "Aparat dentar", "Igienizare profesională", "Fațete dentare", "Consultație gratuită"],
  },
  {
    id: "medical_clinic",
    title: "Clinică medicală",
    services: ["Consultație de specialitate", "Analize", "Ecografie", "Control periodic", "Pachet preventiv"],
  },
  {
    id: "barber",
    title: "Barber shop",
    services: ["Tuns", "Aranjat barbă", "Pachet tuns + barbă", "Tuns copii", "Abonament lunar"],
  },
  {
    id: "detailing",
    title: "Detailing auto",
    services: ["Detailing complet", "Detailing interior", "Polish & ceramică", "Curățare tapițerie", "Pachet premium"],
  },
  {
    id: "tires",
    title: "Vulcanizare",
    services: ["Schimb anvelope", "Echilibrare", "Reparație pană", "Depozitare anvelope", "Pachet sezon"],
  },
  {
    id: "hvac",
    title: "HVAC / Climatizare",
    services: ["Montaj aer condiționat", "Montaj centrală", "Pompă de căldură", "Reparație", "Mentenanță"],
  },
  {
    id: "plumbing",
    title: "Instalații sanitare",
    services: ["Reparație urgentă", "Instalații apartament", "Desfundare", "Montaj obiecte sanitare", "Evaluare gratuită"],
  },
  {
    id: "electrician",
    title: "Electrician",
    services: ["Intervenție urgentă", "Instalație electrică", "Tablou electric", "Montaj corpuri de iluminat", "Verificare instalație"],
  },
  {
    id: "solar",
    title: "Panouri fotovoltaice",
    services: ["Sistem fotovoltaic rezidențial", "Sistem industrial", "Consultanță & ofertă", "Mentenanță", "Baterii stocare"],
  },
  {
    id: "nutrition",
    title: "Nutriție",
    services: ["Consultație nutriție", "Plan alimentar personalizat", "Monitorizare lunară", "Analiză corporală", "Pachet 3 luni"],
  },
  {
    id: "physiotherapy",
    title: "Fizioterapie / Recuperare",
    services: ["Ședință de kinetoterapie", "Evaluare posturală", "Recuperare post-operatorie", "Terapie durere lombară", "Pachet 10 ședințe"],
  },
  {
    id: "massage",
    title: "Masaj / SPA",
    services: ["Masaj de relaxare", "Masaj terapeutic", "Masaj anticelulitic", "Pachet cuplu", "Abonament lunar"],
  },
  {
    id: "psychology",
    title: "Psihologie / Terapie",
    services: ["Ședință individuală", "Terapie de cuplu", "Consiliere adolescenți", "Evaluare psihologică", "Pachet 5 ședințe"],
  },
  {
    id: "lawyer",
    title: "Avocatură",
    services: ["Consultanță juridică", "Divorț", "Litigii comerciale", "Dreptul muncii", "Reprezentare în instanță"],
  },
  {
    id: "accounting",
    title: "Contabilitate",
    services: ["Contabilitate SRL", "Contabilitate PFA", "Consultanță fiscală", "Înființare firmă", "Salarizare"],
  },
  {
    id: "consulting",
    title: "Consultanță business",
    services: ["Sesiune de strategie", "Audit business", "Fonduri europene", "Consultanță vânzări", "Mentorat lunar"],
  },
  {
    id: "real_estate",
    title: "Imobiliare",
    services: ["Evaluare gratuită proprietate", "Vizionare apartament", "Consultanță achiziție", "Intermediere vânzare", "Consultanță credit"],
  },
  {
    id: "photography",
    title: "Fotograf",
    services: ["Ședință foto de familie", "Fotografie nuntă", "Fotografie produs", "Botez", "Ședință foto personal branding"],
  },
  {
    id: "events",
    title: "Evenimente",
    services: ["Organizare nuntă", "Organizare botez", "Evenimente corporate", "Decor evenimente", "Consultanță eveniment"],
  },
  {
    id: "fencing",
    title: "Garduri / Amenajări",
    services: ["Montaj gard", "Poartă automată", "Amenajare curte", "Măsurători și deviz", "Reparații gard"],
  },
  {
    id: "other",
    title: "Alt domeniu (îl scriu eu)",
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
    dentist: { age_min: 25, age_max: 65, interests: ["health", "dental_care", "wellness"], genders: ["all"] },
    medical_clinic: { age_min: 25, age_max: 65, interests: ["health", "wellness"], genders: ["all"] },
    barber: { age_min: 18, age_max: 55, interests: ["grooming", "fashion"], genders: ["male"] },
    detailing: { age_min: 22, age_max: 60, interests: ["automotive", "cars", "car_care"], genders: ["all"] },
    tires: { age_min: 22, age_max: 65, interests: ["automotive", "cars"], genders: ["all"] },
    hvac: { age_min: 28, age_max: 65, interests: ["home", "home_improvement"], genders: ["all"] },
    plumbing: { age_min: 25, age_max: 65, interests: ["home", "home_improvement"], genders: ["all"] },
    electrician: { age_min: 25, age_max: 65, interests: ["home", "home_improvement"], genders: ["all"] },
    solar: { age_min: 30, age_max: 65, interests: ["home", "renewable_energy", "real_estate"], genders: ["all"] },
    nutrition: { age_min: 20, age_max: 60, interests: ["health", "nutrition", "fitness"], genders: ["all"] },
    physiotherapy: { age_min: 25, age_max: 65, interests: ["health", "wellness", "fitness"], genders: ["all"] },
    massage: { age_min: 22, age_max: 60, interests: ["wellness", "spa", "health"], genders: ["all"] },
    psychology: { age_min: 20, age_max: 60, interests: ["mental_health", "wellness"], genders: ["all"] },
    lawyer: { age_min: 25, age_max: 65, interests: ["legal", "business"], genders: ["all"] },
    accounting: { age_min: 25, age_max: 65, interests: ["business", "finance"], genders: ["all"] },
    consulting: { age_min: 25, age_max: 65, interests: ["business", "entrepreneurship"], genders: ["all"] },
    real_estate: { age_min: 25, age_max: 65, interests: ["real_estate", "home"], genders: ["all"] },
    photography: { age_min: 20, age_max: 60, interests: ["photography", "weddings", "family"], genders: ["all"] },
    events: { age_min: 20, age_max: 60, interests: ["weddings", "events", "party"], genders: ["all"] },
    fencing: { age_min: 28, age_max: 65, interests: ["home", "renovation", "real_estate"], genders: ["all"] },
    other: { age_min: 18, age_max: 65, interests: [], genders: ["all"] },
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