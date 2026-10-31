/**
 * Upgrade pe diferență: omul plătește o dată diferența dintre pachete, iar abonamentul trece pe
 * noul preț fără calcul pe zile. Calculul Stripe pe zile ar da 14 clipuri în plus pentru ~14 lei
 * în ultima zi din lună. Reînnoirea rămâne la aceeași dată, la prețul noului pachet.
 */
import { type StripeEnv, createStripeClient } from "./stripe.server";

/** Aplică plata de upgrade; se poate chema de mai multe ori (întoarcerea din plată și webhook-ul). */
export async function applyPaidUpgrade(env: StripeEnv, session: any): Promise<boolean> {
  const m = session?.metadata ?? {};
  if (m.kind !== "upgrade" || session.payment_status !== "paid" || !m.subscriptionId || !m.toPriceId) return false;
  const stripe = createStripeClient(env);
  const prices = await stripe.prices.list({ lookup_keys: [m.toPriceId] });
  const price = prices.data[0];
  if (!price) throw new Error(`Preț inexistent: ${m.toPriceId}`);
  const sub = await stripe.subscriptions.retrieve(m.subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error("Abonament fără poziții");
  if (item.price.id === price.id) return true;
  await stripe.subscriptions.update(sub.id, {
    items: [{ id: item.id, price: price.id }],
    proration_behavior: "none",
  });
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyOwner } = await import("./wa-notify.server");
    const { PLAN_CATALOG, planVolume } = await import("./plan-catalog");
    const plan = PLAN_CATALOG.find((p) => p.id === m.toPriceId);
    if (plan && m.userId) {
      await notifyOwner(supabaseAdmin as any, m.userId, {
        kind: "plan_upgraded",
        text: plan.ads
          ? `Gata, ești pe pachetul ${plan.name} ✅ Reclamele sunt deblocate. Scrie-mi „pornește reclama” și continuăm de aici.`
          : `Gata, ești pe pachetul ${plan.name} ✅ Ai ${planVolume(plan)} pe lună.`,
      });
    }
  } catch (e) {
    console.error("[upgrade] notify", (e as Error).message);
  }
  return true;
}
