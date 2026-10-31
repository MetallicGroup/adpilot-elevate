import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession, createUpgradeSession } from "@/lib/payments.functions";

interface Props {
  priceId: string;
  returnUrl?: string;
  /** Plătește doar diferența până la `priceId`, pe abonamentul existent. */
  upgrade?: boolean;
  /** A bifat renunțarea la retragere pentru conținutul livrat imediat. */
  waiver?: boolean;
}

export function StripeEmbeddedCheckout({ priceId, returnUrl, upgrade, waiver }: Props) {
  const createSession = useServerFn(createCheckoutSession);
  const createUpgrade = useServerFn(createUpgradeSession);

  const fetchClientSecret = async (): Promise<string> => {
    // TikTok Pixel: userul a deschis checkout-ul (funnel — InitiateCheckout).
    try {
      (window as unknown as { ttq?: { track?: (e: string, p?: unknown) => void } }).ttq?.track?.(
        "InitiateCheckout",
        { content_id: priceId, content_type: "product" },
      );
    } catch {
      /* ignore */
    }
    const back = returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
    const result = upgrade
      ? await createUpgrade({ data: { toPriceId: priceId, returnUrl: back, environment: getStripeEnvironment() } })
      : await createSession({ data: { priceId, returnUrl: back, environment: getStripeEnvironment(), waiver } });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe nu a returnat un client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}