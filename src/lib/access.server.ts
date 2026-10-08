/**
 * Access central (server-only) — o singură sursă de adevăr pentru ce are voie un user.
 *
 * Model nou:
 *  1) PLĂTIT (Pro/Premium/comp) → acces nelimitat.
 *  2) TRIAL DE ÎNSCRIERE: 7 zile gratuite de la CREAREA contului
 *     (`profiles.signup_trial_ends_at` = created_at + 7 zile). Acces complet,
 *     indiferent de planul ales, fără card.
 *  3) După trial: dacă a ales planul GRATUIT (Starter) → 7 zile gratuite/lună
 *     (reset lunar). Dacă a ales Pro/Premium și n-a plătit → NU are acces (primește
 *     pe WhatsApp link de plată Stripe pentru planul ales).
 *
 * Free Starter lunar (doar pt. chosen_plan='starter', urmărit pe `profiles`):
 *  - `free_plan_month`      = 'YYYY-MM' al lunii în care a pornit ceasul
 *  - `free_plan_started_at` = când a devenit ACTIVĂ prima reclamă (start ceas 7 zile)
 *  - `free_plan_notified_at`= când i-am trimis mesajul „consumat" (dedupe/lună)
 */
import { getUserPlanTier, type PlanTier } from "@/lib/plan.server";

export const SIGNUP_TRIAL_DAYS = 7;
export const FREE_STARTER_DAYS = 7;

export const PRICING_URL = "https://adpilot.ro/pricing";

/** Mesaj când planul gratuit (7 zile/lună) s-a consumat luna aceasta. */
export const FREE_STARTER_CONSUMED_MESSAGE =
  "⏸️ Ți-am oprit reclamele — cele 7 zile gratuite din planul Starter s-au consumat luna aceasta.\n\n" +
  "Reclamele funcționează doar dacă rulează NON-STOP: pornit-oprit le omoară rezultatele. " +
  "Pe Pro și Premium campaniile tale merg continuu și aduc clienți zilnic:\n" +
  "• Pro — campanii NELIMITATE, non-stop + asistent WhatsApp + 10 poze AI/lună\n" +
  "• Premium — tot din Pro + poze AI nelimitate + manager dedicat\n\n" +
  `Pornește un plan acum: ${PRICING_URL}\n` +
  "(Planul gratuit revine oricum luna viitoare, cu alte 7 zile.)";

/** Mesaj când userul n-a ales încă un plan. */
export const CHOOSE_PLAN_MESSAGE =
  "Ca să folosești asistentul AdPilot pe WhatsApp, alege mai întâi un plan în aplicație " +
  "(Starter gratuit, Pro sau Premium). 👉 https://adpilot.ro/onboarding";

export type FreeStarterState = "none" | "eligible" | "active" | "consumed";

export type Access = {
  tier: PlanTier;
  paid: boolean;
  chosenPlan: string | null;
  signupTrial: { active: boolean; endsAt: string | null };
  freeStarter: {
    state: FreeStarterState;
    month: string | null;
    startedAt: string | null;
    endsAt: string | null;
  };
  whatsappAllowed: boolean;
  botAllowed: boolean;
};

/** Luna curentă în format 'YYYY-MM', pe fusul Europe/Bucharest. */
export function currentPlanMonth(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
  }).format(d); // ex. "2026-08"
}

/** true dacă planul ales e cel gratuit (Starter) sau încă nu s-a ales nimic clar. */
export function isFreeChoice(chosen: string | null | undefined): boolean {
  const v = (chosen ?? "").toLowerCase();
  return v === "" || v === "starter" || v === "free" || v === "gratuit";
}

export async function resolveAccess(
  supabaseAdmin: any,
  userId: string,
): Promise<Access> {
  const tier = await getUserPlanTier(supabaseAdmin, userId);
  const paid = tier === "pro" || tier === "premium";

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select(
      "chosen_plan, signup_trial_ends_at, free_plan_month, free_plan_started_at",
    )
    .eq("id", userId)
    .maybeSingle();

  const chosenPlan: string | null = profile?.chosen_plan ?? null;

  // 7 zile de la crearea contului.
  const trialEndsAt: string | null = profile?.signup_trial_ends_at ?? null;
  const signupActive = !paid && !!trialEndsAt && Date.now() < new Date(trialEndsAt).getTime();

  // Free Starter lunar (7 zile), relevant DOAR pentru cei care au ales gratuitul.
  const month = currentPlanMonth();
  const fpMonth: string | null = profile?.free_plan_month ?? null;
  const startedAt: string | null = profile?.free_plan_started_at ?? null;
  let fsState: FreeStarterState;
  let fsEndsAt: string | null = null;
  if (fpMonth !== month) {
    fsState = "eligible"; // lună nouă (sau niciodată) → poate porni gratuitul
  } else if (!startedAt) {
    fsState = "active"; // ales luna asta, ceasul n-a pornit (nicio reclamă activă încă)
  } else {
    const end = new Date(startedAt).getTime() + FREE_STARTER_DAYS * 86_400_000;
    fsEndsAt = new Date(end).toISOString();
    fsState = Date.now() < end ? "active" : "consumed";
  }

  const starterChoice = isFreeChoice(chosenPlan);
  const freeStarterActive = !paid && starterChoice && (fsState === "active" || fsState === "eligible");

  const allowed = paid || signupActive || freeStarterActive;
  return {
    tier,
    paid,
    chosenPlan,
    signupTrial: { active: signupActive, endsAt: trialEndsAt },
    freeStarter: {
      state: paid ? "none" : starterChoice ? fsState : "none",
      month: fpMonth,
      startedAt,
      endsAt: fsEndsAt,
    },
    whatsappAllowed: allowed,
    botAllowed: allowed,
  };
}

/**
 * Gate la publicarea unei campanii:
 *  - Plătit sau în trialul de 7 zile → nelimitat.
 *  - Starter gratuit (7 zile/lună) → O SINGURĂ campanie.
 *  - Altfel → blocat (alege/plătește un plan).
 */
export async function assertCanPublishCampaign(
  supabaseAdmin: any,
  userId: string,
  opts: { excludeCampaignId?: string } = {},
): Promise<void> {
  const access = await resolveAccess(supabaseAdmin, userId);
  if (access.paid || access.signupTrial.active) return; // nelimitat

  if (!access.whatsappAllowed) {
    if (access.freeStarter.state === "consumed") {
      throw new Error(
        `Planul gratuit s-a consumat luna aceasta. Treci pe Pro sau Premium ca să lansezi campanii non-stop: ${PRICING_URL}`,
      );
    }
    throw new Error(
      `Perioada gratuită s-a încheiat. Alege și plătește un plan ca să lansezi campanii: ${PRICING_URL}`,
    );
  }

  // Starter gratuit activ → cel mult 1 campanie publicată pe Meta.
  let q = supabaseAdmin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("platform", "meta")
    .not("meta_campaign_id", "is", null);
  if (opts.excludeCampaignId) q = q.neq("id", opts.excludeCampaignId);
  const { count } = await q;
  if ((count ?? 0) >= 1) {
    throw new Error(
      `Planul Starter gratuit include o singură campanie. Treci pe Pro sau Premium pentru campanii NELIMITATE, care rulează non-stop: ${PRICING_URL}`,
    );
  }
}
