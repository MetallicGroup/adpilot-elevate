import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

const TRIAL_DAYS = 3;

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/**
 * Cuponul „50% reducere prima lună" — get-or-create idempotent, per mediu
 * (live/sandbox au fiecare propriul cupon). `duration: "once"` => reducerea se
 * aplică o singură dată, pe prima factură = prima lună (după trialul de 3 zile).
 */
const FIRST_MONTH_COUPON_ID = "adpilot_first_month_50";
async function getOrCreateFirstMonthCoupon(
  stripe: ReturnType<typeof createStripeClient>,
): Promise<string | null> {
  try {
    const existing = await stripe.coupons.retrieve(FIRST_MONTH_COUPON_ID);
    if (existing && !(existing as { deleted?: boolean }).deleted) return existing.id;
  } catch {
    /* încă nu există */
  }
  try {
    const created = await stripe.coupons.create({
      id: FIRST_MONTH_COUPON_ID,
      percent_off: 50,
      duration: "once",
      name: "50% reducere prima lună",
    });
    return created.id;
  } catch {
    // Race: creat între timp de altă cerere → îl reluăm.
    try {
      const again = await stripe.coupons.retrieve(FIRST_MONTH_COUPON_ID);
      return again.id;
    } catch {
      return null; // nu bloca checkout-ul dacă Stripe are un hiccup pe cupon
    }
  }
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      // Strict same-origin allowlist to prevent open-redirect via Stripe return_url.
      try {
        const u = new URL(data.returnUrl);
        const allowed = new Set([
          "adpilot.ro",
          "www.adpilot.ro",
          "adpilot-elevate.lovable.app",
        ]);
        const okHost =
          allowed.has(u.hostname) ||
          u.hostname.endsWith(".lovable.app") ||
          u.hostname === "localhost";
        if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error();
        if (!okHost) throw new Error();
      } catch {
        throw new Error("Invalid returnUrl");
      }
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const { userId, supabase } = context;

      const { data: userRes } = await supabase.auth.getUser();
      const email = userRes.user?.email;

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Plan inexistent");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });
      // Planurile de agenție se plătesc curat: FĂRĂ trial și FĂRĂ -50% prima lună.
      const isAgency = /^agency/.test(data.priceId);
      const firstMonthCoupon = isAgency ? null : await getOrCreateFirstMonthCoupon(stripe);

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        // Ofertă: -50% prima lună (o singură factură). Nu se combină cu coduri promo.
        ...(firstMonthCoupon ? { discounts: [{ coupon: firstMonthCoupon }] } : {}),
        metadata: { userId },
        customer_update: { address: "auto", name: "auto" },
        // „Factură pe firmă": bifă opțională în checkout care cere CUI + denumire
        // firmă (pt. RO: tip `ro_tin`). Datele ajung pe factura Stripe, trimisă pe
        // email. `customer_update.name`+`address` sunt necesare ca Stripe să le
        // salveze pe client.
        tax_id_collection: { enabled: true },
        ...(isRecurring && {
          payment_method_collection: "always",
          subscription_data: {
            metadata: { userId },
            // Agenție → fără trial (plată imediată). Business → trial ca înainte.
            ...(isAgency
              ? {}
              : {
                  trial_period_days: TRIAL_DAYS,
                  trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
                }),
          },
        }),
        automatic_tax: { enabled: true },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("createCheckoutSession error:", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const { supabase, userId } = context;
      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subError || !sub?.stripe_customer_id) {
        return { error: "Nu există un abonament asociat contului tău." };
      }

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      console.error("createPortalSession error:", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status,price_id,current_period_end,trial_end,cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: sub ?? null };
  });

const ZERO_DECIMAL = new Set([
  "bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf",
]);
const THREE_DECIMAL = new Set(["bhd","jod","kwd","omr","tnd"]);
function toMajor(amount: number | null | undefined, currency: string): number {
  const v = amount ?? 0;
  const c = (currency ?? "").toLowerCase();
  if (ZERO_DECIMAL.has(c)) return v;
  if (THREE_DECIMAL.has(c)) return v / 1000;
  return v / 100;
}
function isoFromUnix(s: number | null | undefined): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  created: string | null;
  hosted_invoice_url: string | null;
  pdf_url: string | null;
  description: string | null;
};

export type UpcomingInvoice = {
  amount_due: number;
  currency: string;
  next_payment_attempt: string | null;
  period_end: string | null;
  description: string | null;
} | null;

export type BillingHistoryResult =
  | { invoices: BillingInvoice[]; upcoming: UpcomingInvoice }
  | { error: string };

export const getBillingHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<BillingHistoryResult> => {
    try {
      const { supabase, userId } = context;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id,stripe_subscription_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) {
        return { invoices: [], upcoming: null };
      }

      const stripe = createStripeClient(data.environment);
      const customerId = sub.stripe_customer_id as string;
      const subscriptionId = (sub.stripe_subscription_id as string | null) ?? undefined;

      const list = await stripe.invoices.list({ customer: customerId, limit: 24 });
      const invoices: BillingInvoice[] = list.data.map((inv) => ({
        id: inv.id ?? "",
        number: inv.number ?? null,
        status: inv.status ?? null,
        amount_paid: toMajor(inv.amount_paid, inv.currency),
        amount_due: toMajor(inv.amount_due, inv.currency),
        currency: inv.currency,
        created: isoFromUnix(inv.created),
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
        pdf_url: inv.invoice_pdf ?? null,
        description: inv.lines?.data?.[0]?.description ?? null,
      }));

      let upcoming: UpcomingInvoice = null;
      try {
        const u = await (stripe.invoices as unknown as {
          retrieveUpcoming: (p: Record<string, unknown>) => Promise<any>;
        }).retrieveUpcoming({
          customer: customerId,
          ...(subscriptionId && { subscription: subscriptionId }),
        });
        upcoming = {
          amount_due: toMajor(u.amount_due, u.currency),
          currency: u.currency,
          next_payment_attempt: isoFromUnix(u.next_payment_attempt),
          period_end: isoFromUnix(u.period_end),
          description: u.lines?.data?.[0]?.description ?? null,
        };
      } catch (e: any) {
        // No upcoming invoice (canceled / no recurring) — non-fatal.
        if (e?.code !== "invoice_upcoming_none") {
          console.warn("retrieveUpcoming failed:", e?.message);
        }
      }

      return { invoices, upcoming };
    } catch (error) {
      console.error("getBillingHistory error:", error);
      return { error: getStripeErrorMessage(error) };
    }
  });