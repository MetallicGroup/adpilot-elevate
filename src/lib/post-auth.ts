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
