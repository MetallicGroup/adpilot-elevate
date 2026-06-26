// @ts-nocheck
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMetaConfig, META_SCOPES } from "./config.server";
import { exchangeCodeForToken, exchangeForLongLivedToken, metaGraphRequest } from "./client";

const STATE_TTL_MS = 10 * 60 * 1000;

type MetaUserResponse = { id: string; name?: string };
type MetaAdAccountsResponse = {
  data: Array<{
    id: string;
    name?: string;
    account_status?: number;
    currency?: string;
    timezone_name?: string;
  }>;
};

export function buildMetaOAuthUrl(state: string) {
  const { appId, redirectUri, apiVersion } = getMetaConfig();
  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function createOAuthState(userId: string) {
  const state = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

  const { error } = await supabaseAdmin.from("meta_oauth_states").insert({
    state,
    user_id: userId,
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);
  return state;
}

export async function consumeOAuthState(state: string) {
  const { data, error } = await supabaseAdmin
    .from("meta_oauth_states")
    .select("user_id, expires_at")
    .eq("state", state)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invalid or expired OAuth state");

  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("meta_oauth_states").delete().eq("state", state);
    throw new Error("OAuth state expired — please try connecting again");
  }

  await supabaseAdmin.from("meta_oauth_states").delete().eq("state", state);
  return data.user_id as string;
}

export async function completeMetaOAuth(code: string, userId: string) {
  const short = await exchangeCodeForToken(code);
  const long = await exchangeForLongLivedToken(short.accessToken);

  const tokenExpiresAt = long.expiresIn
    ? new Date(Date.now() + long.expiresIn * 1000).toISOString()
    : null;

  const me = await metaGraphRequest<MetaUserResponse>("/me", {
    accessToken: long.accessToken,
    body: { fields: "id,name" },
  });

  const { data: connection, error: connError } = await supabaseAdmin
    .from("meta_connections")
    .upsert(
      {
        user_id: userId,
        provider: "meta",
        meta_user_id: me.id,
        meta_user_name: me.name ?? null,
        access_token: long.accessToken,
        token_expires_at: tokenExpiresAt,
      },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .single();

  if (connError) throw new Error(connError.message);

  const accounts = await metaGraphRequest<MetaAdAccountsResponse>("/me/adaccounts", {
    accessToken: long.accessToken,
    body: {
      fields: "id,name,account_status,currency,timezone_name",
      limit: "100",
    },
  });

  if (accounts.data?.length) {
    const rows = accounts.data.map((a) => ({
      user_id: userId,
      connection_id: connection.id,
      ad_account_id: a.id.replace("act_", ""),
      account_name: a.name ?? `Ad Account ${a.id}`,
      currency: a.currency ?? null,
      timezone: a.timezone_name ?? null,
      status: a.account_status === 1 ? "active" : "inactive",
    }));

    const { error: acctError } = await supabaseAdmin
      .from("meta_ad_accounts")
      .upsert(rows, { onConflict: "user_id,ad_account_id" });

    if (acctError) throw new Error(acctError.message);
  }

  return { metaUserId: me.id, metaUserName: me.name, adAccountCount: accounts.data?.length ?? 0 };
}

export async function getMetaAccessToken(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("meta_connections")
    .select("access_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "meta")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.access_token) {
    throw new Error("Meta account not connected. Connect Meta in Settings first.");
  }

  if (data.token_expires_at && new Date(data.token_expires_at).getTime() < Date.now()) {
    throw new Error("Meta access token expired. Please reconnect your Meta account.");
  }

  return data.access_token;
}