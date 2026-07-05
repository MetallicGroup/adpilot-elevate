import { getOnboardingStatus } from "@/lib/onboarding.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export async function resolvePostAuthPath(): Promise<"/dashboard" | "/onboarding"> {
  try {
    const status = await getOnboardingStatus({
      data: { environment: getStripeEnvironment() },
    });
    return status.hasMetaConnection && status.hasActiveSubscription
      ? "/dashboard"
      : "/onboarding";
  } catch {
    return "/onboarding";
  }
}
