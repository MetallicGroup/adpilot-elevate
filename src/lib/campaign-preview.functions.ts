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
};

/** Datele publice ale unei ciorne de campanie (/p/<code>). Fără tokenuri, fără date ale userului. */
export const getCampaignPreview = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(4).max(16) }).parse(d))
  .handler(async ({ data }): Promise<CampaignPreviewData | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("campaign_previews")
      .select("payload, preview_url, page_name, created_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!row) return null;
    const p = (row.payload ?? {}) as any;
    const first = Array.isArray(p.creatives) && p.creatives[0] ? p.creatives[0] : p;
    const landing = String(p.landing_url ?? "");
    return {
      pageName: row.page_name ?? null,
      previewUrl: row.preview_url ?? null,
      objective: String(p.objective ?? "leads"),
      headline: String(first.headline ?? ""),
      primaryText: String(first.primary_text ?? ""),
      questions: Array.isArray(p.custom_questions) ? p.custom_questions : [],
      website: typeof p.website === "string" ? p.website : null,
      callPhone: landing.startsWith("tel:") ? landing.slice(4) : null,
      createdAt: row.created_at,
    };
  });
