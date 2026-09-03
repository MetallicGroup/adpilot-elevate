import { getOnboardingStatus } from "@/lib/onboarding.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export async function resolvePostAuthPath(): Promise<"/dashboard" | "/onboarding" | "/agency/dashboard"> {
  try {
    const status = await getOnboardingStatus({
      data: { environment: getStripeEnvironment() },
    });
    if (status.accountType === "agency") return "/agency/dashboard";
    const complete =
      status.isAdmin ||
      status.hasActiveSubscription ||
      (!status.needsEmail &&
        status.hasMetaConnection &&
        status.planChosen &&
        status.whatsappConnected);
    return complete ? "/dashboard" : "/onboarding";
  } catch {
    return "/onboarding";
  }
}

const AGENCY_INTENT_KEY = "adpilot:agency_intent";

/** Marchează intenția de a crea o agenție (setat pe CTA-ul din /agentie). */
export function markAgencyIntent() {
  try {
    localStorage.setItem(AGENCY_INTENT_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Destinația post-autentificare, care onorează intenția de agenție chiar și după
 * confirmarea pe email (când parametrul `redirect` se pierde). Client-only.
 */
export async function postAuthDest(): Promise<
  "/dashboard" | "/onboarding" | "/agency/dashboard" | "/agency/setup"
> {
  let intent = false;
  try {
    intent = typeof window !== "undefined" && localStorage.getItem(AGENCY_INTENT_KEY) === "1";
  } catch {
    /* ignore */
  }
  const dest = await resolvePostAuthPath();
  if (intent) {
    try {
      localStorage.removeItem(AGENCY_INTENT_KEY);
    } catch {
      /* ignore */
    }
    // Agenția deja existentă → dashboard; altfel du-l la crearea agenției.
    return dest === "/agency/dashboard" ? dest : "/agency/setup";
  }
  return dest;
}
