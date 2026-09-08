/**
 * Link de plată Stripe (găzduit) pentru reactivarea unui cont după expirarea
 * perioadei gratuite. Generat pe server (ex. din cron / bot WhatsApp) pentru un
 * user anume, cu ASOCIERE GARANTATĂ la contul lui:
 *   - client_reference_id = userId
 *   - metadata.userId + subscription_data.metadata.userId = userId
 * Webhook-ul Stripe existent citește `subscription_data.metadata.userId` și scrie
 * abonamentul pe contul respectiv → după plată, contul e reactivat automat.
 */
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

/** Mediul de plăți pentru build-ul curent (din prefixul token-ului public). */
function serverPaymentsEnv(): StripeEnv {
  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "";
  return token.startsWith("pk_live_") ? "live" : "sandbox";
}

/** chosen_plan → lookup_key Stripe. */
export function planLookupKey(chosen: string | null | undefined): string | null {
  const v = (chosen ?? "").toLowerCase();
  if (v.includes("premium")) return "premium_monthly";
  if (v.includes("pro")) return "pro_monthly";
  return null; // Starter/gratuit nu are plată
}

/**
 * Creează o sesiune de checkout GĂZDUITĂ (redirect) și întoarce URL-ul, gata de
 * trimis pe WhatsApp. Întoarce null dacă planul nu e plătibil sau apare o eroare.
 */
export async function createReactivationCheckoutUrl(params: {
  userId: string;
  email?: string | null;
  chosenPlan: string | null;
}): Promise<{ url: string | null; error?: string }> {
  const lookupKey = planLookupKey(params.chosenPlan);
  if (!lookupKey) return { url: null, error: "no_paid_plan" };
  if (!/^[a-zA-Z0-9_-]+$/.test(params.userId)) return { url: null, error: "bad_user" };

  try {
    const env = serverPaymentsEnv();
    const stripe = createStripeClient(env);

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey] });
    if (!prices.data.length) return { url: null, error: "price_not_found" };
    const price = prices.data[0];

    // Customer după metadata.userId (sau după email), altfel îl creăm.
    let customerId: string | undefined;
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${params.userId}'`,
      limit: 1,
    });
    if (found.data.length) customerId = found.data[0].id;
    else if (params.email) {
      const existing = await stripe.customers.list({ email: params.email, limit: 1 });
      if (existing.data.length) {
        customerId = existing.data[0].id;
        if (existing.data[0].metadata?.userId !== params.userId) {
          await stripe.customers.update(customerId, {
            metadata: { ...existing.data[0].metadata, userId: params.userId },
          });
        }
      }
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        ...(params.email ? { email: params.email } : {}),
        metadata: { userId: params.userId },
      });
      customerId = created.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      customer: customerId,
      client_reference_id: params.userId,
      metadata: { userId: params.userId },
      subscription_data: { metadata: { userId: params.userId } },
      payment_method_collection: "always",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      automatic_tax: { enabled: true },
      success_url: "https://www.adpilot.ro/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://www.adpilot.ro/pricing",
    });
    return { url: session.url ?? null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : String(e) };
  }
}
