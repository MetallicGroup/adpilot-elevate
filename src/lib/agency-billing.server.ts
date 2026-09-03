/**
 * Facturare automată pe cantitate pentru clienții de agenție (Varianta B).
 * Bază: 995 lei/lună include 2 afaceri. Fiecare afacere conectată peste 2 =
 * 249 lei/lună, facturat prin cantitatea unui item separat pe abonamentul
 * agenției (lookup_key `agency_extra_client`).
 *
 * Best-effort: dacă agenția nu are încă abonament sau prețul nu există, iese
 * silențios (conectarea clientului NU trebuie să pice din cauza facturării).
 */
import { supabaseAdmin as _sa } from "@/integrations/supabase/client.server";

const supabaseAdmin: any = _sa;
const EXTRA_LOOKUP_KEY = "agency_extra_client";

export async function syncAgencyBilling(agencyId: string): Promise<void> {
  try {
    const { data: ag } = await supabaseAdmin
      .from("agencies")
      .select("id, owner_user_id, client_slots")
      .eq("id", agencyId)
      .maybeSingle();
    if (!ag) return;
    const included = ag.client_slots ?? 2;

    const { count } = await supabaseAdmin
      .from("agency_clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "connected");
    const extra = Math.max(0, (count ?? 0) - included);

    // Abonamentul de agenție al owner-ului (activ / în trial).
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, environment, status")
      .eq("user_id", ag.owner_user_id)
      .ilike("price_id", "%agency_monthly%")
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (!sub?.stripe_subscription_id) return; // neabonat încă → nimic de facturat

    const { createStripeClient } = await import("@/lib/stripe.server");
    const stripe = createStripeClient(sub.environment === "sandbox" ? "sandbox" : "live");

    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
      expand: ["items.data.price"],
    });
    const prices = await stripe.prices.list({ lookup_keys: [EXTRA_LOOKUP_KEY] });
    const extraPriceId = prices.data[0]?.id;
    if (!extraPriceId) return; // prețul de client suplimentar nu e creat în Stripe

    const existing = subscription.items.data.find(
      (it: any) => it.price?.id === extraPriceId || it.price?.lookup_key === EXTRA_LOOKUP_KEY,
    );

    if (extra <= 0) {
      if (existing) await stripe.subscriptionItems.del(existing.id, { proration_behavior: "none" });
    } else if (existing) {
      if (existing.quantity !== extra) {
        await stripe.subscriptionItems.update(existing.id, {
          quantity: extra,
          proration_behavior: "create_prorations",
        });
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: extraPriceId,
        quantity: extra,
        proration_behavior: "create_prorations",
      });
    }
  } catch (e) {
    console.error("[agency-billing] sync failed for", agencyId, e);
  }
}
