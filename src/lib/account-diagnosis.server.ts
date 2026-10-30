/**
 * Diagnosticul contului: ce are clientul pe Meta / TikTok / WhatsApp și ce a rulat înainte.
 * Rezultatul (segmentul + ce lipsește + istoricul pe 90 de zile) îl folosește asistentul de
 * pe WhatsApp ca să aleagă drumul potrivit fără să-l întrebe pe client lucruri pe care le putem afla.
 *
 * Doar citire. Tokenurile nu ies din server și nu ajung în rezultat.
 */
import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

export type Segment = "zero" | "ready_new" | "experienced" | "advanced";

export type MissingStep =
  | "connect_meta"
  | "facebook_page"
  | "ad_account"
  | "payment_method"
  | "lead_terms"
  | "page_choice"
  | "whatsapp";

export type AdHistory = {
  spend: number;
  currency: string | null;
  impressions: number;
  clicks: number;
  leads: number;
  costPerLead: number | null;
  campaigns: number;
  activeCampaigns: number;
  bestAd: { id: string; name: string; leads: number; costPerLead: number; spend: number } | null;
};

export type AccountDiagnosis = {
  segment: Segment;
  missing: MissingStep[];
  meta: {
    connected: boolean;
    pages: Array<{ id: string; name: string | null }>;
    /** Pagina pe care facem reclame acum. */
    activePage: { id: string; name: string | null } | null;
    /** Are mai multe pagini și n-a confirmat pe care facem reclame. */
    pageChoiceNeeded: boolean;
    /** Celelalte conturi de reclame (pentru schimbare când cel ales nu merge). */
    otherAdAccounts: Array<{ id: string; name: string | null; status: number | null; currency: string | null }>;
    /** Ultima eroare Meta la publicare (ultimele 3 zile), explicată. */
    lastPublishProblem: { kind: string; message: string; at: string } | null;
    /** Pagina activă a acceptat Condițiile Meta pentru formulare? null = necunoscut. */
    leadTerms: { pageId: string; accepted: boolean | null } | null;
    adAccount: { id: string; name: string | null; status: number | null; currency: string | null } | null;
    hasPaymentMethod: boolean;
    pixel: { id: string; name: string | null; lastFired: string | null } | null;
    history: AdHistory | null;
  };
  tiktok: { connected: boolean; advertiserId: string | null };
  whatsapp: { active: boolean };
  computedAt: string;
};

const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];

function leadsFrom(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions?.length) return 0;
  // Meta raportează același lead sub mai multe tipuri; luăm maximul, nu suma.
  return Math.max(
    0,
    ...actions.filter((a) => LEAD_ACTIONS.includes(a.action_type)).map((a) => Number(a.value) || 0),
  );
}

async function graph<T = any>(path: string, token: string, params: Record<string, string> = {}): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  try {
    const res = await fetch(`${GRAPH}/${metaApiVersion()}/${path}?${qs.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Istoricul pe 90 de zile al unui cont de reclame: cheltuieli, lead-uri, cea mai bună reclamă. */
export async function readAdHistory(token: string, adAccountId: string): Promise<AdHistory | null> {
  const act = `act_${adAccountId}`;
  const [acct, byAd, camps] = await Promise.all([
    graph<{ data?: any[] }>(`${act}/insights`, token, {
      date_preset: "last_90d",
      fields: "spend,impressions,clicks,actions,account_currency",
    }),
    graph<{ data?: any[] }>(`${act}/insights`, token, {
      date_preset: "last_90d",
      level: "ad",
      fields: "ad_id,ad_name,spend,actions",
      limit: "200",
    }),
    graph<{ data?: any[] }>(`${act}/campaigns`, token, {
      fields: "effective_status",
      date_preset: "last_90d",
      limit: "200",
    }),
  ]);
  const row = acct?.data?.[0];
  if (!row) return null;

  const spend = Number(row.spend) || 0;
  const leads = leadsFrom(row.actions);
  let bestAd: AdHistory["bestAd"] = null;
  for (const a of byAd?.data ?? []) {
    const l = leadsFrom(a.actions);
    const s = Number(a.spend) || 0;
    if (l < 3 || s <= 0) continue; // sub 3 lead-uri, costul nu spune nimic
    const cpl = s / l;
    if (!bestAd || cpl < bestAd.costPerLead) {
      bestAd = { id: String(a.ad_id), name: String(a.ad_name ?? ""), leads: l, costPerLead: round2(cpl), spend: round2(s) };
    }
  }
  const campaigns = camps?.data ?? [];
  return {
    spend: round2(spend),
    currency: row.account_currency ?? null,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    leads,
    costPerLead: leads > 0 ? round2(spend / leads) : null,
    campaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.effective_status === "ACTIVE").length,
    bestAd,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function diagnoseAccount(supabaseAdmin: any, userId: string): Promise<AccountDiagnosis> {
  const [{ data: conn }, { data: tt }, { data: wa }] = await Promise.all([
    supabaseAdmin
      .from("meta_connections")
      .select("id, access_token, page_confirmed_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("tiktok_advertisers")
      .select("advertiser_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabaseAdmin.from("whatsapp_connections").select("status").eq("user_id", userId).maybeSingle(),
  ]);

  const meta: AccountDiagnosis["meta"] = {
    connected: !!conn?.access_token,
    pages: [],
    activePage: null,
    pageChoiceNeeded: false,
    otherAdAccounts: [],
    lastPublishProblem: null,
    leadTerms: null,
    adAccount: null,
    hasPaymentMethod: false,
    pixel: null,
    history: null,
  };

  if (conn?.access_token) {
    const token = conn.access_token as string;
    const [{ data: pages }, { data: accts }] = await Promise.all([
      supabaseAdmin.from("meta_pages").select("page_id, page_name, page_access_token, is_active").eq("connection_id", conn.id),
      supabaseAdmin
        .from("meta_ad_accounts")
        .select("ad_account_id, account_name, currency, is_active, status")
        .eq("connection_id", conn.id),
    ]);
    meta.pages = (pages ?? []).map((p: any) => ({ id: p.page_id, name: p.page_name ?? null }));
    const activePage = (pages ?? []).find((p: any) => p.is_active) ?? (pages ?? [])[0];
    if (activePage) meta.activePage = { id: activePage.page_id, name: activePage.page_name ?? null };
    meta.pageChoiceNeeded = (pages ?? []).length > 1 && !conn.page_confirmed_at;
    if (activePage?.page_access_token) {
      const { pageLeadTermsAccepted } = await import("./meta-publish.server");
      meta.leadTerms = {
        pageId: activePage.page_id,
        accepted: await pageLeadTermsAccepted(activePage.page_id, activePage.page_access_token),
      };
    }

    const chosen = (accts ?? []).find((a: any) => a.is_active) ?? (accts ?? [])[0];
    meta.otherAdAccounts = (accts ?? [])
      .filter((a: any) => a.ad_account_id !== chosen?.ad_account_id)
      .map((a: any) => ({
        id: a.ad_account_id,
        name: a.account_name ?? null,
        status: a.status != null && a.status !== "" ? Number(a.status) : null,
        currency: a.currency ?? null,
      }));
    if (chosen) {
      const info = await graph<any>(`act_${chosen.ad_account_id}`, token, {
        fields: "account_status,currency,funding_source_details,name",
      });
      meta.adAccount = {
        id: chosen.ad_account_id,
        name: info?.name ?? chosen.account_name ?? null,
        status: typeof info?.account_status === "number" ? info.account_status : null,
        currency: info?.currency ?? chosen.currency ?? null,
      };
      const f = info?.funding_source_details;
      meta.hasPaymentMethod = !!(f && (f.id || f.display_string || typeof f.type === "number"));

      const [pixels, history] = await Promise.all([
        graph<{ data?: any[] }>(`act_${chosen.ad_account_id}/adspixels`, token, {
          fields: "id,name,last_fired_time",
          limit: "10",
        }),
        readAdHistory(token, chosen.ad_account_id),
      ]);
      const px = (pixels?.data ?? []).sort((a, b) =>
        String(b.last_fired_time ?? "").localeCompare(String(a.last_fired_time ?? "")),
      )[0];
      if (px) meta.pixel = { id: String(px.id), name: px.name ?? null, lastFired: px.last_fired_time ?? null };
      meta.history = history;
    }
  }

  // Ultima eroare de publicare (ultimele 3 zile), ca botul să știe exact ce l-a oprit.
  try {
    const { data: lastErr } = await supabaseAdmin
      .from("campaigns")
      .select("creative, updated_at")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .gte("updated_at", new Date(Date.now() - 3 * 86400_000).toISOString())
      .order("updated_at", { ascending: false })
      .limit(5);
    // Doar dacă cea mai recentă încercare a eșuat (o lansare reușită după aceea înseamnă că s-a rezolvat).
    const newest = (lastErr ?? [])[0] as any;
    const row = newest?.creative?.last_publish_error ? newest : null;
    if (row) {
      const { explainMetaError } = await import("./meta-errors.server");
      const p = explainMetaError(String(row.creative.last_publish_error), {
        adAccountId: meta.adAccount?.id,
        pageId: meta.activePage?.id,
      });
      meta.lastPublishProblem = {
        kind: p.kind,
        message: p.user_message,
        at: String(row.creative.last_publish_error_at ?? row.updated_at),
      };
    }
  } catch {
    /* opțional */
  }

  const missing: MissingStep[] = [];
  if (!meta.connected) missing.push("connect_meta");
  else {
    if (!meta.pages.length) missing.push("facebook_page");
    if (!meta.adAccount || meta.adAccount.status !== 1) missing.push("ad_account");
    else if (!meta.hasPaymentMethod) missing.push("payment_method");
    if (meta.leadTerms?.accepted === false) missing.push("lead_terms");
    if (meta.pageChoiceNeeded) missing.push("page_choice");
  }
  const waActive = wa?.status === "active";
  if (!waActive) missing.push("whatsapp");

  const spent = (meta.history?.spend ?? 0) > 0;
  const pixelFiredRecently =
    !!meta.pixel?.lastFired && Date.now() - new Date(meta.pixel.lastFired).getTime() < 30 * 86400_000;
  const segment: Segment =
    !meta.connected || missing.includes("facebook_page") || missing.includes("ad_account")
      ? "zero"
      : !spent
        ? "ready_new"
        : pixelFiredRecently && (meta.history?.activeCampaigns ?? 0) > 0
          ? "advanced"
          : "experienced";

  return {
    segment,
    missing,
    meta,
    tiktok: { connected: !!tt?.advertiser_id, advertiserId: tt?.advertiser_id ?? null },
    whatsapp: { active: waActive },
    computedAt: new Date().toISOString(),
  };
}

/** Rezumat scurt, în română, pentru contextul asistentului. Fără date sensibile. */
export function diagnosisForAgent(d: AccountDiagnosis): string {
  const lines: string[] = [];
  const seg: Record<Segment, string> = {
    zero: "de la zero (îi lipsesc pași de bază)",
    ready_new: "pregătit, dar n-a mai rulat reclame",
    experienced: "a mai rulat reclame",
    advanced: "avansat (pixel activ, campanii active)",
  };
  lines.push(`Segment: ${seg[d.segment]}.`);
  const missingText: Record<MissingStep, string> = {
    connect_meta: "nu și-a conectat Facebook-ul",
    facebook_page: "nu are pagină de Facebook",
    ad_account: "nu are cont de reclame activ",
    payment_method: "nu are card adăugat în contul de reclame Facebook",
    lead_terms: "pagina n-a acceptat Condițiile Meta pentru reclame cu formular (necesar doar pentru campanii cu formular)",
    page_choice: "are mai multe pagini de Facebook și trebuie să aleagă pe care facem reclame (întreabă-l cu send_choice, apoi select_page)",
    whatsapp: "WhatsApp nu e activ",
  };
  if (d.missing.length) lines.push(`Lipsește: ${d.missing.map((m) => missingText[m]).join("; ")}.`);
  if (d.meta.activePage) lines.push(`Pagina folosită pentru reclame: ${d.meta.activePage.name ?? d.meta.activePage.id} (id ${d.meta.activePage.id}).`);
  if (d.meta.pages.length > 1) {
    lines.push(`Toate paginile: ${d.meta.pages.map((p) => `${p.name ?? p.id} (id ${p.id})`).slice(0, 10).join(", ")}.`);
  }
  if (d.meta.adAccount) {
    const a = d.meta.adAccount;
    const st: Record<number, string> = { 1: "activ", 2: "dezactivat", 3: "cu sumă neplătită", 7: "în verificare", 9: "în perioadă de grație", 100: "în curs de închidere", 101: "închis" };
    lines.push(
      `Cont de reclame folosit: ${a.name ?? ""} (id ${a.id}, ${a.status != null ? st[a.status] ?? `status ${a.status}` : "status necunoscut"}, ${a.currency ?? "?"}, ${d.meta.hasPaymentMethod ? "are card" : "fără card"}).`,
    );
  }
  if (d.meta.otherAdAccounts?.length) {
    lines.push(
      `Alte conturi de reclame: ${d.meta.otherAdAccounts.map((o) => `${o.name ?? ""} (id ${o.id}, status ${o.status ?? "?"}, ${o.currency ?? "?"})`).join("; ")}.`,
    );
  }
  if (d.meta.lastPublishProblem) {
    lines.push(
      `Ultima eroare Meta la publicare (${d.meta.lastPublishProblem.at.slice(0, 16)}), tip ${d.meta.lastPublishProblem.kind}: ${d.meta.lastPublishProblem.message}`,
    );
  }
  const h = d.meta.history;
  if (h && h.spend > 0) {
    const cur = h.currency ?? "lei";
    lines.push(
      `Ultimele 90 de zile: ${h.spend} ${cur} cheltuiți, ${h.leads} lead-uri${h.costPerLead ? `, ${h.costPerLead} ${cur}/lead` : ""}, ${h.campaigns} campanii (${h.activeCampaigns} active acum).`,
    );
    if (h.bestAd) {
      lines.push(
        `Cea mai bună reclamă: „${h.bestAd.name}” — ${h.bestAd.leads} lead-uri la ${h.bestAd.costPerLead} ${cur}/lead.`,
      );
    }
  }
  if (d.meta.pixel) lines.push(`Pixel: ${d.meta.pixel.name ?? d.meta.pixel.id}${d.meta.pixel.lastFired ? `, ultima activitate ${d.meta.pixel.lastFired.slice(0, 10)}` : ", fără activitate"}.`);
  lines.push(`TikTok: ${d.tiktok.connected ? "conectat" : "neconectat"}.`);
  return lines.join("\n");
}

const DIAGNOSIS_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Când lipsește ceva, verificăm des: omul tocmai poate rezolva pasul. */
const DIAGNOSIS_MAX_AGE_BLOCKED_MS = 10 * 60 * 1000;

/**
 * Diagnosticul din cache (max 6 ore), recalculat când e vechi sau la cerere (`force`).
 * Nu aruncă: dacă Meta nu răspunde, întoarce ultimul diagnostic salvat sau null.
 */
export async function getDiagnosis(
  supabaseAdmin: any,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<AccountDiagnosis | null> {
  const { data: row } = await supabaseAdmin
    .from("account_diagnoses")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  const cached = row?.data as AccountDiagnosis | undefined;
  const blocked = !!cached && ((cached.missing?.length ?? 0) > 0 || !!cached.meta?.lastPublishProblem);
  const maxAge = blocked ? DIAGNOSIS_MAX_AGE_BLOCKED_MS : DIAGNOSIS_MAX_AGE_MS;
  const fresh = row && Date.now() - new Date(row.updated_at).getTime() < maxAge;
  if (fresh && !opts.force) return row.data as AccountDiagnosis;
  try {
    const d = await diagnoseAccount(supabaseAdmin, userId);
    await supabaseAdmin
      .from("account_diagnoses")
      .upsert({ user_id: userId, segment: d.segment, data: d, updated_at: d.computedAt }, { onConflict: "user_id" });
    return d;
  } catch (e) {
    console.warn("[diagnosis] failed", (e as Error).message);
    return (row?.data as AccountDiagnosis) ?? null;
  }
}

/** Linkurile pe care asistentul le poate trimite pentru pașii lipsă. */
export async function nextStepLinks(d: AccountDiagnosis, userId?: string): Promise<string[]> {
  const out: string[] = [];
  if (d.missing.includes("connect_meta") && userId) {
    const { metaConnectLink } = await import("./connect-link.server");
    out.push(
      `Conectare Facebook — link personal, se deschide direct pe telefon, fără parolă și fără să intre în aplicație (valabil 24h): ${metaConnectLink(userId)}`,
    );
  }
  if (d.missing.includes("facebook_page")) out.push("Creare pagină Facebook: https://www.facebook.com/pages/create");
  if (d.missing.includes("lead_terms") && d.meta.leadTerms) {
    out.push(`Acceptare condiții formulare Meta (deschide, apasă „Creează formular”, apoi „Accept”): https://business.facebook.com/latest/instant_forms?asset_id=${d.meta.leadTerms.pageId}`);
  }
  if (d.missing.includes("payment_method") && d.meta.adAccount) {
    out.push(
      `Adăugare card în contul de reclame: https://business.facebook.com/ads/manager/account_settings/account_billing/?act=${d.meta.adAccount.id}`,
    );
  }
  return out;
}
