/**
 * Domain-agnostic campaign strategy helpers for the WhatsApp agent.
 * Pure logic — no Meta Graph calls.
 */
import { explainMetaError, type MetaProblemContext, type MetaProblemKind } from "./meta-errors.server";

export type AgentObjective = "leads" | "messages" | "sales" | "calls" | "traffic" | "signups";

export type CreativeVariant = {
  angle?: "pain" | "benefit" | "social_proof" | string;
  headline: string;
  primary_text: string;
  description?: string;
  cta?: string;
};

export type CustomQuestion = {
  label: string;
  type?: "short" | "choice";
  options?: string[];
};

export type AgentPublishSnapshot = {
  objective: AgentObjective;
  name: string;
  daily_budget: number;
  headline: string;
  primary_text: string;
  description?: string;
  cta: string;
  landing_url?: string;
  call_phone?: string;
  beneficiary?: string;
  countries: string[];
  cities?: string[];
  city_radius_km?: number;
  age_min: number;
  age_max: number;
  interests?: string[];
  pixel_id?: string;
  custom_questions?: CustomQuestion[];
  creatives?: CreativeVariant[];
  media_path?: string;
  media_mime?: string;
  gender?: "all" | "female" | "male";
  form_intro?: string;
  message_destination?: "auto" | "whatsapp" | "messenger" | "instagram";
};

/** Câte variante de text rulăm în același set, după bugetul zilnic (RON). */
export function creativeCountForBudget(dailyBudgetRon: number): number {
  // Peste ~30 lei/zi, două texte în același set se pot testa; sub, tot bugetul pe unul.
  return dailyBudgetRon >= 30 ? 2 : 1;
}

/**
 * Soft budget recommendation for the niche + market. Used for guidance / warnings,
 * not a hard block (hard limits remain 5–1000 in the agent).
 */
export function recommendDailyBudget(opts: {
  businessType?: string;
  city?: string;
  objective: AgentObjective;
}): { recommended_min: number; recommended_max: number; note: string } {
  const text = `${opts.businessType ?? ""} ${opts.city ?? ""}`.toLowerCase();
  const bigCity = /bucuresti|bucharest|cluj|timisoara|iasi|constanta|brasov/.test(
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  );
  const highTicket =
    /implant|stomat|dentist|clinica|avocat|notar|imobiliar|auto|masina|saas|b2b|chirurgie|estetic/.test(
      text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );

  let min = 40;
  let max = 80;
  if (highTicket && bigCity) {
    min = 50;
    max = 120;
  } else if (highTicket) {
    min = 40;
    max = 100;
  } else if (bigCity) {
    min = 35;
    max = 80;
  } else {
    min = 25;
    max = 60;
  }

  if (opts.objective === "sales" || opts.objective === "signups") {
    min = Math.max(min, 50);
    max = Math.max(max, 100);
  }

  return {
    recommended_min: min,
    recommended_max: max,
    note: `Pentru ${opts.objective} pe piața ta, recomand ~${min}–${max} RON/zi ca Meta să aibă date de învățare.`,
  };
}

/** Warn if budget is likely too low for Meta learning (non-blocking). */
export function budgetLearningWarning(
  dailyBudgetRon: number,
  objective: AgentObjective,
  businessType?: string,
  city?: string,
): string | null {
  const rec = recommendDailyBudget({ businessType, city, objective });
  if (dailyBudgetRon < rec.recommended_min) {
    return `Bugetul de ${dailyBudgetRon} RON/zi e sub recomandarea de ~${rec.recommended_min}–${rec.recommended_max} RON/zi — Meta poate învăța greu. Lansăm oricum, dar așteaptă-te la rezultate mai lente.`;
  }
  if (dailyBudgetRon < 30 && (objective === "sales" || objective === "signups")) {
    return `Sub 30 RON/zi pe ${objective}, conversiile vin rar — Pixelul are nevoie de volume.`;
  }
  return null;
}

/**
 * Suggest 2–3 Instant Form qualification questions from business type + offer.
 * Works for any niche via keyword heuristics; always returns valid Meta-sized labels.
 */
export function suggestNicheFormQuestions(
  businessType: string,
  offer?: string,
): CustomQuestion[] {
  const raw = `${businessType} ${offer ?? ""}`.toLowerCase();
  const t = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/stomat|dentist|implant|ortodont|detartraj/.test(t)) {
    return [
      {
        label: "Ce te interesează?",
        type: "choice",
        options: ["1 implant", "Mai multe", "Consultație / nu știu încă"].slice(0, 6),
      },
      {
        label: "Când vrei să vii?",
        type: "choice",
        options: ["Cât mai curând", "În ~2 săptămâni", "Doar informații"],
      },
    ];
  }
  if (/salon|frizer|coafor|unghii|manichiur|beauty|estetic/.test(t)) {
    return [
      {
        label: "Ce serviciu vrei?",
        type: "choice",
        options: ["Tunsoare", "Culoare / vopsit", "Unghii", "Altceva"],
      },
      {
        label: "Ai o dată preferată?",
        type: "short",
      },
    ];
  }
  if (/restaurant|catering|pizza|mancare|food/.test(t)) {
    return [
      {
        label: "Pentru ce?",
        type: "choice",
        options: ["Masă în local", "Catering / eveniment", "Livrare", "Altceva"],
      },
      { label: "Pentru câte persoane (aprox.)?", type: "short" },
    ];
  }
  if (/imobil|apartament|chirie|vanzare casa|agentie/.test(t)) {
    return [
      {
        label: "Ce cauți?",
        type: "choice",
        options: ["Cumpărare", "Închiriere", "Investiție", "Doar info"],
      },
      { label: "Buget aproximativ?", type: "short" },
    ];
  }
  if (/auto|dealer|masina|service auto/.test(t)) {
    return [
      {
        label: "Ce te interesează?",
        type: "choice",
        options: ["Cumpărare", "Service", "Trade-in", "Doar info"],
      },
      { label: "Model / buget aproximativ?", type: "short" },
    ];
  }
  if (/fitness|sala|gym|antrenament|personal trainer/.test(t)) {
    return [
      {
        label: "Ce cauți?",
        type: "choice",
        options: ["Abonament", "Antrenor personal", "Transformare", "Doar info"],
      },
      {
        label: "Când vrei să începi?",
        type: "choice",
        options: ["Săptămâna asta", "În 2 săptămâni", "Mai târziu"],
      },
    ];
  }
  if (/avocat|notar|contabil|consultan|b2b|saas|software|agentie/.test(t)) {
    return [
      {
        label: "Ce ai nevoie?",
        type: "short",
      },
      {
        label: "Când vrei să discutăm?",
        type: "choice",
        options: ["Cât mai curând", "Săptămâna viitoare", "Doar informații"],
      },
    ];
  }
  if (/curs|scoala|educatie|training|coaching/.test(t)) {
    return [
      {
        label: "Ce te interesează?",
        type: "short",
      },
      {
        label: "Nivelul tău?",
        type: "choice",
        options: ["Începător", "Intermediar", "Avansat", "Nu știu"],
      },
    ];
  }

  // Generic high-quality default for any other business
  return [
    {
      label: "Ce te interesează?",
      type: "short",
    },
    {
      label: "Când vrei să te contactăm?",
      type: "choice",
      options: ["Cât mai curând", "În această săptămână", "Doar informații"],
    },
  ];
}

/** Normalize up to N creative variants for Meta (headline/primary limits). */
export function normalizeCreatives(
  primary: { headline: string; primary_text: string; description?: string; cta?: string },
  variants: CreativeVariant[] | undefined,
  maxCount: number,
): CreativeVariant[] {
  const fromVariants = (variants ?? [])
    .map((v) => ({
      angle: v.angle,
      headline: String(v.headline ?? "").trim().slice(0, 40),
      primary_text: String(v.primary_text ?? "").trim().slice(0, 500),
      description: v.description ? String(v.description).trim().slice(0, 30) : undefined,
      cta: v.cta,
    }))
    .filter((v) => v.headline && v.primary_text);

  if (fromVariants.length >= 1) {
    // Dedupe near-identical headlines
    const seen = new Set<string>();
    const unique: CreativeVariant[] = [];
    for (const v of fromVariants) {
      const key = v.headline.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(v);
      if (unique.length >= maxCount) break;
    }
    if (unique.length >= Math.min(2, maxCount)) return unique;
  }

  // Fallback: single primary creative
  return [
    {
      angle: "primary",
      headline: String(primary.headline).trim().slice(0, 40),
      primary_text: String(primary.primary_text).trim().slice(0, 500),
      description: primary.description ? String(primary.description).trim().slice(0, 30) : undefined,
      cta: primary.cta,
    },
  ];
}

/** Map DB / agent objective strings back to agent enum for retry. */
export function objectiveFromDraft(
  dbObjective: string | null | undefined,
  snapshot?: AgentPublishSnapshot | null,
): AgentObjective {
  if (snapshot?.objective) return snapshot.objective;
  switch (dbObjective) {
    case "LINK_CLICKS":
      return "traffic";
    case "CONVERSIONS":
      return "sales";
    case "LEAD_GENERATION":
    default:
      return "leads";
  }
}

export type PublishErrorHint = {
  category: "dsa" | "rate_limit" | "permission" | "media" | "pixel" | "targeting" | "budget" | "policy" | "account" | "unknown";
  /** Tipul exact al problemei Meta (vezi meta-errors.server.ts). */
  kind?: MetaProblemKind;
  user_message: string;
  retryable: boolean;
  fix?: string;
  link?: string;
  /** true doar când problema nu e una cunoscută — abia atunci se deschide tichet. */
  needs_human?: boolean;
};

/** Clasifică o eroare de publicare Meta și dă pasul clar pentru om (vezi explainMetaError). */
export function classifyPublishError(error: string, ctx: MetaProblemContext = {}): PublishErrorHint {
  const m = error.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/pixel|promoted_object|custom_event/.test(m)) {
    return {
      category: "pixel",
      user_message:
        "Problema e legată de Pixel. Verificăm Pixelul (trebuie să trimită evenimente) sau lansăm pe trafic până îl repari.",
      retryable: true,
      fix: "check_pixel",
    };
  }
  const p = explainMetaError(error, ctx);
  const category: PublishErrorHint["category"] =
    p.kind === "checkpoint" || p.kind === "profile_restricted" || p.kind === "account_closed" || p.kind === "account_disabled"
      ? "account"
      : p.kind === "unsettled" || p.kind === "no_payment"
        ? "budget"
        : p.kind === "lead_terms"
          ? "permission"
          : (p.kind as PublishErrorHint["category"]);
  const fix: Record<MetaProblemKind, string | undefined> = {
    checkpoint: "confirm_identity_in_ads_manager",
    profile_restricted: "request_review",
    unsettled: "pay_balance",
    account_closed: "switch_ad_account",
    account_disabled: "switch_ad_account",
    no_payment: "add_card",
    lead_terms: "accept_lead_terms",
    permission: "reconnect_meta",
    rate_limit: "wait_then_retry",
    dsa: "ask_beneficiary",
    media: "resend_media",
    policy: "revise_copy",
    targeting: "fix_targeting",
    unknown: undefined,
  };
  return {
    category,
    kind: p.kind,
    user_message: p.user_message,
    retryable: p.kind !== "unknown",
    fix: fix[p.kind],
    link: p.link,
    needs_human: p.needs_human,
  };
}

/** Pixel considered healthy if it fired within the last 30 days. */
export function isPixelHealthy(lastFiredTime: string | null | undefined): boolean {
  if (!lastFiredTime) return false;
  const t = new Date(lastFiredTime).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 30 * 86_400_000;
}

/** Raza implicită (km) după mărimea orașului: orașele mari au periferii întinse. */
export function radiusForCity(city?: string | null): number {
  const c = (city ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!c) return 25;
  if (/bucuresti|bucharest/.test(c)) return 25;
  if (/cluj|timisoara|iasi|constanta|brasov|craiova|galati|ploiesti|oradea|braila|arad|sibiu|bacau/.test(c)) return 20;
  return 17;
}

/** Ce promite creativul (textul de pe poză): dacă spune „scrie-ne”, reclama trebuie să ducă la mesaje. */
export function detectCreativePromise(text?: string | null): "messages" | "calls" | null {
  const t = (text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/scrie-?ne|whats ?app|\bmesaj|\bdm\b|inbox|messenger|trimite-?ne un mesaj/.test(t)) return "messages";
  if (/suna(-ne)?\b|sunati|apeleaza|\btel(efon)?\b|\b07\d{2}[\s.]?\d{3}/.test(t)) return "calls";
  return null;
}
