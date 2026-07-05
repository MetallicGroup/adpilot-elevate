import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv, optionalEnv } from "./env";

export function publishableClient(): SupabaseClient {
  return createClient(
    requireEnv("E2E_SUPABASE_URL"),
    requireEnv("E2E_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false } },
  );
}

export function adminClient(): SupabaseClient {
  const key = optionalEnv("E2E_SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    throw new Error(
      "E2E_SUPABASE_SERVICE_ROLE_KEY nu este setat — testul care simulează 'onboarding complet' are nevoie de service role. Sari peste el sau adaugă cheia în .env.test.",
    );
  }
  return createClient(requireEnv("E2E_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function uniqueEmail(prefix = "e2e"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}+${Date.now()}-${rand}@adpilot-e2e.test`;
}

/**
 * Șterge un user creat de un test. Silent-fail dacă nu ai service role
 * (userul va rămâne orfan, dar testul nu pică).
 */
export async function deleteUserByEmail(email: string): Promise<void> {
  const key = optionalEnv("E2E_SUPABASE_SERVICE_ROLE_KEY");
  if (!key) return;
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user) await admin.auth.admin.deleteUser(user.id);
}

/**
 * Simulează un onboarding COMPLET pentru un user: creează un rând
 * meta_connections activ + o subscription "trialing" cu perioadă în viitor.
 * Necesită service role.
 */
export async function seedCompleteOnboarding(userId: string): Promise<void> {
  const admin = adminClient();
  const oneMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  const { error: metaErr } = await admin.from("meta_connections").upsert(
    {
      user_id: userId,
      meta_user_id: `e2e-${userId}`,
      meta_user_name: "E2E Test",
      access_token: "e2e-fake-token",
      is_active: true,
      scopes: "e2e",
    },
    { onConflict: "user_id,meta_user_id" },
  );
  if (metaErr) throw metaErr;

  const { error: subErr } = await admin.from("subscriptions").insert({
    user_id: userId,
    environment: "sandbox",
    status: "trialing",
    current_period_end: oneMonth,
    trial_end: oneMonth,
  });
  if (subErr) throw subErr;
}
