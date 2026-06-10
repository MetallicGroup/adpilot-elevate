import type { GeneratedAdCopy, LauncherSimpleAnswers, LeadFieldConfig } from "./types";
import { getNicheAudience, suggestLeadFields } from "./presets";

function goalCta(goal: LauncherSimpleAnswers["promotion_goal"]): GeneratedAdCopy["call_to_action"] {
  if (goal === "appointments" || goal === "course") return "BOOK_NOW";
  return "SIGN_UP";
}

function goalHeadline(goal: LauncherSimpleAnswers["promotion_goal"], service: string): string {
  const map: Record<LauncherSimpleAnswers["promotion_goal"], string> = {
    appointments: `Programează-te pentru ${service}`,
    leads: `Solicită detalii despre ${service}`,
    service: `${service} — calitate premium`,
    product: `Descoperă ${service}`,
    offer: `Ofertă specială: ${service}`,
    course: `Înscrie-te la ${service}`,
  };
  return map[goal];
}

function buildLongCopy(answers: LauncherSimpleAnswers, audience: ReturnType<typeof getNicheAudience>): string {
  const { service, city, radius_km, promotion_goal, business_name } = answers;
  const brand = business_name?.trim() || "noi";
  const location = `${city} și împrejurimi (${radius_km} km)`;

  const hookByGoal: Record<LauncherSimpleAnswers["promotion_goal"], string> = {
    appointments: `✨ Cauți ${service.toLowerCase()} și vrei rezultate profesionale, fără stres?`,
    leads: `📩 Vrei să afli rapid dacă ${service.toLowerCase()} este potrivit pentru tine?`,
    service: `✨ Ai nevoie de ${service.toLowerCase()} realizat/corect făcut, la standarde înalte?`,
    product: `🛍️ Cauți ${service.toLowerCase()} de calitate, cu livrare rapidă în zona ta?`,
    offer: `🎁 Ofertă limitată pentru ${service.toLowerCase()} — disponibilă acum în ${city}!`,
    course: `🎓 Vrei să înveți ${service.toLowerCase()} de la profesioniști cu experiență?`,
  };

  const problem = `Multe persoane pierd timp căutând opțiuni, comparând prețuri sau amânând decizia. Uneori nu știu cui să se adreseze sau ce să întrebe.`;

  const solution = `La ${brand}, simplificăm totul: îți explicăm clar ce primești, cât durează și cum te putem ajuta — fără presiune, fără complicații.`;

  const benefits = [
    "✅ Răspuns rapid la cererea ta",
    "✅ Experiență și atenție la detalii",
    "✅ Programări flexibile",
    "✅ Rezultate care merită",
  ];

  if (answers.niche === "beauty_makeup") {
    benefits.unshift("✅ Produse premium", "✅ Machiaj rezistent toată ziua");
  }

  const socialProof = `💬 Sute de clienți mulțumiți din ${city} ne recomandă pentru profesionalism și rezultate consistente.`;

  const cta =
    promotion_goal === "appointments"
      ? "📞 Completează formularul și te contactăm rapid pentru detalii și disponibilitate."
      : "📞 Lasă-ne datele tale și revenim în cel mai scurt timp cu toate informațiile.";

  return [
    hookByGoal[promotion_goal],
    "",
    problem,
    "",
    solution,
    "",
    `💄 ${service}:`,
    `📍 Disponibil în ${location}`,
    "",
    ...benefits,
    "",
    socialProof,
    "",
    cta,
    "",
    `👥 Public țintă: ${audience.age_min}–${audience.age_max} ani, zona ${city}.`,
  ].join("\n");
}

export function generateLauncherAdCopy(
  answers: LauncherSimpleAnswers,
  leadFields?: LeadFieldConfig[],
  variation = 0,
): GeneratedAdCopy {
  const audience = getNicheAudience(answers.niche);
  const fields = leadFields ?? suggestLeadFields(answers.niche);
  const service = answers.service.trim() || "serviciul nostru";
  const brand = answers.business_name?.trim() || service;

  const primary = buildLongCopy(answers, audience);
  const variationSuffix = variation > 0 ? ` (varianta ${variation + 1})` : "";

  const whatsappFollowup = `Lead nou pentru ${service}: {name}, {phone}${
    fields.some((f) => f.key === "service_interest") ? ", interesat(ă) de {service}" : ""
  }${fields.some((f) => f.key === "preferred_date") ? ", data preferată {date}" : ""}.`;

  const dailyReport = `Raportul tău de azi 📊\n\nCheltuit: {spend} RON\nLead-uri: {leads}\nCost/lead: {cpl} RON\nPersoane atinse: {reach}\n\nRecomandare AI: {recommendation}`;

  return {
    campaign_name: `${brand} — ${service}${variationSuffix}`,
    primary_text: primary,
    headline: goalHeadline(answers.promotion_goal, service),
    description: `Servicii profesionale în ${answers.city}. Completează formularul — revenim rapid.`,
    call_to_action: goalCta(answers.promotion_goal),
    audience_summary: `Femei și bărbați ${audience.age_min}–${audience.age_max} ani, în raza de ${answers.radius_km} km de ${answers.city}${
      audience.interests.length ? `, interesați de ${audience.interests.slice(0, 3).join(", ")}` : ""
    }.`,
    lead_form_questions: fields,
    whatsapp_followup: whatsappFollowup,
    daily_report_template: dailyReport,
    targeting_suggestion: {
      countries: ["RO"],
      city: answers.city,
      radius_km: answers.radius_km,
      age_min: audience.age_min,
      age_max: audience.age_max,
      interests: audience.interests,
    },
  };
}

export function regenerateAdCopy(
  answers: LauncherSimpleAnswers,
  leadFields: LeadFieldConfig[],
  seed: number,
): GeneratedAdCopy {
  return generateLauncherAdCopy(answers, leadFields, seed % 3);
}
