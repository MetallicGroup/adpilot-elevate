import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CampaignPreviewData = {
  pageName: string | null;
  previewUrl: string | null;
  objective: string;
  headline: string;
  primaryText: string;
  questions: Array<{ label: string; type?: string; options?: string[] }>;
  website: string | null;
  callPhone: string | null;
  createdAt: string;
  /** Ecranul de început al formularului (oferta). */
  formIntro: string | null;
  /** Reclamă de mesaje: unde se deschide chatul. */
  destination: string | null;
};

/** Linkul de previzualizare de la Meta expiră după câteva ore: îl refacem când pagina e deschisă. */
const PREVIEW_REFRESH_MS = 60 * 60 * 1000;

/** Datele publice ale unei ciorne de campanie (/p/<code>). Fără tokenuri, fără date ale userului. */
export const getCampaignPreview = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(4).max(16) }).parse(d))
  .handler(async ({ data }): Promise<CampaignPreviewData | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("campaign_previews")
      .select("id, user_id, payload, media, preview_url, preview_refreshed_at, page_name, created_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!row) return null;
    const p = (row.payload ?? {}) as any;
    let previewUrl: string | null = row.preview_url ?? null;
    const lastRefresh = new Date(row.preview_refreshed_at ?? row.created_at).getTime();
    if (Date.now() - lastRefresh > PREVIEW_REFRESH_MS) {
      try {
        previewUrl = (await refreshPreviewUrl(supabaseAdmin, row)) ?? previewUrl;
      } catch (e) {
        console.warn("[preview] refresh failed", (e as Error).message);
      }
    }
    const first = Array.isArray(p.creatives) && p.creatives[0] ? p.creatives[0] : p;
    const landing = String(p.landing_url ?? "");
    return {
      pageName: row.page_name ?? null,
      previewUrl,
      objective: String(p.objective ?? "leads"),
      headline: String(first.headline ?? ""),
      primaryText: String(first.primary_text ?? ""),
      questions: Array.isArray(p.custom_questions) ? p.custom_questions : [],
      website: typeof p.website === "string" ? p.website : null,
      callPhone: landing.startsWith("tel:") ? landing.slice(4) : null,
      createdAt: row.created_at,
      formIntro: typeof p.form_intro === "string" && p.form_intro.trim() ? p.form_intro : null,
      destination: p.objective === "messages" ? String(p.resolved_destination ?? "MESSENGER") : null,
    };
  });

async function refreshPreviewUrl(supabaseAdmin: any, row: any): Promise<string | null> {
  const p = (row.payload ?? {}) as any;
  const media = (row.media ?? {}) as any;
  const [{ data: conn }, { data: page }] = await Promise.all([
    supabaseAdmin.from("meta_connections").select("id, access_token").eq("user_id", row.user_id).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("meta_pages").select("page_id, page_access_token").eq("user_id", row.user_id).eq("is_active", true).limit(1).maybeSingle(),
  ]);
  if (!conn?.access_token || !page?.page_id) return null;
  const { data: acc } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("ad_account_id")
    .eq("user_id", row.user_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!acc?.ad_account_id) return null;
  const mp = await import("@/lib/meta-publish.server");
  const first = Array.isArray(p.creatives) && p.creatives[0] ? p.creatives[0] : p;
  const igId = page.page_access_token ? await mp.fetchPageInstagramId(page.page_id, page.page_access_token) : null;
  const url = await mp.generateAdPreviewUrl(acc.ad_account_id, conn.access_token, {
    page_id: page.page_id,
    instagram_user_id: igId,
    image_hash: media.image_hash,
    video_id: media.video_id,
    thumbnail_url: media.thumbnail_url,
    headline: String(first.headline ?? ""),
    description: String(first.primary_text ?? ""),
    cta: String(first.cta ?? p.cta ?? "Learn More"),
    landing_url: p.landing_url ?? "https://www.adpilot.ro",
    message_destination: p.objective === "messages" ? p.resolved_destination ?? "MESSENGER" : undefined,
    lead_gen_form_id: p.objective === "leads" ? "preview" : undefined,
  });
  if (url) {
    await supabaseAdmin
      .from("campaign_previews")
      .update({ preview_url: url, preview_refreshed_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  return url;
}
