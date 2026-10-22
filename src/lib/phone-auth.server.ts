/**
 * Autentificare pe bază de număr de telefon (fără parolă, fără email).
 *
 * 1. requestCode: generăm un cod de 6 cifre, îl salvăm doar ca hash (HMAC) și îl
 *    trimitem cu șablonul de autentificare `cod_verificare` (buton „Copiază codul”).
 * 2. verifyCode: verificăm codul (max. 5 încercări, 10 minute), apoi găsim contul
 *    legat de număr (WhatsApp activat) sau creăm unul nou. Sesiunea se pornește în
 *    browser cu un token de tip magic link (`verifyOtp({ token_hash })`).
 *
 * Contul nou primește direct WhatsApp-ul activ: numărul e confirmat chiar pe WhatsApp.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { generateActivationCode, getCentralWhatsApp, sendWhatsAppTemplate } from "./whatsapp.server";

export const OTP_TEMPLATE = "cod_verificare";
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_PER_PHONE_HOUR = 3;
const MAX_PER_IP_HOUR = 10;
/** Email intern pentru conturile create doar cu telefonul (nu primește mesaje). */
const PHONE_EMAIL_DOMAIN = "phone.adpilot.ro";

export class PhoneAuthError extends Error {}

/** „0733 682 037”, „+40733682037”, „40733…” → „40733682037”. Doar mobile din România. */
export function normalizeRoMobile(input: string): string | null {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.startsWith("0040")) d = d.slice(4);
  else if (d.startsWith("40") && d.length === 11) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 9 || !d.startsWith("7")) return null;
  return `40${d}`;
}

export function phoneEmail(e164: string): string {
  return `${e164}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPhoneEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

function hashCode(phone: string, code: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "adpilot";
  return createHmac("sha256", pepper).update(`${phone}:${code}`).digest("hex");
}

export async function requestCode(
  supabaseAdmin: any,
  params: { phone: string; ip: string | null },
): Promise<{ masked: string }> {
  const phone = normalizeRoMobile(params.phone);
  if (!phone) throw new PhoneAuthError("Introdu un număr de mobil din România (ex: 0733 123 456).");

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: perPhone } = await supabaseAdmin
    .from("phone_otps")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", hourAgo);
  if ((perPhone ?? 0) >= MAX_PER_PHONE_HOUR) {
    throw new PhoneAuthError("Ai cerut prea multe coduri. Încearcă din nou peste o oră.");
  }
  if (params.ip) {
    const { count: perIp } = await supabaseAdmin
      .from("phone_otps")
      .select("id", { count: "exact", head: true })
      .eq("ip", params.ip)
      .gte("created_at", hourAgo);
    if ((perIp ?? 0) >= MAX_PER_IP_HOUR) {
      throw new PhoneAuthError("Prea multe încercări de pe această conexiune. Încearcă mai târziu.");
    }
  }

  const central = getCentralWhatsApp();
  if (!central) throw new PhoneAuthError("Trimiterea codurilor nu e disponibilă acum. Încearcă puțin mai târziu.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await supabaseAdmin.from("phone_otps").insert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    ip: params.ip,
  });
  if (error) throw new Error(error.message);

  try {
    await sendWhatsAppTemplate(central.phoneNumberId, central.accessToken, phone, OTP_TEMPLATE, "ro", [code], undefined, [
      { subType: "url", index: 0, param: { type: "text", text: code } },
    ]);
  } catch (e) {
    console.error("[phone-auth] send code failed", (e as Error).message);
    throw new PhoneAuthError("Nu am putut trimite codul pe WhatsApp. Verifică numărul și încearcă din nou.");
  }

  return { masked: `+40 ${phone.slice(2, 3)}•• ••• ${phone.slice(8)}` };
}

export type VerifyResult = {
  /** Token pentru `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`. */
  tokenHash: string;
  isNew: boolean;
  userId: string;
};

export async function verifyCode(
  supabaseAdmin: any,
  params: { phone: string; code: string; referral?: string | null; origin: string },
): Promise<VerifyResult> {
  const phone = normalizeRoMobile(params.phone);
  const code = (params.code ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) throw new PhoneAuthError("Codul are 6 cifre.");

  const { data: otp } = await supabaseAdmin
    .from("phone_otps")
    .select("id, code_hash, expires_at, attempts")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
    throw new PhoneAuthError("Codul a expirat. Cere unul nou.");
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new PhoneAuthError("Prea multe încercări greșite. Cere un cod nou.");
  }
  const expected = Buffer.from(otp.code_hash, "hex");
  const given = Buffer.from(hashCode(phone, code), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await supabaseAdmin.from("phone_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    throw new PhoneAuthError("Cod greșit. Verifică mesajul de pe WhatsApp.");
  }
  await supabaseAdmin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

  // Contul legat deja de acest număr (WhatsApp activat), dacă există.
  const { data: wa } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("user_id")
    .eq("user_phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let userId: string | null = wa?.user_id ?? null;
  let email: string | null = null;
  let isNew = false;

  if (userId) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = u?.user?.email ?? null;
    if (!email) userId = null;
  }

  if (!userId) {
    email = phoneEmail(phone);
    const referral = (params.referral ?? "").trim().slice(0, 40) || undefined;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: "",
        phone: `0${phone.slice(2)}`,
        signup_method: "phone",
        ...(referral ? { referral_code: referral } : {}),
      },
    });
    if (cErr || !created?.user) {
      // Cont creat anterior cu același număr, dar fără WhatsApp legat (ex. o încercare întreruptă).
      const { data: existingId } = await supabaseAdmin.rpc("get_user_id_by_email", { p_email: email });
      if (!existingId) throw new Error(cErr?.message ?? "Nu am putut crea contul.");
      userId = existingId as string;
    } else {
      userId = created.user.id;
      isNew = true;
    }

    await supabaseAdmin
      .from("profiles")
      .update({ phone: `0${phone.slice(2)}`, chosen_plan: "starter", plan: "starter" })
      .eq("id", userId);

    const { data: hasWa } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (hasWa) {
      await supabaseAdmin
        .from("whatsapp_connections")
        .update({ user_phone: phone, status: "active", activated_at: new Date().toISOString() })
        .eq("id", hasWa.id);
    } else {
      await supabaseAdmin.from("whatsapp_connections").insert({
        user_id: userId,
        user_phone: phone,
        status: "active",
        activation_code: generateActivationCode(),
        activated_at: new Date().toISOString(),
      });
    }
    await supabaseAdmin
      .from("onboarding_sessions")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  }

  const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: email!,
    options: { redirectTo: `${params.origin}/auth/callback` },
  });
  const tokenHash = link?.properties?.hashed_token as string | undefined;
  if (lErr || !tokenHash) throw new Error(lErr?.message ?? "Nu am putut porni sesiunea.");

  return { tokenHash, isNew, userId: userId! };
}
