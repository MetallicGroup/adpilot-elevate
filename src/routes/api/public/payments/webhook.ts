import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";

let _supabase: any | null = null;
async function getSupabase(): Promise<any> {
  if (!_supabase) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    _supabase = supabaseAdmin;
  }
  return _supabase;
}

function resolvePriceId(item: any): string {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id ||
    ""
  );
}

/**
 * Card verification: charge 1 leu on the saved card and refund it immediately.
 * Runs once per customer (guarded by customer metadata).
 */
async function verifyCardWithOneLeu(subscription: any, env: StripeEnv) {
  try {
    const stripe = createStripeClient(env);
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (!customerId) return;

    const customer: any = await stripe.customers.retrieve(customerId);
    if (customer?.deleted) return;
    if (customer?.metadata?.card_verified === "true") return;

    let paymentMethod =
      (typeof subscription.default_payment_method === "string"
        ? subscription.default_payment_method
        : subscription.default_payment_method?.id) ||
      (typeof customer?.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer?.invoice_settings?.default_payment_method?.id);

    if (!paymentMethod) {
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
      paymentMethod = pms.data[0]?.id;
    }
    if (!paymentMethod) return;

    const intent = await stripe.paymentIntents.create({
      amount: 100, // 1,00 RON
      currency: "ron",
      customer: customerId,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true,
      description: "AdPilot — verificare card (1 leu, se returnează imediat)",
      metadata: { kind: "card_verification", subscription: subscription.id },
    });

    if (intent.status === "succeeded") {
      await stripe.refunds.create({ payment_intent: intent.id });
    }
    await stripe.customers.update(customerId, {
      metadata: { ...(customer.metadata ?? {}), card_verified: "true" },
    });
  } catch (e) {
    console.error("[webhook] card verification failed:", e);
  }
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("[webhook] No userId in subscription metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = resolvePriceId(item);
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const sb = await getSupabase();
  await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId ?? "",
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  await verifyCardWithOneLeu(subscription, env);
  await notifyOwnerOfSubscription(subscription, env, userId, priceId, item);

  // TikTok Events API — conversie „Purchase" (abonament nou) pentru reclamele AdPilot pe TikTok.
  try {
    const { sendTikTokEvent } = await import("@/lib/tiktok-events.server");
    const unit = item?.price?.unit_amount;
    const value = typeof unit === "number" ? unit / 100 : undefined;
    const currency = (item?.price?.currency ?? "ron").toUpperCase();
    let email: string | null = null;
    try {
      const { data } = await sb.auth.admin.getUserById(userId);
      email = data?.user?.email ?? null;
    } catch {
      /* ignore */
    }
    await sendTikTokEvent("Purchase", {
      eventId: `sub_${subscription.id}`,
      url: "https://www.adpilot.ro/pricing",
      user: { email, externalId: userId },
      value,
      currency,
      contentId: priceId,
    });
  } catch (e) {
    console.error("[webhook] tiktok purchase event failed", e);
  }
}

/** WhatsApp "cha-ching" to the AdPilot owner on every new subscription. */
async function notifyOwnerOfSubscription(
  subscription: any,
  env: StripeEnv,
  userId: string,
  priceId: string,
  item: any,
) {
  try {
    const sb = await getSupabase();
    const [{ data: userRes }, { data: profile }, { data: biz }] = await Promise.all([
      sb.auth.admin.getUserById(userId),
      sb.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      sb
        .from("business_profiles")
        .select("name, niche, niche_custom, website, phone")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const unit = item?.price?.unit_amount;
    const currency = (item?.price?.currency ?? "ron").toUpperCase();
    const amount = typeof unit === "number" ? `${(unit / 100).toFixed(2)} ${currency}` : null;

    const { notifyAdminNewSubscription } = await import("@/lib/whatsapp/admin-alerts.server");
    await notifyAdminNewSubscription({
      email: userRes?.user?.email ?? null,
      name: profile?.full_name ?? (userRes?.user?.user_metadata as any)?.full_name ?? null,
      plan: priceId || null,
      amount,
      status: subscription.status ?? null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toLocaleString("ro-RO", {
            timeZone: "Europe/Bucharest",
          })
        : null,
      business: biz?.name ?? null,
      niche: biz?.niche_custom || biz?.niche || null,
      website: biz?.website ?? null,
      phone: biz?.phone ?? null,
      environment: env,
    });
  } catch (e) {
    console.error("[webhook] owner notification failed:", e);
  }
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = resolvePriceId(item);
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const sb = await getSupabase();
  await sb
    .from("subscriptions")
    .update({
      status: subscription.status,
      product_id: productId ?? "",
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const sb = await getSupabase();
  await sb
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("[webhook] unhandled", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[webhook] invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});