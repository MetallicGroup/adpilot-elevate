import { getOnboardingStatus } from "@/lib/onboarding.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export async function resolvePostAuthPath(): Promise<"/dashboard" | "/onboarding"> {
  try {
    const status = await getOnboardingStatus({
      data: { environment: getStripeEnvironment() },
    });
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
