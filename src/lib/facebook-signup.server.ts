/**
 * Finalizează un signup/login cu Facebook pornind de la un access token deja
 * obținut (fie din codul OAuth pe callback, fie din SDK-ul JS pe client).
 * Creează/leagă contul Supabase după emailul verificat de FB, salvează conexiunea
 * de ads (dacă a acordat `ads_management`) și întoarce un magic link de sesiune.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FinishResult =
  | { ok: true; redirect: string }
  | { ok: false; reason: "noemail" | "create_failed" | "session_failed" };

export async function finishFacebookSignup(params: {
  accessToken: string;
  expiresIn?: number | null;
  origin: string;
}): Promise<FinishResult> {
  const { accessToken, expiresIn = null, origin } = params;
  const { fetchMetaUserProfile, fetchMetaPermissions } = await import("@/lib/meta.server");
  const { persistMetaConnection } = await import("@/lib/meta/persist.server");

  const profile = await fetchMetaUserProfile(accessToken);
  const email = (profile.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "noemail" };

  const permissions = await fetchMetaPermissions(accessToken);
  const granted = new Set<string>(
    (permissions?.data ?? [])
      .filter((p: any) => p.status === "granted")
      .map((p: any) => p.permission),
  );
  const hasAds = granted.has("ads_management");

  // Găsește userul existent după email (leagă conturile) sau creează-l.
  const { data: existing } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
    p_email: email,
  });
  let uid = (existing as string | null) ?? null;
  if (!uid) {
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: profile.name ?? null, signup_source: "facebook" },
    });
    if (cErr || !created?.user) {
      console.error("[fb-signup] createUser failed", cErr);
      return { ok: false, reason: "create_failed" };
    }
    uid = created.user.id;
  }

  // Conexiunea de ads o salvăm doar dacă chiar a acordat `ads_management`.
  if (hasAds) {
    await persistMetaConnection({
      userId: uid,
      accessToken,
      expiresIn,
      granted,
      metaUser: { id: profile.id, name: profile.name },
    });
  }

  const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  const actionLink = (link as any)?.properties?.action_link as string | undefined;
  if (lErr || !actionLink) {
    console.error("[fb-signup] generateLink failed", lErr);
    return { ok: false, reason: "session_failed" };
  }
  return { ok: true, redirect: actionLink };
}
