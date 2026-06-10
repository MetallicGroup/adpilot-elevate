import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PublishInput = z.object({
  campaign_id: z.string().uuid(),
  page_id: z.string().min(1).optional(),
});

export const publishMetaCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PublishInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Load campaign
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.campaign_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (cErr || !campaign) throw new Error("Campaign not found");
    if (campaign.platform !== "meta") throw new Error("Campaign is not a Meta campaign");
    if (campaign.objective !== "LEAD_GENERATION") throw new Error("Only LEAD_GENERATION is supported for Meta in v1");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Resolve Meta connection (active) + token
    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("id, access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) throw new Error("No active Meta connection. Connect Meta in Settings.");

    // 3. Pick first active ad account + page
    const { data: adAcc } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("ad_account_id, account_name")
      .eq("user_id", userId)
      .eq("connection_id", conn.id)
      .limit(1)
      .maybeSingle();
    if (!adAcc?.ad_account_id) throw new Error("No Meta ad account available. Reconnect Meta in Settings.");

    let pageQuery = supabaseAdmin
      .from("meta_pages")
      .select("page_id, page_name, page_access_token")
      .eq("user_id", userId)
      .eq("connection_id", conn.id)
      .eq("is_active", true);
    if (data.page_id) pageQuery = pageQuery.eq("page_id", data.page_id);
    const { data: page } = await pageQuery.limit(1).maybeSingle();
    if (!page?.page_id || !page.page_access_token)
      throw new Error("No Facebook Page connected. Add a page in Settings.");

    // 4. Fetch media bytes (from ad-media storage or external URL)
    const creative = (campaign.creative as any) ?? {};
    const leadForm = (campaign.lead_form as any) ?? {};
    const targeting = (campaign.targeting as any) ?? {};
    const mediaUrl: string = creative.media_url ?? "";
    if (!mediaUrl) throw new Error("Media (image) is required. Add it in step 4 of the wizard.");

    let bytes: Uint8Array;
    let contentType = "image/jpeg";
    const storagePrefix = `${userId}/`;
    const storageMatch = mediaUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/ad-media\/(.+?)(\?|$)/);
    if (storageMatch) {
      // Internal upload — download privately via service role
      const objectPath = decodeURIComponent(storageMatch[1]);
      if (!objectPath.startsWith(storagePrefix)) throw new Error("Media file does not belong to you");
      const { data: file, error } = await supabaseAdmin.storage.from("ad-media").download(objectPath);
      if (error || !file) throw new Error(`Couldn't read media: ${error?.message ?? "unknown"}`);
      bytes = new Uint8Array(await file.arrayBuffer());
      contentType = file.type || "image/jpeg";
    } else {
      const r = await fetch(mediaUrl);
      if (!r.ok) throw new Error(`Couldn't fetch media URL (${r.status})`);
      bytes = new Uint8Array(await r.arrayBuffer());
      contentType = r.headers.get("content-type") || "image/jpeg";
    }

    const {
      createLeadForm,
      uploadAdImageFromBytes,
      createCampaign,
      createAdSet,
      createAdCreative,
      createAd,
      mapAgeGroupsToRange,
      mapGendersToMeta,
      mapLocationsToCountries,
    } = await import("./meta-publish.server");

    const STATUS: "ACTIVE" | "PAUSED" = "ACTIVE";

    // 5. Create Lead Form
    const form = await createLeadForm(page.page_id, page.page_access_token, {
      name: leadForm.title || campaign.name,
      intro: leadForm.intro,
      fields: leadForm.fields ?? ["Name", "Phone"],
      custom_questions: Array.isArray(leadForm.custom_questions) ? leadForm.custom_questions : [],
      privacy_url: leadForm.privacy_url || creative.landing_url || "https://adpilot.ro/privacy-policy",
      follow_up_url: creative.landing_url,
    });

    // 6. Create Campaign
    const metaCamp = await createCampaign(adAcc.ad_account_id, conn.access_token, campaign.name, STATUS);

    // 7. Create AdSet
    const budgetCents = Math.round(Number(campaign.budget) * 100);
    const adset = await createAdSet(adAcc.ad_account_id, conn.access_token, {
      name: `${campaign.name} — AdSet`,
      campaign_id: metaCamp.id,
      daily_budget_cents: campaign.budget_mode === "BUDGET_MODE_DAY" ? budgetCents : undefined,
      lifetime_budget_cents: campaign.budget_mode === "BUDGET_MODE_TOTAL" ? budgetCents : undefined,
      end_time: campaign.end_date ? `${campaign.end_date}T23:59:59+0000` : null,
      page_id: page.page_id,
      targeting: {
        countries: mapLocationsToCountries(targeting.locations ?? []),
        ...mapAgeGroupsToRange(targeting.age_groups ?? []),
        genders: mapGendersToMeta(targeting.genders ?? []),
      },
      status: STATUS,
    });

    // 8. Upload image → image_hash
    const image_hash = await uploadAdImageFromBytes(
      adAcc.ad_account_id,
      conn.access_token,
      bytes,
      "ad.jpg",
      contentType,
    );

    // 9. Create Creative
    const adCreative = await createAdCreative(adAcc.ad_account_id, conn.access_token, {
      name: `${campaign.name} — Creative`,
      page_id: page.page_id,
      image_hash,
      headline: creative.headline ?? "",
      description: creative.description ?? "",
      cta: creative.cta ?? "Learn More",
      landing_url: creative.landing_url ?? "",
      lead_gen_form_id: form.id,
    });

    // 10. Create Ad
    const ad = await createAd(adAcc.ad_account_id, conn.access_token, {
      name: `${campaign.name} — Ad`,
      adset_id: adset.id,
      creative_id: adCreative.id,
      status: STATUS,
    });

    // 11. Persist Meta IDs + flip status
    await supabase
      .from("campaigns")
      .update({
        meta_campaign_id: metaCamp.id,
        meta_adset_id: adset.id,
        meta_ad_id: ad.id,
        meta_lead_form_id: form.id,
        status: "active",
      })
      .eq("id", campaign.id);

    return {
      meta_campaign_id: metaCamp.id,
      meta_ad_id: ad.id,
      lead_form_id: form.id,
    };
  });

const UploadInput = z.object({
  filename: z.string().max(120),
  contentType: z.string().max(80),
  base64: z.string().max(15_000_000), // ~10MB binary
});

/** Uploads a base64-encoded image to ad-media bucket and returns a long-lived signed URL */
export const uploadAdMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}_${safeName}`;
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error } = await supabaseAdmin.storage.from("ad-media").upload(path, bin, {
      contentType: data.contentType,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("ad-media")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "Signing failed");
    return { url: signed.signedUrl, path };
  });