/**
 * Access central (server-only) — o singură sursă de adevăr pentru ce are voie un
 * user: plan plătit (Pro/Premium/comp) SAU planul „Starter gratuit 3 zile/lună".
 *
 * Free Starter (fără card, urmărit pe `profiles`):
 *  - `free_plan_month`      = 'YYYY-MM' al lunii în care a activat gratuitul
 *  - `free_plan_started_at` = când a devenit ACTIVĂ prima reclamă (start ceas 3 zile)
 *  - `free_plan_notified_at`= când i-am trimis mesajul „consumat" (dedupe/lună)
 *
 * Reset lunar implicit: dacă `free_plan_month != luna curentă` → e din nou eligibil.
 */
import { getUserPlanTier, type PlanTier } from "@/lib/plan.server";

export const FREE_STARTER_DAYS = 3;

export const PRICING_URL = "https://adpilot.ro/pricing";

/** Mesaj (text liber, în fereastra de 24h) când planul gratuit s-a consumat. */
export const FREE_STARTER_CONSUMED_MESSAGE =
  "⏸️ Ți-am oprit reclamele — cele 3 zile gratuite din planul Starter s-au consumat.\n\n" +
  "Reclamele funcționează doar dacă rulează NON-STOP: pornit-oprit le omoară rezultatele. " +
  "Pe Pro și Premium campaniile tale merg continuu, fără pauze, și aduc clienți zilnic:\n" +
  "• Pro — campanii NELIMITATE, non-stop + asistent WhatsApp + 10 poze AI/lună\n" +
  "• Premium — tot din Pro + poze AI nelimitate + manager dedicat\n\n" +
  `Pornește un plan acum: ${PRICING_URL}\n` +
  "(Planul gratuit revine oricum luna viitoare.)";

/** Mesaj când userul n-a ales încă un plan. */
export const CHOOSE_PLAN_MESSAGE =
  "Ca să folosești asistentul AdPilot pe WhatsApp, alege mai întâi un plan în aplicație " +
  "(Starter gratuit 3 zile, Pro sau Premium). 👉 https://adpilot.ro/onboarding";

export type FreeStarterState = "none" | "eligible" | "active" | "consumed";

export type Access = {
  tier: PlanTier;
  paid: boolean;
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

export async function resolveAccess(
  supabaseAdmin: any,
  userId: string,
): Promise<Access> {
  const tier = await getUserPlanTier(supabaseAdmin, userId);
  const paid = tier === "pro" || tier === "premium";

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("free_plan_month, free_plan_started_at")
    .eq("id", userId)
    .maybeSingle();

  const month = currentPlanMonth();
  const fpMonth: string | null = profile?.free_plan_month ?? null;
  const startedAt: string | null = profile?.free_plan_started_at ?? null;

  let state: FreeStarterState;
  let endsAt: string | null = null;
  if (fpMonth !== month) {
    state = "eligible"; // lună nouă (sau niciodată) → poate porni gratuitul
  } else if (!startedAt) {
    state = "active"; // ales luna asta, dar ceasul n-a pornit (nicio reclamă activă încă)
  } else {
    const end = new Date(startedAt).getTime() + FREE_STARTER_DAYS * 86_400_000;
    endsAt = new Date(end).toISOString();
    state = Date.now() < end ? "active" : "consumed";
  }

  const freeActive = !paid && state === "active";
  return {
    tier,
    paid,
    freeStarter: { state: paid ? "none" : state, month: fpMonth, startedAt, endsAt },
    whatsappAllowed: paid || freeActive,
    botAllowed: paid || freeActive,
  };
}

/**
 * Gate la publicarea unei campanii: Pro/Premium = nelimitat; Starter gratuit = O
 * SINGURĂ campanie (motivul de upgrade e „campanii nelimitate, non-stop"). Aruncă
 * un mesaj clar dacă nu e permis. Se apelează pe ambele căi (bot + web).
 */
export async function assertCanPublishCampaign(
  supabaseAdmin: any,
  userId: string,
  opts: { excludeCampaignId?: string } = {},
): Promise<void> {
  const access = await resolveAccess(supabaseAdmin, userId);
  if (access.paid) return; // nelimitat

  if (access.freeStarter.state === "consumed") {
    throw new Error(
      `Planul gratuit s-a consumat luna aceasta. Treci pe Pro sau Premium ca să lansezi campanii non-stop: ${PRICING_URL}`,
    );
  }
  if (access.freeStarter.state !== "active") {
    throw new Error(`Alege mai întâi un plan ca să lansezi o campanie: ${PRICING_URL}`);
  }

  // Starter gratuit activ → cel mult 1 campanie publicată pe Meta (excludem
  // campania curentă, ca o re-publicare a aceleiași campanii să nu fie blocată).
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
