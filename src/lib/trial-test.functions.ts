import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

/**
 * End-to-end trial test against Stripe SANDBOX using test clocks.
 *
 * Verifies:
 *  1. During the 7-day trial, NO charges are issued on the customer.
 *  2. After the trial expires, the subscription transitions to `active`
 *     and exactly one paid invoice is generated.
 *
 * Uses Stripe test helpers (test clocks) — sandbox only.
 */

type StepReport = {
  name: string;
  ok: boolean;
  detail: string;
};

export type TrialTestResult =
  | {
      ok: boolean;
      summary: string;
      steps: StepReport[];
      cleanup: { test_clock?: string; customer?: string; subscription?: string };
    }
  | { error: string };

const TRIAL_DAYS = 7;
const SECONDS_PER_DAY = 86_400;

async function waitForClock(
  stripe: ReturnType<typeof createStripeClient>,
  clockId: string,
  timeoutMs = 120_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return clock;
    if (clock.status === "internal_failure") throw new Error("Test clock failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timed out waiting for test clock");
}

export const runTrialSandboxTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId?: string }) => data)
  .handler(async ({ data, context }): Promise<TrialTestResult> => {
    // Admin-only — never expose this on the published site.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { error: "Forbidden" };

    const stripe = createStripeClient("sandbox");
    const steps: StepReport[] = [];
    const cleanup: TrialTestResult extends infer R
      ? R extends { cleanup: infer C }
        ? C
        : never
      : never = {} as any;
    const lookup = data.priceId ?? "starter_monthly";

    try {
      // 0. Resolve price by lookup_key.
      const prices = await stripe.prices.list({ lookup_keys: [lookup] });
      if (!prices.data.length) throw new Error(`Price ${lookup} not found in sandbox`);
      const price = prices.data[0];
      steps.push({ name: "resolve_price", ok: true, detail: `${lookup} → ${price.id}` });

      // 1. Create a test clock anchored to "now".
      const nowSec = Math.floor(Date.now() / 1000);
      const clock = await stripe.testHelpers.testClocks.create({
        frozen_time: nowSec,
        name: `trial-e2e-${nowSec}`,
      });
      cleanup.test_clock = clock.id;
      steps.push({ name: "create_test_clock", ok: true, detail: clock.id });

      // 2. Create a customer pinned to the clock + attach a test card.
      const customer = await stripe.customers.create({
        email: `trial-e2e-${nowSec}@example.com`,
        test_clock: clock.id,
        metadata: { trial_e2e: "true" },
      });
      cleanup.customer = customer.id;

      const pm = await stripe.paymentMethods.create({
        type: "card",
        card: { token: "tok_visa" },
      });
      await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: pm.id },
      });
      steps.push({ name: "create_customer", ok: true, detail: customer.id });

      // 3. Create the subscription with a 7-day trial.
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        trial_period_days: TRIAL_DAYS,
        payment_settings: { save_default_payment_method: "on_subscription" },
      });
      cleanup.subscription = sub.id;
      const trialEnd = sub.trial_end ?? 0;
      steps.push({
        name: "create_subscription",
        ok: sub.status === "trialing",
        detail: `status=${sub.status} trial_end=${new Date(trialEnd * 1000).toISOString()}`,
      });

      // 4. ASSERT — no charges during trial. Advance clock by 6 days
      //    (still inside the trial window).
      await stripe.testHelpers.testClocks.advance(clock.id, {
        frozen_time: nowSec + 6 * SECONDS_PER_DAY,
      });
      await waitForClock(stripe, clock.id);

      const midTrialCharges = await stripe.charges.list({ customer: customer.id, limit: 5 });
      const midTrialInvoices = await stripe.invoices.list({ customer: customer.id, limit: 5 });
      const paidDuringTrial = midTrialInvoices.data.filter(
        (i) => i.status === "paid" && (i.amount_paid ?? 0) > 0,
      );
      const trialOk = midTrialCharges.data.length === 0 && paidDuringTrial.length === 0;
      steps.push({
        name: "no_charge_during_trial",
        ok: trialOk,
        detail: `charges=${midTrialCharges.data.length} paid_invoices=${paidDuringTrial.length}`,
      });

      const midSub = await stripe.subscriptions.retrieve(sub.id);
      steps.push({
        name: "still_trialing_at_day_6",
        ok: midSub.status === "trialing",
        detail: `status=${midSub.status}`,
      });

      // 5. Advance past trial end (+8 days from start, well past trial_end).
      await stripe.testHelpers.testClocks.advance(clock.id, {
        frozen_time: nowSec + 8 * SECONDS_PER_DAY,
      });
      await waitForClock(stripe, clock.id);

      // Stripe may need a moment to settle the renewal invoice.
      let finalSub = await stripe.subscriptions.retrieve(sub.id);
      for (let i = 0; i < 6 && finalSub.status === "trialing"; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        finalSub = await stripe.subscriptions.retrieve(sub.id);
      }

      steps.push({
        name: "subscription_active_after_trial",
        ok: finalSub.status === "active",
        detail: `status=${finalSub.status}`,
      });

      const finalInvoices = await stripe.invoices.list({ customer: customer.id, limit: 10 });
      const paidAfterTrial = finalInvoices.data.filter(
        (i) => i.status === "paid" && (i.amount_paid ?? 0) > 0,
      );
      steps.push({
        name: "exactly_one_paid_invoice_after_trial",
        ok: paidAfterTrial.length === 1,
        detail: `paid_invoices=${paidAfterTrial.length} amount=${paidAfterTrial[0]?.amount_paid ?? 0}`,
      });
    } catch (error) {
      steps.push({
        name: "fatal",
        ok: false,
        detail: getStripeErrorMessage(error),
      });
    } finally {
      // Best-effort cleanup — deleting the clock cascades to its objects.
      if (cleanup.test_clock) {
        try {
          await stripe.testHelpers.testClocks.del(cleanup.test_clock);
        } catch (e) {
          console.warn("clock cleanup failed:", e);
        }
      }
    }

    const ok = steps.every((s) => s.ok);
    return {
      ok,
      summary: ok
        ? "✅ Trialul nu generează niciun charge timp de 7 zile, iar abonamentul devine activ după expirare."
        : "❌ Cel puțin o aserțiune a eșuat — vezi pașii pentru detalii.",
      steps,
      cleanup,
    };
  });