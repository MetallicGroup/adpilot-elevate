import type { BusinessNiche } from "@/lib/launcher/types";
import type { BookingQuestion } from "./types";

type Preset = Omit<BookingQuestion, "position" | "source">;

const q = (
  key: string,
  label: string,
  type: BookingQuestion["type"] = "text",
  options: string[] = [],
  required = true,
): Preset => ({ key, label, type, options, required });

const WHEN = q("desired_timing", "Când ai dori programarea?", "single_select", [
  "Cât mai repede",
  "Săptămâna aceasta",
  "Săptămâna viitoare",
  "Luna aceasta",
  "Doar mă informez",
]);

const CITY = q("city", "În ce localitate te afli?", "text", [], false);

const GENERIC: Preset[] = [
  q("service_interest", "Pentru ce serviciu dorești programarea?"),
  WHEN,
  CITY,
];

export const QUESTION_PRESETS: Partial<Record<BusinessNiche, Preset[]>> = {
  dentist: [
    q("service_interest", "Pentru ce serviciu dorești programarea?"),
    q("implant_count", "Ai nevoie de un singur implant sau mai multe?", "single_select", ["Unul", "2-3", "Mai multe", "Nu știu încă"], false),
    q("has_imaging", "Ai făcut recent o radiografie / CT?", "yes_no", [], false),
    WHEN,
    CITY,
  ],
  medical_clinic: [
    q("reason", "Pentru ce problemă dorești consultația?", "textarea"),
    q("first_visit", "Este prima ta vizită la noi?", "yes_no", [], false),
    WHEN,
  ],
  beauty_makeup: [
    q("service_interest", "Ce serviciu te interesează?"),
    q("first_visit", "Este prima ta programare la noi?", "yes_no", [], false),
    q("done_before", "Ai mai făcut acest tratament?", "yes_no", [], false),
    WHEN,
  ],
  hair_salon: [
    q("service_interest", "Ce serviciu te interesează?"),
    q("hair_length", "Ce lungime are părul?", "single_select", ["Scurt", "Mediu", "Lung"], false),
    WHEN,
  ],
  nails: [q("service_interest", "Ce serviciu te interesează?"), q("first_visit", "Este prima ta programare la noi?", "yes_no", [], false), WHEN],
  barber: [q("service_interest", "Ce serviciu dorești?"), q("first_visit", "Ai mai fost la noi?", "yes_no", [], false), WHEN],
  auto: [
    q("car_brand", "Ce marcă este mașina?"),
    q("car_model", "Ce model și an?"),
    q("issue", "Ce problemă are mașina?", "textarea"),
    q("drivable", "Mașina poate fi deplasată?", "yes_no", [], false),
    WHEN,
  ],
  detailing: [
    q("car_type", "Ce tip de mașină ai?", "single_select", ["Citadină", "Berlină", "SUV", "Break", "Autoutilitară"]),
    q("service_interest", "Interior, exterior sau complet?", "single_select", ["Interior", "Exterior", "Complet"]),
    q("condition", "În ce stare este mașina?", "single_select", ["Foarte bună", "Normală", "Necesită atenție"], false),
    WHEN,
  ],
  tires: [
    q("tire_size", "Ce dimensiune au anvelopele?", "text", [], false),
    q("service_interest", "Ce serviciu dorești?", "single_select", ["Schimb anvelope", "Echilibrare", "Reparație pană", "Depozitare"]),
    WHEN,
  ],
  hvac: [
    q("equipment", "Despre ce echipament este vorba?", "single_select", ["Aer condiționat", "Centrală termică", "Pompă de căldură", "Altceva"]),
    q("work_type", "Ce fel de lucrare?", "single_select", ["Instalare", "Reparație", "Mentenanță"]),
    q("urgency", "Cât de urgentă este intervenția?", "single_select", ["Astăzi", "În următoarele zile", "Nu este urgent"]),
    CITY,
  ],
  plumbing: [
    q("issue", "Ce problemă ai?", "textarea"),
    q("urgency", "Cât de urgentă este intervenția?", "single_select", ["Astăzi", "În următoarele zile", "Nu este urgent"]),
    CITY,
  ],
  electrician: [
    q("issue", "Ce lucrare ai nevoie?", "textarea"),
    q("urgency", "Cât de urgentă este intervenția?", "single_select", ["Astăzi", "În următoarele zile", "Nu este urgent"]),
    CITY,
  ],
  solar: [
    q("property_type", "Ce tip de proprietate?", "single_select", ["Casă", "Bloc / apartament", "Spațiu comercial", "Teren"]),
    q("monthly_bill", "Cât plătești lunar la curent (lei)?", "number", [], false),
    q("ownership", "Ești proprietarul imobilului?", "yes_no"),
    CITY,
  ],
  fitness: [q("goal", "Care este obiectivul tău?", "single_select", ["Slăbire", "Masă musculară", "Tonifiere", "Sănătate generală"]), q("experience", "Ai mai făcut antrenamente?", "yes_no", [], false), WHEN],
  nutrition: [q("goal", "Care este obiectivul tău?", "single_select", ["Slăbire", "Creștere în greutate", "Sănătate", "Performanță"]), q("conditions", "Ai afecțiuni medicale relevante?", "textarea", [], false), WHEN],
  physiotherapy: [
    q("problem", "Pentru ce problemă dorești programarea?", "textarea"),
    q("first_session", "Este prima ședință?", "yes_no", [], false),
    q("medical_referral", "Ai o recomandare medicală?", "yes_no", [], false),
    WHEN,
  ],
  massage: [q("service_interest", "Ce tip de masaj te interesează?"), q("first_visit", "Este prima ta programare la noi?", "yes_no", [], false), WHEN],
  psychology: [q("reason", "Despre ce ai dori să discutăm?", "textarea"), q("first_session", "Ai mai fost la terapie?", "yes_no", [], false), q("format", "Preferi online sau la cabinet?", "single_select", ["Online", "La cabinet"], false)],
  lawyer: [q("case_type", "Ce tip de speță ai?", "single_select", ["Civil", "Penal", "Comercial", "Dreptul muncii", "Familie", "Altul"]), q("details", "Descrie pe scurt situația", "textarea"), q("urgency", "Există un termen apropiat?", "yes_no", [], false)],
  accounting: [q("company_type", "Ce formă juridică ai?", "single_select", ["SRL", "PFA", "II", "Încă nu am firmă"]), q("service_interest", "Ce servicii te interesează?", "multi_select", ["Contabilitate lunară", "Salarizare", "Consultanță fiscală", "Înființare firmă"]), q("employees", "Câți angajați ai?", "number", [], false)],
  consulting: [q("business_stage", "În ce etapă este afacerea?", "single_select", ["Idee", "Start-up", "În creștere", "Matură"]), q("challenge", "Care este principala provocare?", "textarea"), WHEN],
  real_estate: [q("intent", "Vrei să cumperi sau să vinzi?", "single_select", ["Cumpăr", "Vând", "Închiriez"]), q("property_type", "Ce tip de proprietate?", "single_select", ["Apartament", "Casă", "Teren", "Spațiu comercial"]), q("budget", "Ce buget ai în vedere (lei)?", "number", [], false), CITY],
  photography: [q("event_type", "Ce tip de ședință foto?", "single_select", ["Nuntă", "Botez", "Familie", "Produs", "Personal branding"]), q("event_date", "Care este data evenimentului?", "date", [], false), CITY],
  events: [q("event_type", "Ce eveniment organizezi?", "single_select", ["Nuntă", "Botez", "Corporate", "Aniversare", "Altul"]), q("guests", "Câți invitați estimezi?", "number", [], false), q("event_date", "Care este data evenimentului?", "date", [], false)],
  fencing: [q("work_type", "Ce lucrare dorești?", "single_select", ["Gard nou", "Poartă automată", "Reparație", "Amenajare curte"]), q("length_m", "Ce lungime aproximativă (metri)?", "number", [], false), CITY],
  construction: [q("work_type", "Ce lucrare dorești?", "textarea"), q("surface", "Ce suprafață are (mp)?", "number", [], false), WHEN, CITY],
  clinic: [q("service_interest", "Pentru ce serviciu dorești programarea?"), q("first_visit", "Este prima ta vizită?", "yes_no", [], false), WHEN],
  restaurant: [q("guests", "Câte persoane?", "number"), WHEN],
};

export function presetQuestions(niche: BusinessNiche): BookingQuestion[] {
  const list = QUESTION_PRESETS[niche] ?? GENERIC;
  return list.map((p, i) => ({ ...p, position: i, source: "preset" as const }));
}