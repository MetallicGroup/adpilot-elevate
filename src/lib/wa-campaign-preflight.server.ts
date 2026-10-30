/**
 * Verificarea de dinainte de lansare, pentru agentul de pe WhatsApp: tot ce poate opri o campanie
 * se află ÎNAINTE ca omul să spună „da”, nu după.
 *
 *  - contul de reclame ales e închis → trecem singuri pe unul activ;
 *  - cont cu datorie / fără card / pagină fără condițiile pentru formulare → pasul exact, cu link;
 *  - Meta validează campania (validate_only) și publicul (delivery_estimate, cu mărimea estimată);
 *    atenție: verificarea de securitate a contului (checkpoint) și restricțiile de profil NU apar aici,
 *    doar la crearea reală — acolo le explică meta-errors.server.ts, iar ciclul de după lansare le urmărește;
 *  - textul de pe creativ: ce promite („Scrie-ne pe WhatsApp”) trebuie să se potrivească cu destinația.
 */
import { explainMetaError } from "./meta-errors.server";
import { detectCreativePromise } from "./wa-campaign-strategy.server";
import type { MessageDestination } from "./meta-publish.server";

const CLOSED = new Set([2, 100, 101]);

/**
 * Dacă contul de reclame ales e închis/dezactivat și există altul activ, îl alegem pe acela.
 * Întoarce contul de folosit și o notă pentru om când s-a schimbat.
 */
export async function autoSwitchAdAccount(
  supabaseAdmin: any,
  userId: string,
  connectionId: string,
  accessToken: string,
): Promise<{ adAccountId: string | null; note?: string }> {
  const { data: accts } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("ad_account_id, account_name, is_active")
    .eq("user_id", userId)
    .eq("connection_id", connectionId);
  const list = (accts ?? []) as Array<{ ad_account_id: string; account_name: string | null; is_active: boolean }>;
  const current = list.find((a) => a.is_active) ?? list[0];
  if (!current) return { adAccountId: null };
  const { metaApiVersion } = await import("./meta.server");
  const status = async (id: string) => {
    try {
      const r = await fetch(
        `https://graph.facebook.com/${metaApiVersion()}/act_${id}?fields=account_status&access_token=${encodeURIComponent(accessToken)}`,
      );
      const j: any = await r.json();
      return r.ok ? Number(j?.account_status) : null;
    } catch {
      return null;
    }
  };
  const curStatus = await status(current.ad_account_id);
  if (curStatus === null || !CLOSED.has(curStatus)) return { adAccountId: current.ad_account_id };
  for (const other of list.filter((a) => a.ad_account_id !== current.ad_account_id)) {
    if ((await status(other.ad_account_id)) === 1) {
      await supabaseAdmin.from("meta_ad_accounts").update({ is_active: false }).eq("user_id", userId);
      await supabaseAdmin
        .from("meta_ad_accounts")
        .update({ is_active: true })
        .eq("user_id", userId)
        .eq("ad_account_id", other.ad_account_id);
      await supabaseAdmin.from("account_diagnoses").delete().eq("user_id", userId);
      return {
        adAccountId: other.ad_account_id,
        note: `Contul de reclame ${current.account_name ?? current.ad_account_id} e închis la Facebook, așa că am trecut pe ${other.account_name ?? other.ad_account_id}, care e activ.`,
      };
    }
  }
  return { adAccountId: current.ad_account_id };
}

/** Textul scris pe poza reclamei (prețuri, ofertă, „Scrie-ne pe WhatsApp”), citit cu Claude. */
export async function readCreativeText(bytes: Uint8Array, mime: string): Promise<string | null> {
  if (!/^image\//i.test(mime) || bytes.length > 5_000_000) return null;
  try {
    const { generateText } = await import("ai");
    const { chatModel } = await import("./llm.server");
    const { text } = await generateText({
      model: chatModel(),
      maxOutputTokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: bytes, mediaType: mime },
            {
              type: "text",
              text: "Transcrie exact textul scris pe această imagine de reclamă (prețuri, ofertă, termen, îndemnuri), pe rânduri, fără comentarii. Dacă nu e niciun text, răspunde doar: FĂRĂ TEXT.",
            },
          ],
        },
      ],
    });
    const t = text.trim();
    return !t || /^făr[ăa] text/i.test(t) ? null : t.slice(0, 800);
  } catch (e) {
    console.warn("[preflight] readCreativeText", (e as Error).message);
    return null;
  }
}

/** Destinația reală pentru o reclamă de mesaje. */
export async function resolveMessageDestination(
  pref: "auto" | "whatsapp" | "messenger" | "instagram" | undefined,
  page: { id: string; token: string },
  instagramId: string | null,
): Promise<{ destination: MessageDestination; note?: string }> {
  const { pageWhatsAppNumber } = await import("./meta-publish.server");
  if (pref === "instagram") {
    return instagramId
      ? { destination: "INSTAGRAM_DIRECT" }
      : { destination: "MESSENGER", note: "Pagina n-are cont de Instagram legat, așa că mesajele vin pe Messenger." };
  }
  if (pref === "messenger") return { destination: "MESSENGER" };
  const wa = await pageWhatsAppNumber(page.id, page.token);
  if (wa) return { destination: "WHATSAPP" };
  return {
    destination: "MESSENGER",
    note:
      pref === "whatsapp"
        ? "Pagina de Facebook n-are WhatsApp legat, așa că mesajele vin pe Messenger. Ca să vină pe WhatsApp: Pagina → Setări → WhatsApp → Conectează numărul, apoi refacem."
        : undefined,
  };
}

/** O poză și un clip trimise în ultimele 48h: a doua media (alt tip decât prima) pentru o reclamă în plus. */
export async function recentSecondMedia(
  supabaseAdmin: any,
  userId: string,
  primary: { path: string; mime: string },
): Promise<{ path: string; mime: string } | null> {
  const primaryVideo = primary.mime.toLowerCase().startsWith("video/");
  const { data } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("media_path, media_mime")
    .eq("user_id", userId)
    .eq("direction", "in")
    .not("media_path", "is", null)
    .gte("created_at", new Date(Date.now() - 48 * 3600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  const hit = (data ?? []).find((r: any) => {
    const m = String(r.media_mime ?? "").toLowerCase();
    if (r.media_path === primary.path || !/^(image|video)\//.test(m)) return false;
    return primaryVideo ? m.startsWith("image/") : m.startsWith("video/");
  });
  return hit ? { path: hit.media_path, mime: hit.media_mime } : null;
}

export type PreflightInput = {
  adAccountId: string;
  accessToken: string;
  pageId: string;
  pageAccessToken: string;
  objective: "leads" | "messages" | "traffic" | "sales" | "signups";
  name: string;
  targeting: Record<string, unknown>;
};

export type PreflightResult =
  | { ok: true; audience: string | null; warnings: string[] }
  | { ok: false; kind: string; error: string; link?: string };

/** Tot ce poate opri lansarea, verificat la Meta fără să creeze nimic. */
export async function preflightCampaign(input: PreflightInput): Promise<PreflightResult> {
  const mp = await import("./meta-publish.server");
  const ctx = { adAccountId: input.adAccountId, pageId: input.pageId };
  const warnings: string[] = [];

  const runnable = await mp.checkAdAccountRunnable(input.adAccountId, input.accessToken);
  if (!runnable.ok) {
    const p = explainMetaError(runnable.message ?? "", ctx);
    return { ok: false, kind: p.kind === "unknown" ? "account" : p.kind, error: runnable.message ?? p.user_message, link: p.link };
  }

  const { metaApiVersion } = await import("./meta.server");
  try {
    const r = await fetch(
      `https://graph.facebook.com/${metaApiVersion()}/act_${input.adAccountId}?fields=funding_source_details&access_token=${encodeURIComponent(input.accessToken)}`,
    );
    const j: any = await r.json();
    const f = j?.funding_source_details;
    if (r.ok && !(f && (f.id || f.display_string || typeof f.type === "number"))) {
      const p = explainMetaError("no valid payment method", ctx);
      warnings.push(p.user_message);
    }
  } catch {
    /* nu blocăm */
  }

  if (input.objective === "leads") {
    if ((await mp.pageLeadTermsAccepted(input.pageId, input.pageAccessToken)) === false) {
      const p = explainMetaError("lead ads terms not accepted", ctx);
      return { ok: false, kind: p.kind, error: p.user_message, link: p.link };
    }
  }

  const metaObjective =
    input.objective === "messages"
      ? "OUTCOME_ENGAGEMENT"
      : input.objective === "traffic"
        ? "OUTCOME_TRAFFIC"
        : input.objective === "sales" || input.objective === "signups"
          ? "OUTCOME_SALES"
          : "OUTCOME_LEADS";
  const v = await mp.validateCampaign(input.adAccountId, input.accessToken, input.name, metaObjective);
  if (!v.ok) {
    const p = explainMetaError(v.error, ctx);
    return { ok: false, kind: p.kind, error: p.user_message, link: p.link };
  }

  const goal =
    input.objective === "messages"
      ? "CONVERSATIONS"
      : input.objective === "traffic"
        ? "LINK_CLICKS"
        : input.objective === "leads"
          ? "LEAD_GENERATION"
          : "OFFSITE_CONVERSIONS";
  const est = await mp.estimateAudience(input.adAccountId, input.accessToken, input.targeting, goal);
  if (!est.ok) {
    const p = explainMetaError(est.error, ctx);
    // Publicul e singurul lucru pe care îl putem repara fără om; restul îl raportăm exact.
    return { ok: false, kind: p.kind, error: p.kind === "unknown" ? `Meta a refuzat publicul: ${est.error}` : p.user_message, link: p.link };
  }
  const fmt = (n: number) => n.toLocaleString("ro-RO");
  const audience =
    est.lower && est.upper
      ? `${fmt(est.lower)}–${fmt(est.upper)} de oameni`
      : est.upper
        ? `~${fmt(est.upper)} de oameni`
        : null;
  if (est.upper !== null && est.upper < 2000) {
    warnings.push("Publicul e foarte mic (sub 2.000 de oameni) — reclama se va opri repede. Lărgește zona sau vârsta.");
  }
  return { ok: true, audience, warnings };
}

/** Avertisment când ce scrie pe creativ nu se potrivește cu ce face butonul reclamei. */
export function promiseMismatch(creativeText: string | null, objective: string): string | null {
  const promise = detectCreativePromise(creativeText);
  if (promise === "messages" && objective !== "messages") {
    return "Pe poză scrie că omul vă poate scrie un mesaj („Scrie-ne”/WhatsApp), dar reclama e setată cu formular. Oamenii apasă așteptând chatul, văd un formular și renunță. Recomand reclamă de MESAJE (objective=messages), ca butonul să deschidă direct chatul.";
  }
  if (promise === "calls" && objective !== "calls" && objective !== "traffic") {
    return "Pe poză scrie să sune, dar reclama e setată altfel. Dacă vrei apeluri, pot face reclama cu butonul „Sună acum”.";
  }
  return null;
}
