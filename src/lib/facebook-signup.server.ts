/**
 * Finalizează un signup/login cu Facebook pornind de la un access token deja
 * obținut (din codul OAuth pe callback SAU din SDK-ul JS pe client).
 *
 * Două cazuri:
 *  - Token de USER (fallback clasic, fără config_id): `/me` întoarce emailul →
 *    creăm/legăm contul după email.
 *  - Token SYSTEM-USER (Facebook Login for Business, config_id): `/me` NU are
 *    email → creăm contul cu un email temporar `fb-<id>@pending.adpilot.ro`,
 *    dedupe după `meta_user_id` (stabil). Emailul real se cere în onboarding.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PENDING_EMAIL_DOMAIN = "pending.adpilot.ro";
export function pendingEmailFor(metaUserId: string): string {
  return `fb-${metaUserId}@${PENDING_EMAIL_DOMAIN}`;
}
export function isPendingEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PENDING_EMAIL_DOMAIN}`);
}

export type FinishResult =
  | { ok: true; redirect: string }
  | { ok: false; reason: "create_failed" | "session_failed" };

async function userEmailById(uid: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
  return data?.user?.email ?? null;
}

export async function finishFacebookSignup(params: {
  accessToken: string;
  expiresIn?: number | null;
  origin: string;
  referralCode?: string | null;
}): Promise<FinishResult> {
  const { accessToken, expiresIn = null, origin, referralCode = null } = params;
  const referralMeta = referralCode?.trim()
    ? { referral_code: referralCode.trim().slice(0, 40) }
    : {};
  const { fetchMetaUserProfile, fetchMetaPermissions } = await import("@/lib/meta.server");
  const { persistMetaConnection } = await import("@/lib/meta/persist.server");

  const profile = await fetchMetaUserProfile(accessToken); // { id, name, email? }
  const email = (profile.email ?? "").trim().toLowerCase();

  const permissions = await fetchMetaPermissions(accessToken);
  const granted = new Set<string>(
    (permissions?.data ?? [])
      .filter((p: any) => p.status === "granted")
      .map((p: any) => p.permission),
  );

  let uid: string | null = null;
  let loginEmail: string | null = null;
  let createdNew = false;

  if (email) {
    // ── Token de USER: dedupe după emailul real ──
    const { data: existing } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
      p_email: email,
    });
    uid = (existing as string | null) ?? null;
    if (!uid) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: profile.name ?? null,
          signup_source: "facebook",
          ...referralMeta,
        },
      });
      if (cErr || !created?.user) {
        console.error("[fb-signup] createUser (email) failed", cErr);
        return { ok: false, reason: "create_failed" };
      }
      uid = created.user.id;
      createdNew = true;
    }
    loginEmail = email;
  } else {
    // ── Token SYSTEM-USER: fără email → dedupe după meta_user_id (stabil) ──
    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("user_id")
      .eq("meta_user_id", profile.id)
      .maybeSingle();
    if (conn?.user_id) {
      uid = conn.user_id;
      loginEmail = (await userEmailById(uid)) ?? pendingEmailFor(profile.id);
    } else {
      // Poate o încercare anterioară a creat userul (email temporar) dar a picat
      // la persist → reutilizăm-l după emailul temporar determinist.
      const placeholder = pendingEmailFor(profile.id);
      const { data: byPlaceholder } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
        p_email: placeholder,
      });
      uid = (byPlaceholder as string | null) ?? null;
      if (!uid) {
        const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          email: placeholder,
          email_confirm: true,
          user_metadata: {
            full_name: profile.name ?? null,
            signup_source: "facebook",
            pending_email: true,
            ...referralMeta,
          },
        });
        if (cErr || !created?.user) {
          console.error("[fb-signup] createUser (placeholder) failed", cErr);
          return { ok: false, reason: "create_failed" };
        }
        uid = created.user.id;
        createdNew = true;
      }
      loginEmail = placeholder;
    }
  }

  if (!uid || !loginEmail) return { ok: false, reason: "create_failed" };

  // If referral arrived after profile insert (or createUser path missed it), set once.
  if (createdNew && referralMeta.referral_code) {
    try {
      await supabaseAdmin
        .from("profiles")
        .update({ referral_code: referralMeta.referral_code })
        .eq("id", uid)
        .is("referral_code", null);
    } catch (e) {
      console.error("[fb-signup] referral claim failed", e);
    }
  }

  // Salvăm conexiunea (token + assets). Se face mereu, ca `meta_user_id` să existe
  // pentru dedupe (asset-urile pot fi goale dacă n-a dat acces, dar config-ul le cere).
  try {
    await persistMetaConnection({
      userId: uid,
      accessToken,
      expiresIn,
      granted,
      metaUser: { id: profile.id, name: profile.name },
    });
  } catch (e) {
    console.error("[fb-signup] persist failed", e);
    // Continuăm — userul are cont + sesiune; poate reconecta din onboarding.
  }

  const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: loginEmail,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  const actionLink = (link as any)?.properties?.action_link as string | undefined;
  if (lErr || !actionLink) {
    console.error("[fb-signup] generateLink failed", lErr);
    return { ok: false, reason: "session_failed" };
  }
  return { ok: true, redirect: actionLink };
}
