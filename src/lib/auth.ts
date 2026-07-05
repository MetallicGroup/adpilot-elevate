import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export function authCallbackUrl() {
  if (typeof window === "undefined") return "/auth/callback";
  return `${window.location.origin}/auth/callback`;
}

export async function ensureSessionAfterSignUp(
  email: string,
  password: string,
): Promise<Session> {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw signInError;
  }

  if (!signInData.session) {
    throw new Error("Cont creat, dar sesiunea nu a putut fi pornită. Încearcă să te loghezi.");
  }

  return signInData.session;
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
}
