import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Funcțiile pentru fluxul nou din site: cont → conectare → verificare → campanie → plată → WhatsApp → panou.
 * Toate rulează pe contul celui logat; datele sensibile (tokenuri) nu ies niciodată din server.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* ---------------- Contul ---------------- */

/** Numele omului și al afacerii, imediat după codul de pe WhatsApp. */
export const saveSignupBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const fullName = str(d.fullName, 80);
    const businessName = str(d.businessName, 120);
    if (fullName.length < 2) throw new Error("Scrie-ne numele tău.");
    if (businessName.length < 2) throw new Error("Scrie-ne numele afacerii.");
    return { fullName, businessName };
  })
  .handler(async ({ context, data }) => {
    const sb = await admin();
    await sb.from("profiles").update({ full_name: data.fullName }).eq("id", context.userId);
    const { data: biz } = await sb
      .from("business_profiles")
      .select("id, name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!biz)
      await sb
        .from("business_profiles")
        .insert({ user_id: context.userId, name: data.businessName });
    else if (!biz.name?.trim())
      await sb.from("business_profiles").update({ name: data.businessName }).eq("id", biz.id);
    // Fluxul nou nu trece prin /start: închidem sesiunea veche de înscriere, ca reamintirile
    // „continuă înregistrarea” (cu email și poze pentru clip) să nu-i ajungă acestui om.
    await sb
      .from("onboarding_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("completed_at", null);
    return { ok: true };
  });

export type FlowState = {
  name: string;
  businessName: string;
  phone: string | null;
  metaConnected: boolean;
  tiktokConnected: boolean;
  hasAdsPlan: boolean;
  waActive: boolean;
  waPhone: string | null;
  draftId: string | null;
  liveCount: number;
};

/** Unde e omul în flux (ca să-l ducem la pasul potrivit). */
export const getFlowState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FlowState> => {
    const sb = await admin();
    const uid = context.userId;
    const [
      { data: prof },
      { data: biz },
      { data: meta },
      { data: tt },
      { data: wa },
      { data: drafts },
      { count: live },
    ] = await Promise.all([
      sb.from("profiles").select("full_name, phone").eq("id", uid).maybeSingle(),
      sb.from("business_profiles").select("name").eq("user_id", uid).maybeSingle(),
      sb.from("meta_connections").select("id").eq("user_id", uid).eq("is_active", true).limit(1),
      sb.from("tiktok_connections").select("id").eq("user_id", uid).eq("is_active", true).limit(1),
      sb.from("whatsapp_connections").select("status, user_phone").eq("user_id", uid).maybeSingle(),
      sb
        .from("campaigns")
        .select("id, creative")
        .eq("user_id", uid)
        .in("status", ["draft", "pending_payment"])
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .not("meta_campaign_id", "is", null),
    ]);
    const { hasAdsPlan } = await import("@/lib/v3-campaign.server");
    const draft = (drafts ?? []).find((d: any) => d.creative?.v3);
    return {
      name: prof?.full_name ?? "",
      businessName: biz?.name ?? "",
      phone: prof?.phone ?? null,
      metaConnected: !!meta?.length,
      tiktokConnected: !!tt?.length,
      hasAdsPlan: await hasAdsPlan(sb, uid),
      waActive: wa?.status === "active",
      waPhone: wa?.user_phone ?? null,
      draftId: draft?.id ?? null,
      liveCount: live ?? 0,
    };
  });

/* ---------------- Verificarea contului de Facebook ---------------- */

export type CheckItem = {
  k: "page" | "acct" | "card" | "terms";
  label: string;
  ok: boolean;
  detail: string;
};
export type CheckProblem =
  "connect" | "nopage" | "noacct" | "disabled" | "unsettled" | "nocard" | "terms" | null;
export type V3Page = {
  pageId: string;
  name: string;
  category: string | null;
  followers: number | null;
  lastPost: string | null;
  active: boolean;
};
export type AccountCheck = {
  platform: "facebook" | "tiktok";
  connected: boolean;
  items: CheckItem[];
  problem: CheckProblem;
  links: { page?: string; card?: string; terms?: string; quality?: string };
  pages: V3Page[];
  adAccountName: string | null;
};

const GRAPH = "https://graph.facebook.com";

async function pageInfo(
  pageId: string,
  token: string,
  version: string,
): Promise<{ followers: number | null; lastPost: string | null }> {
  try {
    const [a, b] = await Promise.all([
      fetch(
        `${GRAPH}/${version}/${pageId}?fields=followers_count,fan_count&access_token=${encodeURIComponent(token)}`,
      ).then((r) => r.json()),
      fetch(
        `${GRAPH}/${version}/${pageId}/posts?fields=created_time&limit=1&access_token=${encodeURIComponent(token)}`,
      ).then((r) => r.json()),
    ]);
    const followers = Number(a?.followers_count ?? a?.fan_count);
    return {
      followers: Number.isFinite(followers) ? followers : null,
      lastPost: b?.data?.[0]?.created_time ?? null,
    };
  } catch {
    return { followers: null, lastPost: null };
  }
}

export const getAccountCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ force: !!(raw as { force?: boolean } | null)?.force }))
  .handler(async ({ context, data }): Promise<AccountCheck> => {
    const sb = await admin();
    const uid = context.userId;
    const { data: metaConn } = await sb
      .from("meta_connections")
      .select("id, access_token")
      .eq("user_id", uid)
      .eq("is_active", true)
      .maybeSingle();

    // Doar TikTok conectat: verificăm contul de business și advertiserul.
    if (!metaConn?.access_token) {
      const { data: tt } = await sb
        .from("tiktok_connections")
        .select("id")
        .eq("user_id", uid)
        .eq("is_active", true)
        .maybeSingle();
      if (tt) {
        const { data: adv } = await sb
          .from("tiktok_advertisers")
          .select("advertiser_id, advertiser_name")
          .eq("user_id", uid)
          .eq("is_active", true)
          .maybeSingle();
        return {
          platform: "tiktok",
          connected: true,
          items: [
            { k: "page", label: "Contul TikTok de business", ok: true, detail: "Conectat" },
            {
              k: "acct",
              label: "Contul de reclame",
              ok: !!adv,
              detail: adv ? (adv.advertiser_name ?? "Activ") : "Lipsește",
            },
          ],
          problem: adv ? null : "noacct",
          links: {},
          pages: [],
          adAccountName: adv?.advertiser_name ?? null,
        };
      }
      return {
        platform: "facebook",
        connected: false,
        items: [],
        problem: "connect",
        links: {},
        pages: [],
        adAccountName: null,
      };
    }

    const { getDiagnosis } = await import("@/lib/account-diagnosis.server");
    const { metaApiVersion } = await import("@/lib/meta.server");
    const d = await getDiagnosis(sb, uid, { force: data.force });
    if (!d) throw new Error("Nu am putut verifica acum contul. Mai încearcă o dată.");
    const m = d.meta;

    const { data: rows } = await sb
      .from("meta_pages")
      .select("page_id, page_name, category, page_access_token, is_active")
      .eq("connection_id", metaConn.id);
    const v = metaApiVersion();
    const pages: V3Page[] = await Promise.all(
      (rows ?? []).slice(0, 8).map(async (p: any) => {
        const info = p.page_access_token
          ? await pageInfo(p.page_id, p.page_access_token, v)
          : { followers: null, lastPost: null };
        return {
          pageId: p.page_id,
          name: p.page_name ?? "Pagina ta",
          category: p.category ?? null,
          active: !!p.is_active,
          ...info,
        };
      }),
    );
    pages.sort((a, b) => (b.followers ?? -1) - (a.followers ?? -1));

    const st = m.adAccount?.status ?? null;
    const disabled = st === 2 || st === 100 || st === 101;
    const unsettled = st === 3 || st === 8 || st === 9;
    const adId = m.adAccount?.id ?? null;
    const terms = m.leadTerms?.accepted === false;

    const items: CheckItem[] = [
      {
        k: "page",
        label: "Pagina de Facebook",
        ok: pages.length > 0,
        detail:
          pages.length > 1
            ? `${pages.length} pagini găsite`
            : (pages[0]?.name ?? "Nu ai nicio pagină"),
      },
      {
        k: "acct",
        label: "Contul de reclame",
        ok: !!m.adAccount && !disabled && !unsettled,
        detail: !m.adAccount
          ? "Nu ai cont de reclame"
          : disabled
            ? "Dezactivat de Facebook"
            : unsettled
              ? "Are o plată neachitată"
              : "Activ",
      },
      {
        k: "card",
        label: "Cardul pentru reclame",
        ok: m.hasPaymentMethod,
        detail: m.hasPaymentMethod ? "Adăugat la Facebook" : "Nu ai adăugat niciun card",
      },
      {
        k: "terms",
        label: "Condițiile pentru formulare",
        ok: !terms,
        detail: terms ? "Neacceptate încă" : "Acceptate",
      },
    ];
    const problem: CheckProblem = !pages.length
      ? "nopage"
      : !m.adAccount
        ? "noacct"
        : disabled
          ? "disabled"
          : unsettled
            ? "unsettled"
            : !m.hasPaymentMethod
              ? "nocard"
              : terms
                ? "terms"
                : null;
    const { leadTermsUrl } = await import("@/lib/meta-publish.server");
    const activePage = pages.find((p) => p.active) ?? pages[0];
    return {
      platform: "facebook",
      connected: true,
      items,
      problem,
      links: {
        page: "https://www.facebook.com/pages/create",
        card: adId
          ? `https://business.facebook.com/ads/manager/account_settings/account_billing/?act=${adId}`
          : "https://business.facebook.com/billing_hub",
        terms: activePage ? leadTermsUrl(activePage.pageId) : undefined,
        quality: "https://www.facebook.com/accountquality",
      },
      pages,
      adAccountName: m.adAccount?.name ?? null,
    };
  });

/** Pagina pe care facem reclama (cu confirmare, ca agentul să nu mai întrebe). */
export const chooseMetaPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const pageId = str((raw as { pageId?: string } | null)?.pageId, 40);
    if (!/^\d{5,40}$/.test(pageId)) throw new Error("Pagină invalidă.");
    return { pageId };
  })
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: conn } = await sb
      .from("meta_connections")
      .select("id")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn) throw new Error("Facebook-ul nu e conectat.");
    const { data: hit } = await sb
      .from("meta_pages")
      .select("id")
      .eq("connection_id", conn.id)
      .eq("page_id", data.pageId)
      .maybeSingle();
    if (!hit) throw new Error("Nu găsesc pagina.");
    await sb.from("meta_pages").update({ is_active: false }).eq("connection_id", conn.id);
    await sb.from("meta_pages").update({ is_active: true }).eq("id", hit.id);
    await sb
      .from("meta_connections")
      .update({ page_confirmed_at: new Date().toISOString() })
      .eq("id", conn.id);
    await sb.from("account_diagnoses").delete().eq("user_id", context.userId);
    return { ok: true };
  });

/** Ultimele poze de pe pagină, ca să aleagă una dintr-o atingere. */
export const listPagePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({
    pageId: str((raw as { pageId?: string } | null)?.pageId, 40),
  }))
  .handler(async ({ context, data }): Promise<{ photos: string[] }> => {
    const sb = await admin();
    const { data: conn } = await sb
      .from("meta_connections")
      .select("id")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn) return { photos: [] };
    let q = sb.from("meta_pages").select("page_id, page_access_token").eq("connection_id", conn.id);
    q = data.pageId ? q.eq("page_id", data.pageId) : q.eq("is_active", true);
    const { data: page } = await q.limit(1).maybeSingle();
    if (!page?.page_access_token) return { photos: [] };
    const { metaApiVersion } = await import("@/lib/meta.server");
    try {
      const r = await fetch(
        `${GRAPH}/${metaApiVersion()}/${page.page_id}/posts?fields=full_picture&limit=24&access_token=${encodeURIComponent(page.page_access_token)}`,
      );
      const j: any = await r.json();
      const photos = (j?.data ?? [])
        .map((p: any) => p.full_picture)
        .filter((u: unknown) => typeof u === "string")
        .slice(0, 12);
      return { photos };
    } catch {
      return { photos: [] };
    }
  });

/* ---------------- Campania ---------------- */

type DraftInput = {
  id: string | null;
  pageId: string | null;
  pageName: string | null;
  what: string;
  offer: string;
  city: string;
  radius: number;
  budget: number;
  text: string;
  media: { bucket: string; path: string; mime: string } | { url: string; mime: string } | null;
};

/** Salvează ciorna (fără să publice nimic). */
export const saveCampaignDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): DraftInput => {
    const d = (raw ?? {}) as Record<string, any>;
    const what = str(d.what, 80);
    if (what.length < 2) throw new Error("Scrie ce vrei să promovezi.");
    const city = str(d.city, 60);
    if (city.length < 2) throw new Error("Scrie orașul.");
    const budget = Math.round(Number(d.budget));
    if (!Number.isFinite(budget) || budget < 30 || budget > 1000)
      throw new Error("Bugetul trebuie să fie între 30 și 1.000 de lei pe zi.");
    const radius = Math.round(Number(d.radius));
    let media: DraftInput["media"] = null;
    if (d.media?.bucket === "onboarding" && typeof d.media.path === "string") {
      media = {
        bucket: "onboarding",
        path: str(d.media.path, 300),
        mime: str(d.media.mime, 60) || "image/jpeg",
      };
    } else if (
      typeof d.media?.url === "string" &&
      /^https:\/\/[^/]*(fbcdn\.net|facebook\.com)\//.test(d.media.url)
    ) {
      media = { url: d.media.url.slice(0, 2000), mime: "image/jpeg" };
    }
    if (!media) throw new Error("Alege o poză sau un clip pentru reclamă.");
    return {
      id: typeof d.id === "string" && /^[0-9a-f-]{36}$/.test(d.id) ? d.id : null,
      pageId: /^\d{5,40}$/.test(String(d.pageId ?? "")) ? String(d.pageId) : null,
      pageName: str(d.pageName, 120) || null,
      what,
      offer: str(d.offer, 80),
      city,
      radius: [5, 10, 20, 40].includes(radius) ? radius : 10,
      budget,
      text: str(d.text, 500),
      media,
    };
  })
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const uid = context.userId;
    if ("bucket" in (data.media as any) && !(data.media as any).path.startsWith(`${uid}/`))
      throw new Error("Fișier invalid.");
    const headline = `${data.what} în ${data.city}`.slice(0, 40);
    const primary =
      data.text ||
      `${data.what}${data.offer ? ` ${data.offer}` : ""}, în ${data.city}. Lasă-ne numele și telefonul și te sunăm noi.`;
    const m: any = data.media;
    const creative = {
      v3: true,
      what: data.what,
      offer: data.offer,
      city: data.city,
      radius_km: data.radius,
      primary_text: primary,
      headline,
      page_id: data.pageId,
      page_name: data.pageName,
      media_bucket: m.bucket ?? null,
      media_path: m.path ?? null,
      media_url: m.url ?? null,
      media_mime: m.mime,
      dest: "form",
    };
    const fields = {
      name: `${data.what} — ${data.city}`.slice(0, 100),
      platform: "meta",
      objective: "LEAD_GENERATION",
      budget: data.budget,
      budget_mode: "BUDGET_MODE_DAY",
      targeting: {
        locations: [data.city],
        radius_km: data.radius,
        age_groups: ["22-65"],
        genders: ["All"],
      },
      lead_form: { title: data.what, fields: ["Name", "Phone"], custom_questions: [] },
    };
    if (data.id) {
      const { data: prev } = await sb
        .from("campaigns")
        .select("id, status, creative")
        .eq("id", data.id)
        .eq("user_id", uid)
        .maybeSingle();
      if (prev && ["draft", "pending_payment"].includes(prev.status)) {
        await sb
          .from("campaigns")
          .update({
            ...fields,
            status: "draft",
            creative: { ...creative, dest: prev.creative?.dest ?? "form" },
          })
          .eq("id", data.id);
        return { id: data.id };
      }
    }
    const { data: row, error } = await sb
      .from("campaigns")
      .insert({ ...fields, user_id: uid, status: "draft", creative })
      .select("id")
      .single();
    if (error || !row) throw new Error("Nu am putut salva campania. Încearcă din nou.");
    return { id: row.id as string };
  });

export type DraftView = {
  id: string;
  status: string;
  what: string;
  offer: string;
  city: string;
  radius: number;
  budget: number;
  text: string;
  pageId: string | null;
  pageName: string | null;
  dest: "form" | "wa";
  mediaUrl: string | null;
  mediaMime: string;
  mediaBucket: string | null;
  mediaPath: string | null;
  mediaSource: string | null;
  error: string | null;
};

async function draftView(sb: any, uid: string, id: string): Promise<DraftView | null> {
  const { data: r } = await sb
    .from("campaigns")
    .select("id, status, budget, creative")
    .eq("id", id)
    .eq("user_id", uid)
    .maybeSingle();
  if (!r?.creative?.v3) return null;
  const c = r.creative;
  let mediaUrl: string | null = c.media_url ?? null;
  if (c.media_bucket && c.media_path) {
    const { data: s } = await sb.storage.from(c.media_bucket).createSignedUrl(c.media_path, 3600);
    mediaUrl = s?.signedUrl ?? null;
  }
  return {
    id: r.id,
    status: r.status,
    what: c.what,
    offer: c.offer ?? "",
    city: c.city,
    radius: c.radius_km ?? 10,
    budget: Number(r.budget) || 40,
    text: c.primary_text ?? "",
    pageId: c.page_id ?? null,
    pageName: c.page_name ?? null,
    dest: c.dest === "wa" ? "wa" : "form",
    mediaUrl,
    mediaMime: c.media_mime ?? "image/jpeg",
    mediaBucket: c.media_bucket ?? null,
    mediaPath: c.media_path ?? null,
    mediaSource: c.media_url ?? null,
    error: c.last_publish_error ?? null,
  };
}

export const getCampaignDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ id: str((raw as { id?: string } | null)?.id, 40) }))
  .handler(async ({ context, data }): Promise<{ draft: DraftView | null }> => {
    const sb = await admin();
    return { draft: data.id ? await draftView(sb, context.userId, data.id) : null };
  });

export type PayState = {
  draft: DraftView | null;
  hasAdsPlan: boolean;
  waAvailable: boolean | null;
  waNumber: string | null;
};

/** Pagina de plată: ciorna, dacă are deja pachetul și dacă pagina are WhatsApp legat. */
export const getPayState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ id: str((raw as { id?: string } | null)?.id, 40) }))
  .handler(async ({ context, data }): Promise<PayState> => {
    const sb = await admin();
    const uid = context.userId;
    const draft = data.id ? await draftView(sb, uid, data.id) : null;
    const { hasAdsPlan } = await import("@/lib/v3-campaign.server");
    let waNumber: string | null = null;
    let waAvailable: boolean | null = null;
    try {
      const { data: conn } = await sb
        .from("meta_connections")
        .select("id")
        .eq("user_id", uid)
        .eq("is_active", true)
        .maybeSingle();
      if (conn) {
        let q = sb
          .from("meta_pages")
          .select("page_id, page_access_token")
          .eq("connection_id", conn.id);
        q = draft?.pageId ? q.eq("page_id", draft.pageId) : q.eq("is_active", true);
        const { data: page } = await q.limit(1).maybeSingle();
        if (page?.page_access_token) {
          const { pageWhatsAppNumber } = await import("@/lib/meta-publish.server");
          waNumber = await pageWhatsAppNumber(page.page_id, page.page_access_token);
          waAvailable = !!waNumber;
        }
      }
    } catch {
      waAvailable = null;
    }
    return { draft, hasAdsPlan: await hasAdsPlan(sb, uid), waAvailable, waNumber };
  });

/** Formular sau mesaje pe WhatsApp; opțional, marchează ciorna „în plată” ca webhook-ul s-o pornească. */
export const setCampaignDest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return {
      id: str(d.id, 40),
      dest: d.dest === "wa" ? ("wa" as const) : ("form" as const),
      pending: d.pending === true,
    };
  })
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: r } = await sb
      .from("campaigns")
      .select("id, status, creative")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!r?.creative?.v3 || !["draft", "pending_payment"].includes(r.status))
      throw new Error("Campania nu mai poate fi schimbată.");
    await sb
      .from("campaigns")
      .update({
        creative: { ...r.creative, dest: data.dest },
        objective: data.dest === "wa" ? "MESSAGES" : "LEAD_GENERATION",
        ...(data.pending ? { status: "pending_payment" } : {}),
      })
      .eq("id", data.id);
    return { ok: true };
  });

/** Pornește campania (după plată sau dacă are deja pachetul). */
export const launchCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ id: str((raw as { id?: string } | null)?.id, 40) }))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { hasAdsPlan, launchV3Campaign } = await import("@/lib/v3-campaign.server");
    if (!(await hasAdsPlan(sb, context.userId)))
      return {
        ok: false as const,
        error: "Plata nu a ajuns încă. Mai încercăm în câteva secunde.",
        problem: "unpaid",
      };
    return launchV3Campaign(sb, context.userId, data.id);
  });

/* ---------------- Panoul ---------------- */

export type PanelCampaign = {
  id: string;
  name: string;
  status: string;
  reviewState: string | null;
  budget: number;
  dest: "form" | "wa";
  city: string | null;
  radius: number | null;
  mediaUrl: string | null;
  spendToday: number;
  spendTotal: number;
  leadsTotal: number;
  error: string | null;
};
export type PanelLead = {
  id: string;
  name: string;
  phone: string | null;
  message: string | null;
  status: string;
  createdAt: string;
};
export type Panel = {
  name: string;
  campaigns: PanelCampaign[];
  leads: PanelLead[];
  leadsToday: number;
  waActive: boolean;
};

export const getPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Panel> => {
    const sb = await admin();
    const uid = context.userId;
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [
      { data: prof },
      { data: camps },
      { data: perf },
      { data: leads },
      { count: leadsToday },
      { data: wa },
    ] = await Promise.all([
      sb.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
      sb
        .from("campaigns")
        .select(
          "id, name, status, review_state, budget, objective, creative, targeting, meta_campaign_id, created_at",
        )
        .eq("user_id", uid)
        .eq("platform", "meta")
        .order("created_at", { ascending: false })
        .limit(20),
      sb.from("performance_data").select("campaign_id, date, spend, leads").eq("user_id", uid),
      sb
        .from("leads")
        .select("id, full_name, phone, message, status, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(40),
      sb
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .gte("created_at", startOfDay.toISOString()),
      sb.from("whatsapp_connections").select("status").eq("user_id", uid).maybeSingle(),
    ]);
    const visible = (camps ?? []).filter(
      (c: any) =>
        c.meta_campaign_id ||
        ["pending_payment", "publishing"].includes(c.status) ||
        (c.status === "draft" && c.creative?.v3),
    );
    const campaigns: PanelCampaign[] = await Promise.all(
      visible.map(async (c: any) => {
        const rows = (perf ?? []).filter((p: any) => p.campaign_id === c.id);
        let mediaUrl: string | null = c.creative?.media_url ?? null;
        if (c.creative?.media_bucket && c.creative?.media_path) {
          const { data: s } = await sb.storage
            .from(c.creative.media_bucket)
            .createSignedUrl(c.creative.media_path, 3600);
          mediaUrl = s?.signedUrl ?? mediaUrl;
        }
        return {
          id: c.id,
          name: c.creative?.v3
            ? `${c.creative.what}${c.creative.offer ? ` ${c.creative.offer}` : ""}`
            : c.name,
          status: c.status,
          reviewState: c.review_state ?? null,
          budget: Number(c.budget) || 0,
          dest: c.objective === "MESSAGES" ? "wa" : "form",
          city: c.creative?.city ?? c.targeting?.locations?.[0] ?? null,
          radius: c.creative?.radius_km ?? null,
          mediaUrl,
          spendToday: rows
            .filter((p: any) => p.date === today)
            .reduce((s: number, p: any) => s + Number(p.spend || 0), 0),
          spendTotal: rows.reduce((s: number, p: any) => s + Number(p.spend || 0), 0),
          leadsTotal: rows.reduce((s: number, p: any) => s + Number(p.leads || 0), 0),
          error: c.creative?.last_publish_error ?? null,
        };
      }),
    );
    return {
      name: prof?.full_name ?? "",
      campaigns,
      leads: (leads ?? []).map((l: any) => ({
        id: l.id,
        name: l.full_name || "Fără nume",
        phone: l.phone ?? null,
        message: l.message ?? null,
        status: l.status,
        createdAt: l.created_at,
      })),
      leadsToday: leadsToday ?? 0,
      waActive: wa?.status === "active",
    };
  });

/** Statusul unei cereri din panou: nou → sunat → programat (aceleași valori ca pe WhatsApp). */
export const setLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const status = String(d.status);
    if (!["new", "contacted", "booked", "won", "lost"].includes(status))
      throw new Error("Status invalid.");
    return { id: str(d.id, 40), status };
  })
  .handler(async ({ context, data }) => {
    const sb = await admin();
    await sb
      .from("leads")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Bugetul pe zi, direct din panou (aceeași logică ca la „crește bugetul” pe WhatsApp). */
export const setDailyBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const budget = Math.round(Number(d.budget));
    if (!Number.isFinite(budget) || budget < 30 || budget > 1000)
      throw new Error("Bugetul trebuie să fie între 30 și 1.000 de lei pe zi.");
    return { id: str(d.id, 40), budget };
  })
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: camp } = await sb
      .from("campaigns")
      .select("id, status, meta_adset_id, ad_account_id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!camp) throw new Error("Nu găsesc campania.");
    if (!camp.meta_adset_id) {
      await sb.from("campaigns").update({ budget: data.budget }).eq("id", data.id);
      return { ok: true };
    }
    const { data: conn } = await sb
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) throw new Error("Facebook-ul nu e conectat.");
    let adAccountId: string | null = camp.ad_account_id ?? null;
    if (!adAccountId) {
      const { data: acct } = await sb
        .from("meta_ad_accounts")
        .select("ad_account_id")
        .eq("user_id", context.userId)
        .eq("is_active", true)
        .maybeSingle();
      adAccountId = acct?.ad_account_id ?? null;
    }
    const { ronBudgetToAccountCents } = await import("@/lib/currency.server");
    const { metaApiVersion } = await import("@/lib/meta.server");
    const conv = await ronBudgetToAccountCents(data.budget, adAccountId as any, conn.access_token);
    const r = await fetch(`${GRAPH}/${metaApiVersion()}/${camp.meta_adset_id}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `daily_budget=${conv.cents}&access_token=${encodeURIComponent(conn.access_token)}`,
    });
    const j: any = await r.json();
    if (!r.ok)
      throw new Error(
        j?.error?.error_user_msg || j?.error?.message || "Facebook n-a acceptat bugetul.",
      );
    await sb.from("campaigns").update({ budget: data.budget }).eq("id", data.id);
    return { ok: true };
  });
