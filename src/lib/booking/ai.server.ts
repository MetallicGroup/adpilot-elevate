import { z } from "zod";
import { BOOKING_QUESTION_TYPES, type BookingQuestion, type LandingCopy } from "./types";
import { presetQuestions } from "./question-presets";
import { BUSINESS_NICHES } from "@/lib/launcher/presets";
import type { BusinessNiche } from "@/lib/launcher/types";

async function askAi(system: string, user: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `${system}\nRăspunzi DOAR cu JSON valid, fără markdown, în limba română.` },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI gateway error (${res.status})`);
  const json: any = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? "").replace(/```json\s*|\s*```/g, "").trim();
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/[[{][\s\S]*[\]}]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

const AiQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(3).max(140),
  type: z.enum(BOOKING_QUESTION_TYPES as [string, ...string[]]),
  options: z.array(z.string().min(1).max(60)).max(8).optional(),
  required: z.boolean().optional(),
});

const RESERVED_KEYS = new Set(["full_name", "name", "phone", "telefon", "email", "nume"]);

/** Preset + AI: întrebări de calificare adaptate nișei, serviciului și ofertei. */
export async function generateBookingQuestions(input: {
  niche: BusinessNiche;
  nicheCustom?: string | null;
  businessName: string;
  city?: string | null;
  service: string;
  offer?: string | null;
}): Promise<BookingQuestion[]> {
  const fallback = presetQuestions(input.niche).slice(0, 5);
  const nicheTitle = BUSINESS_NICHES.find((n) => n.id === input.niche)?.title ?? input.nicheCustom ?? "Servicii";

  try {
    const raw = await askAi(
      "Ești expert în conversie pentru landing pages de programări. Scopul e echilibrul între calitatea lead-ului și rata de conversie.",
      `Business: ${input.businessName}
Domeniu: ${nicheTitle}${input.nicheCustom ? ` (${input.nicheCustom})` : ""}
Oraș: ${input.city ?? "-"}
Serviciu promovat: ${input.service}
Ofertă: ${input.offer ?? "-"}

Generează 3-5 întrebări de calificare (maxim 5) pe care le punem persoanei care vrea o programare pentru ACEST serviciu.
Reguli stricte:
- NU include nume, telefon sau email (le cerem separat).
- NU include întrebarea despre dată/oră (avem calendar).
- Întrebările trebuie să fie relevante exact pentru serviciul promovat, nu generice.
- Tipuri permise: ${BOOKING_QUESTION_TYPES.join(", ")}.
- Pentru single_select/multi_select dă 2-5 opțiuni scurte.
- Maxim 1-2 întrebări obligatorii în plus față de prima.

Format: {"questions":[{"id":"snake_case","label":"...","type":"...","options":["..."],"required":true}]}`,
    );
    const parsed = parseJson<{ questions?: unknown[] }>(raw);
    const list = (parsed?.questions ?? [])
      .map((q) => AiQuestionSchema.safeParse(q))
      .filter((r): r is { success: true; data: z.infer<typeof AiQuestionSchema> } => r.success)
      .map((r) => r.data)
      .filter((q) => !RESERVED_KEYS.has(q.id.toLowerCase()))
      .slice(0, 5);

    if (list.length < 2) return fallback;

    const seen = new Set<string>();
    return list
      .filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)))
      .map((q, i) => ({
        key: q.id.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40),
        label: q.label,
        type: q.type as BookingQuestion["type"],
        options: q.type === "single_select" || q.type === "multi_select" ? (q.options ?? []).slice(0, 8) : [],
        required: q.required ?? i === 0,
        position: i,
        source: "ai" as const,
      }))
      .filter((q) => (q.type === "single_select" || q.type === "multi_select" ? q.options.length >= 2 : true));
  } catch {
    return fallback;
  }
}

/** Clasifică un domeniu scris liber într-una din nișele cunoscute. */
export async function classifyNiche(text: string): Promise<BusinessNiche> {
  const ids: string[] = BUSINESS_NICHES.map((n) => String(n.id)).filter((id) => id !== "other");
  try {
    const raw = await askAi(
      "Clasifici domenii de business.",
      `Domeniu scris de client: "${text}".
Alege EXACT un id din lista: ${ids.join(", ")}.
Dacă nu se potrivește nimic, alege "general".
Format: {"niche":"..."}`,
    );
    const parsed = parseJson<{ niche?: string }>(raw);
    const niche = parsed?.niche;
    if (niche && ids.includes(niche)) return niche as BusinessNiche;
  } catch {
    /* fallback below */
  }
  return "general";
}

const LandingSchema = z.object({
  headline: z.string().min(5).max(120),
  subheadline: z.string().min(5).max(220),
  offer_label: z.string().max(80).optional(),
  benefits: z.array(z.string().min(3).max(120)).min(2).max(6),
  about: z.string().min(20).max(700),
  faq: z.array(z.object({ q: z.string().min(5).max(140), a: z.string().min(5).max(400) })).max(5).optional(),
  cta_label: z.string().max(40).optional(),
  trust_points: z.array(z.string().min(2).max(60)).max(5).optional(),
});

export async function generateLandingCopy(input: {
  niche: BusinessNiche;
  nicheCustom?: string | null;
  businessName: string;
  city?: string | null;
  service: string;
  offer?: string | null;
  description?: string | null;
}): Promise<LandingCopy> {
  const nicheTitle = BUSINESS_NICHES.find((n) => n.id === input.niche)?.title ?? input.nicheCustom ?? "Servicii";
  const fallback: LandingCopy = {
    headline: `${input.service} în ${input.city ?? "zona ta"}`,
    subheadline: `Programează-te online la ${input.businessName} în mai puțin de un minut.`,
    offer_label: input.offer ?? "",
    benefits: ["Programare online rapidă", "Confirmare imediată", "Specialiști cu experiență", "Fără drumuri inutile"],
    about: `${input.businessName} oferă ${input.service.toLowerCase()}${input.city ? ` în ${input.city}` : ""}. Alege ziua și ora care ți se potrivesc, iar noi îți confirmăm programarea.`,
    faq: [],
    cta_label: "Programează-te acum",
    trust_points: [],
  };

  try {
    const raw = await askAi(
      "Ești copywriter de landing pages cu conversie mare, mobile-first, în limba română. Ton direct, concret, fără clișee de marketing.",
      `Business: ${input.businessName}
Domeniu: ${nicheTitle}
Oraș: ${input.city ?? "-"}
Serviciu promovat: ${input.service}
Ofertă: ${input.offer ?? "-"}
Descriere business: ${input.description ?? "-"}

Scrie textele pentru un landing page de PROGRAMĂRI dedicat acestui serviciu.
Format JSON: {"headline":"","subheadline":"","offer_label":"","benefits":["",""],"about":"","faq":[{"q":"","a":""}],"cta_label":"","trust_points":["",""]}`,
    );
    const parsed = parseJson<unknown>(raw);
    const ok = LandingSchema.safeParse(parsed);
    if (!ok.success) return fallback;
    return {
      headline: ok.data.headline,
      subheadline: ok.data.subheadline,
      offer_label: ok.data.offer_label ?? input.offer ?? "",
      benefits: ok.data.benefits,
      about: ok.data.about,
      faq: ok.data.faq ?? [],
      cta_label: ok.data.cta_label || "Programează-te acum",
      trust_points: ok.data.trust_points ?? [],
    };
  } catch {
    return fallback;
  }
}
type GoalObjective = "bookings" | "leads" | "calls";

const OBJECTIVE_BRIEF: Record<GoalObjective, { kind: string; cta: string; goal: string }> = {
  bookings: {
    kind: "PROGRAMĂRI",
    cta: "Programează-te acum",
    goal: "vizitatorul să aleagă o zi și o oră din calendar",
  },
  leads: {
    kind: "CERERE DE OFERTĂ",
    cta: "Vreau ofertă",
    goal: "vizitatorul să lase nume și telefon pentru a fi contactat rapid",
  },
  calls: {
    kind: "APEL TELEFONIC",
    cta: "Sună acum",
    goal: "vizitatorul să apese butonul de apel și să sune direct",
  },
};

/** Copy pentru landing page, adaptat obiectivului campaniei (programări / lead-uri / apeluri). */
export async function generateObjectiveLandingCopy(input: {
  objective: GoalObjective;
  businessName: string;
  service: string;
  city?: string | null;
  offer?: string | null;
  description?: string | null;
}): Promise<LandingCopy> {
  const brief = OBJECTIVE_BRIEF[input.objective];
  const fallback: LandingCopy = {
    headline: `${input.service}${input.city ? ` în ${input.city}` : ""}`,
    subheadline:
      input.objective === "calls"
        ? `Sună acum la ${input.businessName} și primești răspuns pe loc.`
        : input.objective === "leads"
          ? `Lasă-ne un număr de telefon și te contactăm în cel mult o oră.`
          : `Programează-te online la ${input.businessName} în mai puțin de un minut.`,
    offer_label: input.offer ?? "",
    benefits: ["Răspuns rapid", "Prețuri corecte", "Specialiști cu experiență", "Fără drumuri inutile"],
    about: `${input.businessName} oferă ${input.service.toLowerCase()}${input.city ? ` în ${input.city}` : ""}.`,
    faq: [],
    cta_label: brief.cta,
    trust_points: [],
  };

  try {
    const raw = await askAi(
      "Ești copywriter de landing pages cu conversie mare, mobile-first, în limba română. Ton direct, concret, fără clișee de marketing.",
      `Business: ${input.businessName}
Oraș: ${input.city ?? "-"}
Serviciu/ofertă promovată: ${input.service}
Ofertă specială: ${input.offer ?? "-"}
Descriere: ${input.description ?? "-"}

Scrie textele pentru un landing page de tip ${brief.kind}.
Obiectiv: ${brief.goal}.
Format JSON: {"headline":"","subheadline":"","offer_label":"","benefits":["",""],"about":"","faq":[{"q":"","a":""}],"cta_label":"","trust_points":["",""]}`,
    );
    const ok = LandingSchema.safeParse(parseJson<unknown>(raw));
    if (!ok.success) return fallback;
    return {
      headline: ok.data.headline,
      subheadline: ok.data.subheadline,
      offer_label: ok.data.offer_label ?? input.offer ?? "",
      benefits: ok.data.benefits,
      about: ok.data.about,
      faq: ok.data.faq ?? [],
      cta_label: ok.data.cta_label || brief.cta,
      trust_points: ok.data.trust_points ?? [],
    };
  } catch {
    return fallback;
  }
}

/** Regenerează o singură secțiune din landing copy („altă variantă"). */
export async function regenerateLandingSection(input: {
  objective: GoalObjective;
  section: "headline" | "subheadline" | "benefits" | "about";
  current: LandingCopy;
  businessName: string;
  service: string;
  city?: string | null;
}): Promise<Partial<LandingCopy>> {
  const brief = OBJECTIVE_BRIEF[input.objective];
  try {
    const raw = await askAi(
      "Ești copywriter de landing pages cu conversie mare, în limba română.",
      `Business: ${input.businessName}. Serviciu: ${input.service}. Oraș: ${input.city ?? "-"}.
Tip pagină: ${brief.kind}. Obiectiv: ${brief.goal}.
Varianta actuală pentru secțiunea "${input.section}": ${JSON.stringify(
        (input.current as Record<string, unknown>)[input.section] ?? "",
      )}.
Scrie o variantă COMPLET diferită, mai bună, pentru aceeași secțiune.
Format JSON: ${
        input.section === "benefits"
          ? '{"benefits":["","","",""]}'
          : `{"${input.section}":""}`
      }`,
    );
    const parsed = parseJson<Record<string, unknown>>(raw);
    if (!parsed) return {};
    if (input.section === "benefits") {
      const list = Array.isArray(parsed.benefits)
        ? parsed.benefits.filter((b): b is string => typeof b === "string").slice(0, 6)
        : [];
      return list.length >= 2 ? { benefits: list } : {};
    }
    const v = parsed[input.section];
    return typeof v === "string" && v.length > 4 ? ({ [input.section]: v } as Partial<LandingCopy>) : {};
  } catch {
    return {};
  }
}
