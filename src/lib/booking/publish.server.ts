// @ts-nocheck
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensurePixelForAdAccount } from "./capi.server";
import type { LandingCopy } from "./types";

const SITE_URL = "https://adpilot.ro";

async function fetchMediaBytes(userId: string, mediaUrl: string) {
  const storageMatch = mediaUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/ad-media\/(.+?)(\?|$)/);
  if (storageMatch) {
    const objectPath = decodeURIComponent(storageMatch[1]);
    if (!objectPath.startsWith(`${userId}/`)) throw new Error("Fișierul nu îți aparține.");
    const { data: file, error } = await supabaseAdmin.storage.from("ad-media").download(objectPath);
    if (error || !file) throw new Error(`Nu am putut citi imaginea: ${error?.message ?? "necunoscut"}`);
    return { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type || "image/jpeg" };
  }
  const r = await fetch(mediaUrl);
  if (!r.ok) throw new Error(`Nu am putut descărca imaginea (${r.status})`);
  return {
    bytes: new Uint8Array(await r.arrayBuffer()),
    contentType: r.headers.get("content-type") || "image/jpeg",
  };
}

export async function publishBookingCampaignCore(userId: string, input: any) {
  const { data: page } = await supabaseAdmin
    .from("booking_campaigns")
    .select("id, user_id, slug, service, business_id, landing_copy, pixel_id, objective, call_phone")
    .eq("id", input.booking_campaign_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!page) throw new Error("Pagina de programare nu există.");

  const { data: biz } = await supabaseAdmin
    .from("business_profiles")
    .select("name, city")
    .eq("id", page.business_id)
    .maybeSingle();

  const { data: adAcc } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("ad_account_id, connection_id")
    .eq("id", input.ad_account_uuid)
    .eq("user_id", userId)
    .maybeSingle();
  if (!adAcc) throw new Error("Contul publicitar Meta nu a fost găsit.");

  const { data: conn } = await supabaseAdmin
    .from("meta_connections")
    .select("access_token")
    .eq("id", adAcc.connection_id)
    .maybeSingle();
  if (!conn?.access_token) throw new Error("Conectează din nou contul Meta.");

  const { data: metaPage } = await supabaseAdmin
    .from("meta_pages")
    .select("page_id, page_access_token, page_name")
    .eq("user_id", userId)
    .eq("page_id", input.page_id)
    .maybeSingle();
  if (!metaPage?.page_access_token) throw new Error("Pagina Facebook selectată nu este disponibilă.");

  const {
    createCampaign,
    createAdSet,
    createAdCreative,
    createAd,
    uploadAdImageFromBytes,
    findCityKey,
    fetchPageName,
  } = await import("@/lib/meta-publish.server");

  // 1. Pixel/dataset pentru evenimentele Schedule (CAPI)
  const pixelId =
    page.pixel_id ||
    (await ensurePixelForAdAccount(adAcc.ad_account_id, conn.access_token, `AdPilot — ${biz?.name ?? "Programări"}`));

  // 2. Landing page-ul devine public ÎNAINTE de pornirea reclamei
  await supabaseAdmin
    .from("booking_campaigns")
    .update({ status: "published", pixel_id: pixelId, hero_image_url: input.hero_image_url })
    .eq("id", page.id);

  const objective = page.objective ?? "bookings";
  const OBJECTIVE_LABEL: Record<string, string> = {
    bookings: "Programări",
    leads: "Clienți potențiali",
    calls: "Apeluri",
    sales: "Vânzări",
  };
  const OBJECTIVE_CTA: Record<string, string> = {
    bookings: "Book Now",
    leads: "Sign Up",
    calls: "Call Now",
    sales: "Shop Now",
  };
  const landingUrl = `${SITE_URL}/b/${page.slug}?utm_source=facebook&utm_medium=paid&utm_campaign=${objective}`;
  const name = `${biz?.name ?? "AdPilot"} — ${page.service} (${OBJECTIVE_LABEL[objective] ?? "Campanie"})`;
  const STATUS = input.launch_active ? "ACTIVE" : "PAUSED";

  try {
    const metaCamp = await createCampaign(adAcc.ad_account_id, conn.access_token, name, STATUS, "OUTCOME_LEADS");

    const city = input.city || biz?.city || null;
    let cities: Array<{ key: string; radius: number; distance_unit: "kilometer" }> | undefined;
    if (city) {
      const hit = await findCityKey(conn.access_token, city, "RO").catch(() => null);
      if (hit) cities = [{ key: hit.key, radius: input.radius_km, distance_unit: "kilometer" }];
    }

    const beneficiary =
      (await fetchPageName(metaPage.page_id, metaPage.page_access_token).catch(() => null)) ||
      metaPage.page_name ||
      biz?.name ||
      name;

    const endDate = new Date(Date.now() + input.duration_days * 86_400_000);
    const adset = await createAdSet(adAcc.ad_account_id, conn.access_token, {
      name: `${name} — AdSet`,
      campaign_id: metaCamp.id,
      daily_budget_cents: Math.round(input.daily_budget * 100),
      end_time: `${endDate.toISOString().slice(0, 10)}T23:59:59+0000`,
      page_id: metaPage.page_id,
      targeting: {
        countries: ["RO"],
        age_min: input.age_min,
        age_max: input.age_max,
        genders: input.genders,
        cities,
      },
      status: STATUS,
      // Optimizează pe evenimentul pe care îl trimite chiar landing-ul prin CAPI:
      // programări -> SCHEDULE, restul (leads/apeluri) -> LEAD. Toate rămân pe
      // destinație WEBSITE (pagina /b/slug), nu lead-form pe reclamă.
      objective: objective === "bookings" ? "bookings" : "landing_lead",
      pixel_id: pixelId,
      dsa_beneficiary: beneficiary,
      dsa_payor: beneficiary,
    });

    const { bytes, contentType } = await fetchMediaBytes(userId, input.hero_image_url);
    const image_hash = await uploadAdImageFromBytes(
      adAcc.ad_account_id,
      conn.access_token,
      bytes,
      "booking.jpg",
      contentType,
    );

    const creative = await createAdCreative(adAcc.ad_account_id, conn.access_token, {
      name: `${name} — Creative`,
      page_id: metaPage.page_id,
      image_hash,
      headline: input.headline,
      description: input.primary_text,
      cta: OBJECTIVE_CTA[objective] ?? "Learn More",
      landing_url: landingUrl,
    });

    const ad = await createAd(adAcc.ad_account_id, conn.access_token, {
      name: `${name} — Ad`,
      adset_id: adset.id,
      creative_id: creative.id,
      status: STATUS,
    });

    const copy = (page.landing_copy ?? {}) as LandingCopy;
    const { data: campaignRow } = await supabaseAdmin
      .from("campaigns")
      .insert({
        user_id: userId,
        platform: "meta",
        campaign_type: objective === "bookings" ? "booking" : objective,
        name,
        objective: "OUTCOME_LEADS",
        status: input.launch_active ? "active" : "paused",
        budget: input.daily_budget,
        budget_mode: "BUDGET_MODE_DAY",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        targeting: {
          city,
          radius_km: input.radius_km,
          age_min: input.age_min,
          age_max: input.age_max,
          genders: input.genders,
        },
        creative: {
          headline: input.headline,
          description: input.description,
          primary_text: input.primary_text,
          media_url: input.hero_image_url,
          landing_url: landingUrl,
          cta: OBJECTIVE_CTA[objective] ?? "Learn More",
        },
        meta_campaign_id: metaCamp.id,
        meta_adset_id: adset.id,
        meta_ad_id: ad.id,
      })
      .select("id")
      .single();

    await supabaseAdmin
      .from("booking_campaigns")
      .update({
        meta_campaign_id: metaCamp.id,
        meta_adset_id: adset.id,
        meta_ad_id: ad.id,
        campaign_id: campaignRow?.id ?? null,
      })
      .eq("id", page.id);

    return {
      ok: true as const,
      booking_url: `${SITE_URL}/b/${page.slug}`,
      campaign_id: campaignRow?.id ?? null,
      meta_campaign_id: metaCamp.id,
      pixel_id: pixelId,
      headline: copy.headline ?? input.headline,
    };
  } catch (e: any) {
    await supabaseAdmin.from("booking_campaigns").update({ status: "draft" }).eq("id", page.id);
    throw new Error(e?.message ?? "Nu am putut lansa campania de programări.");
  }
}