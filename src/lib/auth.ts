import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export function authCallbackUrl() {
  if (typeof window === "undefined") return "/auth/callback";
  return `${window.location.origin}/auth/callback`;
}

export async function waitForClientSession(): Promise<Session> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session) throw new Error("Sesiunea nu este activă.");
  return session;
}

export async function signInWithProvider(provider: "google") {
  const result = await lovable.auth.signInWithOAuth(provider, {
    redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
  });
  if (result.error) throw result.error;
  return result;
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "/reset-password",
  });
  if (error) throw error;
}

/**
 * Traduce mesajele comune Supabase în română pentru UI.
 */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_grant"))
    return "Email sau parolă greșită.";
  if (m.includes("email not confirmed"))
    return "Trebuie să confirmi emailul înainte să te loghezi. Verifică inbox-ul.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Există deja un cont cu acest email. Loghează-te sau resetează parola.";
  if (m.includes("password should be at least"))
    return "Parola trebuie să aibă minim 6 caractere.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Prea multe încercări. Așteaptă un minut și reîncearcă.";
  if (m.includes("password") && (m.includes("pwned") || m.includes("compromised")))
    return "Parola aceasta a fost expusă într-o breșă publică. Alege alta.";
  if (m.includes("unable to validate email"))
    return "Emailul nu pare valid. Verifică adresa.";
  return message;
}
