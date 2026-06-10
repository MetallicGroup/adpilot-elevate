import { supabase } from "@/integrations/supabase/client";

export async function metaApiFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in first");

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? "Request failed");
  }
  return json;
}
