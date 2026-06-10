import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdFromBearer, jsonResponse, errorResponse } from "../auth";
import { buildMetaOAuthUrl, completeMetaOAuth, consumeOAuthState, createOAuthState } from "@/lib/meta/oauth";
import { createMetaLeadCampaign, fetchMetaPages } from "@/lib/meta/campaign";
import { syncMetaInsights, getMetaInsightsSummary } from "@/lib/meta/insights";
import { syncMetaLeads, listMetaLeads } from "@/lib/meta/leads";
import { MetaApiError } from "@/lib/meta/client";
import type { MetaBusinessDetails, MetaGeneratedContent } from "@/lib/meta/types";

const LaunchSchema = z.object({
  ad_account_uuid: z.string().uuid(),
  page_id: z.string().min(1),
  business_details: z.object({
    business_name: z.string().min(1),
    service_product: z.string().min(1),
    location: z.string().min(1),
    target_audience: z.string().min(1),
    daily_budget: z.number().min(5),
    duration_days: z.number().min(1).max(365),
    phone: z.string().min(1),
    website: z.string().optional(),
  }),
  generated: z.object({
    campaign_name: z.string().min(1),
    primary_text: z.string().min(1),
    headline: z.string().min(1),
    description: z.string().min(1),
    call_to_action: z.enum(["SIGN_UP", "LEARN_MORE"]),
    lead_form_questions: z.array(z.string()).min(1),
    targeting_suggestion: z.object({
      countries: z.array(z.string()).min(1),
      age_min: z.number().min(18),
      age_max: z.number().max(65),
    }),
  }),
  privacy_policy_url: z.string().url(),
  launch_active: z.boolean().optional(),
});

export async function handleMetaApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/meta/")) return null;

  const path = url.pathname.replace(/\/$/, "");

  try {
    if (path === "/api/meta/auth/start" && request.method === "GET") {
      const userId = await getUserIdFromBearer(request);
      const state = await createOAuthState(userId);
      const redirectUrl = buildMetaOAuthUrl(state);
      return Response.redirect(redirectUrl, 302);
    }

    if (path === "/api/meta/auth/callback" && request.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");

      if (oauthError) {
        return Response.redirect(`/settings?meta_error=${encodeURIComponent(oauthError)}`, 302);
      }
      if (!code || !state) {
        return Response.redirect("/settings?meta_error=missing_code", 302);
      }

      const userId = await consumeOAuthState(state);
      await completeMetaOAuth(code, userId);
      return Response.redirect("/settings?meta=connected", 302);
    }

    if (path === "/api/meta/ad-accounts" && request.method === "GET") {
      const userId = await getUserIdFromBearer(request);

      const { data: connection } = await supabaseAdmin
        .from("meta_connections")
        .select("id, meta_user_id, meta_user_name, token_expires_at")
        .eq("user_id", userId)
        .eq("provider", "meta")
        .maybeSingle();

      const { data: accounts, error } = await supabaseAdmin
        .from("meta_ad_accounts")
        .select("id, ad_account_id, account_name, currency, timezone, status")
        .eq("user_id", userId)
        .order("account_name");

      if (error) throw new Error(error.message);

      let pages: Array<{ id: string; name: string }> = [];
      if (connection) {
        try {
          pages = await fetchMetaPages(userId);
        } catch {
          pages = [];
        }
      }

      return jsonResponse({
        connected: !!connection,
        connection: connection
          ? {
              meta_user_id: connection.meta_user_id,
              meta_user_name: connection.meta_user_name,
              token_expires_at: connection.token_expires_at,
            }
          : null,
        ad_accounts: accounts ?? [],
        pages,
      });
    }

    if (path === "/api/meta/campaigns/create-lead-campaign" && request.method === "POST") {
      const userId = await getUserIdFromBearer(request);
      const body = LaunchSchema.parse(await request.json());
      const result = await createMetaLeadCampaign(userId, {
        ...body,
        business_details: body.business_details as MetaBusinessDetails,
        generated: body.generated as MetaGeneratedContent,
      });
      return jsonResponse(result, 201);
    }

    if (path === "/api/meta/insights" && request.method === "GET") {
      const userId = await getUserIdFromBearer(request);
      const refresh = url.searchParams.get("refresh") === "true";

      if (refresh) {
        await syncMetaInsights(userId);
      }

      const summary = await getMetaInsightsSummary(userId);
      return jsonResponse(summary);
    }

    if (path === "/api/meta/insights" && request.method === "POST") {
      const userId = await getUserIdFromBearer(request);
      const result = await syncMetaInsights(userId);
      const summary = await getMetaInsightsSummary(userId);
      return jsonResponse({ ...summary, synced: result.synced });
    }

    if (path === "/api/meta/leads" && request.method === "GET") {
      const userId = await getUserIdFromBearer(request);
      const refresh = url.searchParams.get("sync") === "true";

      if (refresh) {
        await syncMetaLeads(userId);
      }

      const leads = await listMetaLeads(userId);
      return jsonResponse({ leads });
    }

    if (path === "/api/meta/leads" && request.method === "POST") {
      const userId = await getUserIdFromBearer(request);
      const result = await syncMetaLeads(userId);
      const leads = await listMetaLeads(userId);
      return jsonResponse({ leads, synced: result.synced });
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message === "Unauthorized" || message.startsWith("Unauthorized")
        ? 401
        : err instanceof MetaApiError
          ? 422
          : 400;
    console.error("[Meta API]", err);
    return errorResponse(message, status);
  }
}
