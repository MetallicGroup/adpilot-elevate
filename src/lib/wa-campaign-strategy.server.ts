/**
 * Domain-agnostic campaign strategy helpers for the WhatsApp agent.
 * Pure logic — no Meta Graph calls.
 */

export type AgentObjective = "leads" | "sales" | "calls" | "traffic" | "signups";

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
};

/** How many ads to launch in one ad set for a given daily budget (RON). */
export function creativeCountForBudget(dailyBudgetRon: number): number {
  if (dailyBudgetRon >= 200) return 6;
  if (dailyBudgetRon >= 100) return 4;
  return 3;
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

  if (fromVariants.length >= 2) {
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
    if (unique.length >= 2) return unique;
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
  category: "dsa" | "rate_limit" | "permission" | "media" | "pixel" | "targeting" | "budget" | "policy" | "unknown";
  user_message: string;
  retryable: boolean;
  fix?: string;
};

/** Classify Meta publish errors for smart retry messaging. */
export function classifyPublishError(error: string): PublishErrorHint {
  const m = error.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/too many calls|rate.?limit|call limit/.test(m)) {
    return {
      category: "rate_limit",
      user_message:
        "Meta a blocat temporar contul (prea multe apeluri). Așteaptă 15–30 min, apoi scrie *încearcă iar* — draftul rămâne salvat.",
      retryable: true,
      fix: "wait_then_retry",
    };
  }
  if (/beneficiar|beneficiary|payer|payor|person or organization|dsa/.test(m)) {
    return {
      category: "dsa",
      user_message:
        "Meta cere numele firmei/persoanei promovate (regula UE). Scrie-mi exact denumirea legală și reîncerc.",
      retryable: true,
      fix: "ask_beneficiary",
    };
  }
  if (/pages_manage_ads|\(#200\)|permission|oauth|\(#10\)/.test(m)) {
    return {
      category: "permission",
      user_message:
        "Lipsește o permisiune Meta. Reconectează contul din Setări (acceptă toate permisiunile) și spune *încearcă iar*.",
      retryable: true,
      fix: "reconnect_meta",
    };
  }
  if (/image|video|adimage|advideo|media|hash|thumbnail|format/.test(m)) {
    return {
      category: "media",
      user_message:
        "Problema e la poză/video. Trimite din nou media pe WhatsApp (JPG/PNG sau MP4) și spune *încearcă iar*.",
      retryable: true,
      fix: "resend_media",
    };
  }
  if (/pixel|promoted_object|custom_event/.test(m)) {
    return {
      category: "pixel",
      user_message:
        "Problema e legată de Pixel. Verificăm Pixelul (trebuie să trimită evenimente) sau lansăm pe trafic până îl repari.",
      retryable: true,
      fix: "check_pixel",
    };
  }
  if (/city|geo|targeting|interest|audience|age/.test(m)) {
    return {
      category: "targeting",
      user_message:
        "Targetarea a fost respinsă (oraș/vârstă/interes). Spune-mi alt oraș sau interval de vârstă și reîncerc.",
      retryable: true,
      fix: "fix_targeting",
    };
  }
  if (/budget|billing|payment|account.?status|disabled|unsettled/.test(m)) {
    return {
      category: "budget",
      user_message:
        "Contul de reclame are o problemă de plată/status pe Meta. Verifică billing-ul în Ads Manager, apoi *încearcă iar*.",
      retryable: true,
      fix: "fix_billing",
    };
  }
  if (/policy|disapprove|rejected|advertising standards|restricted/.test(m)) {
    return {
      category: "policy",
      user_message:
        "Meta a blocat textul/creativul (politici ads). Schimbă copy-ul (fără claim-uri medicale absolute) și spune *încearcă iar*.",
      retryable: true,
      fix: "revise_copy",
    };
  }
  return {
    category: "unknown",
    user_message: `Nu a mers încă. Motivul real: ${error}`,
    retryable: true,
  };
}

/** Pixel considered healthy if it fired within the last 30 days. */
export function isPixelHealthy(lastFiredTime: string | null | undefined): boolean {
  if (!lastFiredTime) return false;
  const t = new Date(lastFiredTime).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 30 * 86_400_000;
}
