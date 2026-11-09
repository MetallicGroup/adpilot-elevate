/**
 * Fluxul din site (v3): ciorna de campanie făcută în /campanie se publică la Meta după plată.
 * Publicarea folosește exact aceeași funcție ca agentul de pe WhatsApp (publishCampaignToMeta),
 * deci formularul are doar Nume + Telefon, iar setul de reclame are DSA, oraș + rază etc.
 *
 * Starea ciornei (coloana campaigns.status):
 *   draft            → făcută în /campanie, neplătită
 *   pending_payment  → omul a deschis plata; webhook-ul Stripe o publică imediat ce vine abonamentul
 *   publishing       → lacăt cât timp o publicăm (să n-o publice și webhook-ul, și pagina)
 *   active           → publicată (de aici o preiau cron-urile existente: revizie, notificări, cereri)
 */

export type V3Dest = "form" | "wa";

export type V3Creative = {
  v3: true;
  what: string;
  offer: string;
  city: string;
  radius_km: number;
  primary_text: string;
  headline: string;
  page_id: string | null;
  page_name: string | null;
  media_bucket: string | null;
  media_path: string | null;
  media_url: string | null;
  media_mime: string;
  dest: V3Dest;
  last_publish_error?: string | null;
};

export type LaunchResult =
  | { ok: true; campaignId: string; message: string }
  | { ok: false; error: string; link?: string; problem?: string };

const ADS_PLANS = new Set(["afacere_monthly", "zilnic_monthly"]);

/** Are un abonament activ care include reclamele (495 sau 949 lei) sau un plan vechi plătit cu reclame. */
export async function hasAdsPlan(sb: any, userId: string): Promise<boolean> {
  const { data } = await sb
    .from("subscriptions")
    .select("price_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"]);
  for (const row of data ?? []) {
    const p = String(row.price_id ?? "").toLowerCase();
    if (ADS_PLANS.has(p) || p.includes("pro") || p.includes("premium") || p.includes("comp"))
      return true;
  }
  return false;
}

async function mediaBytes(
  sb: any,
  c: V3Creative,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (c.media_bucket && c.media_path) {
    const { data, error } = await sb.storage.from(c.media_bucket).download(c.media_path);
    if (error || !data) return null;
    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      mime: c.media_mime || data.type || "image/jpeg",
    };
  }
  if (c.media_url) {
    const r = await fetch(c.media_url);
    if (!r.ok) return null;
    return {
      bytes: new Uint8Array(await r.arrayBuffer()),
      mime: r.headers.get("content-type") || c.media_mime || "image/jpeg",
    };
  }
  return null;
}

/** Publică o ciornă v3. Sigur de apelat de mai multe ori: doar primul apel trece de lacăt. */
export async function launchV3Campaign(
  sb: any,
  userId: string,
  campaignId: string,
): Promise<LaunchResult> {
  const { data: row } = await sb
    .from("campaigns")
    .select("id, user_id, name, status, budget, objective, creative, meta_campaign_id")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Nu găsesc campania." };
  if (row.meta_campaign_id && row.status === "active")
    return { ok: true, campaignId, message: "Campania e deja trimisă la Facebook." };
  const c = (row.creative ?? {}) as V3Creative;
  if (!c.v3) return { ok: false, error: "Campania nu e făcută din site." };

  // Lacătul: doar o singură publicare, chiar dacă vin în același timp webhook-ul și pagina.
  const { data: locked } = await sb
    .from("campaigns")
    .update({ status: "publishing" })
    .eq("id", campaignId)
    .in("status", ["draft", "pending_payment"])
    .select("id");
  if (!locked?.length) {
    return row.status === "publishing"
      ? { ok: true, campaignId, message: "Campania se trimite acum la Facebook." }
      : { ok: false, error: "Campania nu mai poate fi pornită de aici." };
  }

  const fail = async (r: {
    error: string;
    link?: string;
    problem?: string;
  }): Promise<LaunchResult> => {
    await sb
      .from("campaigns")
      .update({ status: "draft", creative: { ...c, last_publish_error: r.error } })
      .eq("id", campaignId);
    return { ok: false, ...r };
  };

  try {
    const { assertCanPublishCampaign } = await import("@/lib/access.server");
    try {
      await assertCanPublishCampaign(sb, userId, { excludeCampaignId: campaignId });
    } catch (e) {
      return fail({ error: (e as Error).message, problem: "plan" });
    }

    const { data: conn } = await sb
      .from("meta_connections")
      .select("id, access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token)
      return fail({
        error: "Facebook-ul nu mai e conectat. Conectează-l din nou.",
        problem: "connect",
      });

    const pf = await import("./wa-campaign-preflight.server");
    const switched = await pf.autoSwitchAdAccount(sb, userId, conn.id, conn.access_token);
    if (!switched.adAccountId)
      return fail({ error: "Nu găsesc niciun cont de reclame activ.", problem: "ad_account" });

    let pageQ = sb
      .from("meta_pages")
      .select("page_id, page_name, page_access_token")
      .eq("user_id", userId)
      .eq("connection_id", conn.id);
    pageQ = c.page_id ? pageQ.eq("page_id", c.page_id) : pageQ.eq("is_active", true);
    const { data: page } = await pageQ.limit(1).maybeSingle();
    if (!page?.page_id || !page.page_access_token)
      return fail({ error: "Nu găsesc pagina de Facebook aleasă.", problem: "page" });

    const mp = await import("./meta-publish.server");
    let messageDestination: import("./meta-publish.server").MessageDestination | undefined;
    if (c.dest === "wa") {
      const ig = await mp.fetchPageInstagramId(page.page_id, page.page_access_token);
      const res = await pf.resolveMessageDestination(
        "whatsapp",
        { id: page.page_id, token: page.page_access_token },
        ig,
      );
      if (res.destination !== "WHATSAPP") {
        return fail({
          error:
            "Pagina de Facebook n-are încă un număr de WhatsApp legat. Leagă-l din Pagină → Setări → WhatsApp sau alege formularul.",
          problem: "wa_number",
        });
      }
      messageDestination = "WHATSAPP";
    }

    const media = await mediaBytes(sb, c);
    if (!media)
      return fail({
        error: "Nu pot citi poza sau clipul reclamei. Încarcă-l din nou.",
        problem: "media",
      });

    const cityKeys: Array<{ key: string; radius?: number }> = [];
    if (c.city?.trim()) {
      const hit = await mp.findCityKey(conn.access_token, c.city.trim(), "RO");
      if (!hit)
        return fail({
          error: `Nu găsesc orașul „${c.city}” la Facebook. Verifică numele.`,
          problem: "city",
        });
      cityKeys.push({ key: hit.key, radius: Math.min(80, Math.max(1, c.radius_km || 10)) });
    }

    const objective = c.dest === "wa" ? "messages" : "leads";
    await sb
      .from("campaigns")
      .update({
        objective: objective === "messages" ? "MESSAGES" : "LEAD_GENERATION",
        lead_form:
          objective === "leads"
            ? { title: row.name, fields: ["Name", "Phone"], custom_questions: [] }
            : null,
      })
      .eq("id", campaignId);

    const { publishCampaignToMeta } = await import("./whatsapp-agent.server");
    const res: any = await publishCampaignToMeta(sb, {
      campaignRowId: campaignId,
      adAccountId: switched.adAccountId,
      accessToken: conn.access_token,
      pageId: page.page_id,
      pageAccessToken: page.page_access_token,
      bytes: media.bytes,
      mediaMime: media.mime,
      messageDestination,
      args: {
        name: row.name,
        daily_budget: Number(row.budget) || 40,
        headline: c.headline,
        primary_text: c.primary_text,
        cta: objective === "leads" ? "Sign Up" : "Learn More",
        countries: ["RO"],
        age_min: 22,
        age_max: 65,
        gender: "all",
        beneficiary: page.page_name ?? undefined,
      },
      objective,
      cityKeys,
      userId,
    });
    if (res?.ok) {
      return { ok: true, campaignId, message: res.message ?? "Campania a plecat la Facebook." };
    }
    // publishCampaignToMeta a pus deja status „draft” și eroarea; păstrăm și varianta noastră.
    return fail({
      error: res?.error ?? "Facebook n-a primit campania.",
      link: res?.link,
      problem: res?.problem_kind,
    });
  } catch (e) {
    console.error("[v3-launch]", (e as Error).message);
    return fail({
      error: "Facebook n-a primit campania. Încearcă din nou sau scrie-ne pe WhatsApp.",
    });
  }
}

/** Din webhook-ul Stripe: publică ciorna pentru care omul tocmai a plătit. */
export async function launchPendingV3Campaigns(sb: any, userId: string): Promise<void> {
  if (!(await hasAdsPlan(sb, userId))) return;
  const { data } = await sb
    .from("campaigns")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(1);
  for (const r of data ?? []) {
    const res = await launchV3Campaign(sb, userId, r.id);
    if (!res.ok) console.warn("[v3-launch] pending launch failed", r.id, res.error);
  }
}
