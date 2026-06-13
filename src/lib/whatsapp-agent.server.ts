/**
 * WhatsApp AI agent: runs Lovable AI with tool-calling to control campaigns.
 * Server-only. Invoked from the WA webhook (no user JWT — we pass user_id explicitly).
 */
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { sendWhatsAppMessage } from "./whatsapp.server";
import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

type AgentCtx = {
  userId: string;
  connection: {
    id: string;
    phone_number_id: string;
    access_token: string;
  };
  toPhone: string;
  /** Most recent media uploaded by the user in this conversation (path in wa-media bucket). */
  latestMedia: { path: string; mime: string; signedUrl: string } | null;
};

const SYSTEM_PROMPT = `Ești AdPilot AI — asistent expert de Facebook & Instagram Ads pentru clientul tău, care îți scrie pe WhatsApp.

Stilul tău:
- Vorbește mereu în limba română, cu ton prietenos, direct, profesionist. Folosește emoji-uri relevante moderat (📊 🎯 💰 🚀 ⚠️ ✅).
- Răspunsuri scurte, structurate cu bullet-uri când e nevoie. Maxim 5-6 linii per mesaj.
- Ești PROACTIV: când vezi probleme (CPL mare, spend 0, lead-uri 0 după mult buget) — semnalează singur și propune acțiuni.

Capacități:
- Poți lista campaniile cu \`list_campaigns\`.
- Poți vedea metrici (spend, lead-uri, CPL) cu \`get_insights\`.
- Poți porni/opri/pune pe pauză campanii (\`pause_campaign\`, \`resume_campaign\`).
- Poți modifica bugetul zilnic (\`update_budget\`).
- Poți genera copy nou (headline + text + CTA) cu \`generate_copy\` — folosește emoji-uri și subtexte clare.
- Poți crea o campanie complet nouă cu \`create_campaign\` — necesită o imagine trimisă de user pe WhatsApp + buget + descrierea ofertei. Confirmă mereu cu user-ul DETALIILE (nume, buget, copy) înainte să apelezi tool-ul.
- Poți lista lead-urile recente cu \`list_recent_leads\`.

Reguli importante:
- Pentru acțiuni care schimbă bani (create_campaign, update_budget cu modificare >50%) — cere mereu confirmare scurtă ("Confirmi? Da/Nu") ÎNAINTE să apelezi tool-ul.
- Pentru pause/resume — execută direct, apoi confirmă într-o linie.
- Dacă userul îți trimite o poză fără context, întreabă-l ce vrea să facă cu ea (campanie nouă? doar copy?).
- Când generezi copy, oferă 2-3 variante scurte din care să aleagă.
- Dacă userul cere ceva ce nu poți face, spune clar și sugerează o alternativă.
- IMPORTANT pentru imagini: folosește DOAR fotografii trimise direct pe WhatsApp (vor apărea în câmpul "imagine disponibilă" din context). NU cere URL-uri externe și NU accepta link-uri spre site-uri (Pixabay, Google Images, etc.) — sistemul nu le poate descărca. Dacă userul nu a trimis încă o poză, cere-i clar: „Trimite-mi te rog poza pentru reclamă direct aici pe WhatsApp 📸".
- Dacă pentru create_campaign nu există imagine disponibilă (latestMedia lipsește), NU apela tool-ul — întâi cere fotografia. Imaginea din ultimele 24h rămâne disponibilă pentru confirmări ulterioare.
- NU cere niciodată userului URL-ul site-ului (landing_url). Pentru campanii Lead Generation formularul se completează direct pe Facebook/Instagram, nu e nevoie de site extern. Lasă landing_url gol și sistemul va folosi automat un URL valid implicit.`;

export async function runWhatsAppAgent(
  ctx: AgentCtx,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const provider = createLovableAiGatewayProvider(apiKey);
  const model = provider("google/gemini-2.5-flash");

  const tools = buildTools(ctx, supabaseAdmin);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT + mediaHint(ctx) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const result = await generateText({
    model,
    messages,
    tools,
    stopWhen: stepCountIs(50),
  });

  const finalText = result.text?.trim() || "Gata. ✅";
  // Send reply (split if too long)
  await sendChunked(ctx, finalText);
  return { text: finalText };
}

function mediaHint(ctx: AgentCtx): string {
  if (!ctx.latestMedia) {
    return "\n\n[Context imagine] Nu există nicio fotografie disponibilă în conversație. Dacă userul vrea o campanie nouă, cere-i să trimită poza direct pe WhatsApp.";
  }
  return `\n\n[Context imagine] Userul a trimis o imagine (${ctx.latestMedia.mime}) — disponibilă pentru create_campaign. NU cere URL, folosește direct tool-ul.`;
}

async function sendChunked(ctx: AgentCtx, text: string) {
  const CHUNK = 3500;
  for (let i = 0; i < text.length; i += CHUNK) {
    const part = text.slice(i, i + CHUNK);
    const { id } = await sendWhatsAppMessage(
      ctx.connection.phone_number_id,
      ctx.connection.access_token,
      ctx.toPhone,
      { type: "text", text: part },
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: ctx.userId,
      connection_id: ctx.connection.id,
      wa_message_id: id,
      direction: "out",
      msg_type: "text",
      text: part,
    });
  }
}

function buildTools(ctx: AgentCtx, supabaseAdmin: any) {
  return {
    list_campaigns: tool({
      description: "Listează campaniile userului cu nume, status, buget zilnic, platform.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabaseAdmin
          .from("campaigns")
          .select("id, name, status, budget, budget_mode, platform, meta_campaign_id, created_at")
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) return { error: error.message };
        return { campaigns: data ?? [] };
      },
    }),

    get_insights: tool({
      description: "Obține metrici live (spend, impresii, click-uri, lead-uri, CPL) pentru o campanie din ultimele N zile.",
      inputSchema: z.object({
        campaign_id: z.string().describe("UUID-ul campaniei din DB"),
        days: z.number().int().min(1).max(90).default(7),
      }),
      execute: async ({ campaign_id, days }) => {
        const camp = await getCampaign(supabaseAdmin, ctx.userId, campaign_id);
        if (!camp) return { error: "Campanie negăsită" };
        if (!camp.meta_campaign_id) return { error: "Campania nu e publicată pe Meta încă" };
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Nu există conexiune Meta activă" };
        const datePreset = days <= 1 ? "today" : days <= 7 ? "last_7d" : days <= 30 ? "last_30d" : "last_90d";
        const url = `${GRAPH}/${metaApiVersion()}/${camp.meta_campaign_id}/insights?fields=spend,impressions,clicks,actions&date_preset=${datePreset}&access_token=${encodeURIComponent(token)}`;
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok) return { error: j?.error?.message || `Meta ${r.status}` };
        const row = j?.data?.[0] ?? {};
        const leads = Number((row.actions ?? []).find((a: any) => a.action_type === "lead")?.value ?? 0);
        const spend = Number(row.spend ?? 0);
        return {
          campaign: camp.name,
          period_days: days,
          spend,
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          leads,
          cpl: leads > 0 ? spend / leads : null,
        };
      },
    }),

    pause_campaign: tool({
      description: "Pune pe pauză o campanie Meta. Execută direct, fără confirmare suplimentară.",
      inputSchema: z.object({ campaign_id: z.string() }),
      execute: async ({ campaign_id }) => setMetaStatus(supabaseAdmin, ctx.userId, campaign_id, "PAUSED"),
    }),

    resume_campaign: tool({
      description: "Pornește/reactivează o campanie Meta.",
      inputSchema: z.object({ campaign_id: z.string() }),
      execute: async ({ campaign_id }) => setMetaStatus(supabaseAdmin, ctx.userId, campaign_id, "ACTIVE"),
    }),

    update_budget: tool({
      description: "Modifică bugetul zilnic al unei campanii (în RON sau valuta contului). User trebuie să confirme dacă creșterea e >50%.",
      inputSchema: z.object({
        campaign_id: z.string(),
        new_daily_budget: z.number().positive().describe("Buget zilnic în unități întregi (ex 50 = 50 RON/zi)"),
      }),
      execute: async ({ campaign_id, new_daily_budget }) => {
        const camp = await getCampaign(supabaseAdmin, ctx.userId, campaign_id);
        if (!camp) return { error: "Campanie negăsită" };
        if (!camp.meta_adset_id) return { error: "AdSet Meta lipsă" };
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Fără conexiune Meta" };
        const cents = Math.round(new_daily_budget * 100);
        const r = await fetch(`${GRAPH}/${metaApiVersion()}/${camp.meta_adset_id}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: `daily_budget=${cents}&access_token=${encodeURIComponent(token)}`,
        });
        const j = await r.json();
        if (!r.ok) return { error: j?.error?.message || `Meta ${r.status}` };
        await supabaseAdmin.from("campaigns").update({ budget: new_daily_budget }).eq("id", campaign_id);
        return { ok: true, new_daily_budget };
      },
    }),

    generate_copy: tool({
      description: "Generează 3 variante de copy pentru o reclamă: headline (max 40 char), primary text (cu emoji-uri și subtexte), description (max 30 char), CTA recomandat.",
      inputSchema: z.object({
        product_description: z.string(),
        tone: z.enum(["profesionist", "casual", "urgent", "premium"]).default("casual"),
        language: z.string().default("ro"),
      }),
      execute: async ({ product_description, tone, language }) => {
        const apiKey = process.env.LOVABLE_API_KEY!;
        const provider = createLovableAiGatewayProvider(apiKey);
        const sub = await generateText({
          model: provider("google/gemini-2.5-flash"),
          messages: [
            {
              role: "system",
              content: `Ești copywriter pentru Facebook Ads. Generează în limba ${language} 3 variante distincte (A, B, C) în format JSON: [{"headline":"","primary_text":"","description":"","cta":""}]. Headline max 40 char. Primary text: 2-4 linii, cu 2-3 emoji-uri relevante, hook puternic prima linie, beneficii și CTA la final. CTA din: Learn More, Sign Up, Shop Now, Book Now, Apply Now. Ton: ${tone}.`,
            },
            { role: "user", content: product_description },
          ],
        });
        const txt = sub.text;
        let variants: any = [];
        try {
          const m = txt.match(/\[[\s\S]*\]/);
          if (m) variants = JSON.parse(m[0]);
        } catch {
          /* ignore */
        }
        return { raw: txt, variants };
      },
    }),

    list_recent_leads: tool({
      description: "Listează ultimele lead-uri primite.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(5) }),
      execute: async ({ limit }) => {
        const { data, error } = await supabaseAdmin
          .from("leads")
          .select("id, full_name, email, phone, message, created_at, status, campaign_id")
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return { error: error.message };
        return { leads: data ?? [] };
      },
    }),

    create_campaign: tool({
      description:
        "Creează și lansează o campanie Meta Lead Generation completă. Necesită imagine (folosește latestMedia trimis de user). Cere mereu CONFIRMAREA user-ului înainte să apelezi.",
      inputSchema: z.object({
        name: z.string().max(80),
        daily_budget: z.number().positive().describe("Buget zilnic în RON/valuta cont"),
        headline: z.string().max(40),
        primary_text: z.string().max(500),
        description: z.string().max(50).optional(),
        cta: z.enum(["Learn More", "Sign Up", "Shop Now", "Book Now", "Apply Now"]).default("Learn More"),
        landing_url: z.string().url().optional(),
        countries: z.array(z.string()).default(["RO"]).describe("Coduri ISO 2-litere, ex ['RO']"),
        age_min: z.number().int().min(13).max(65).default(18),
        age_max: z.number().int().min(13).max(65).default(65),
      }),
      execute: async (args) => {
        if (!ctx.latestMedia) {
          return { error: "Userul nu a trimis imagine. Cere-i să trimită o poză pentru reclamă." };
        }
        return await createMetaCampaignFromAgent(supabaseAdmin, ctx, args);
      },
    }),
  };
}

async function getCampaign(supabaseAdmin: any, userId: string, id: string) {
  const { data } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

async function getMetaToken(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("meta_connections")
    .select("access_token")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.access_token ?? null;
}

async function setMetaStatus(
  supabaseAdmin: any,
  userId: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
) {
  const camp = await getCampaign(supabaseAdmin, userId, campaignId);
  if (!camp) return { error: "Campanie negăsită" };
  if (!camp.meta_campaign_id) return { error: "Campanie nepublicată" };
  const token = await getMetaToken(supabaseAdmin, userId);
  if (!token) return { error: "Fără Meta" };
  const r = await fetch(`${GRAPH}/${metaApiVersion()}/${camp.meta_campaign_id}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `status=${status}&access_token=${encodeURIComponent(token)}`,
  });
  const j = await r.json();
  if (!r.ok) return { error: j?.error?.message || `Meta ${r.status}` };
  await supabaseAdmin
    .from("campaigns")
    .update({ status: status === "ACTIVE" ? "active" : "paused" })
    .eq("id", campaignId);
  return { ok: true, status };
}

async function createMetaCampaignFromAgent(
  supabaseAdmin: any,
  ctx: AgentCtx,
  args: {
    name: string;
    daily_budget: number;
    headline: string;
    primary_text: string;
    description?: string;
    cta: string;
    landing_url?: string;
    countries: string[];
    age_min: number;
    age_max: number;
  },
) {
  // Resolve connection / ad account / page
  const { data: conn } = await supabaseAdmin
    .from("meta_connections")
    .select("id, access_token")
    .eq("user_id", ctx.userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!conn?.access_token) return { error: "Conectează Meta din Settings înainte." };

  const { data: adAcc } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("ad_account_id")
    .eq("user_id", ctx.userId)
    .eq("connection_id", conn.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!adAcc?.ad_account_id) return { error: "Selectează un ad account din Settings." };

  const { data: page } = await supabaseAdmin
    .from("meta_pages")
    .select("page_id, page_access_token")
    .eq("user_id", ctx.userId)
    .eq("connection_id", conn.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!page?.page_id || !page.page_access_token) return { error: "Conectează o Pagină în Settings." };

  // Download media bytes from wa-media bucket
  const { data: file, error: dlErr } = await supabaseAdmin.storage
    .from("wa-media")
    .download(ctx.latestMedia!.path);
  if (dlErr || !file) return { error: `Nu pot citi imaginea: ${dlErr?.message}` };
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Insert campaign row first
  const { data: campRow, error: insErr } = await supabaseAdmin
    .from("campaigns")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      platform: "meta",
      objective: "LEAD_GENERATION",
      status: "draft",
      budget: args.daily_budget,
      budget_mode: "BUDGET_MODE_DAY",
      creative: {
        headline: args.headline,
        description: args.description ?? "",
        primary_text: args.primary_text,
        cta: args.cta,
        landing_url: args.landing_url ?? "https://adpilot.ro",
        media_url: ctx.latestMedia!.signedUrl,
      },
      lead_form: { title: args.name, fields: ["Name", "Phone"] },
      targeting: {
        locations: args.countries,
        age_groups: [`${args.age_min}-${args.age_max}`],
        genders: ["All"],
      },
    })
    .select("id")
    .single();
  if (insErr || !campRow) return { error: insErr?.message || "Nu pot crea campania în DB" };

  // Use existing meta-publish helpers
  const {
    createLeadForm,
    uploadAdImageFromBytes,
    createCampaign,
    createAdSet,
    createAdCreative,
    createAd,
  } = await import("./meta-publish.server");

  try {
    const form = await createLeadForm(page.page_id, page.page_access_token, {
      name: args.name,
      fields: ["Name", "Phone"],
      privacy_url: "https://adpilot.ro/privacy-policy",
    });
    const metaCamp = await createCampaign(adAcc.ad_account_id, conn.access_token, args.name, "ACTIVE");
    const adset = await createAdSet(adAcc.ad_account_id, conn.access_token, {
      name: `${args.name} — AdSet`,
      campaign_id: metaCamp.id,
      daily_budget_cents: Math.round(args.daily_budget * 100),
      page_id: page.page_id,
      targeting: { countries: args.countries, age_min: args.age_min, age_max: args.age_max },
      status: "ACTIVE",
    });
    const image_hash = await uploadAdImageFromBytes(
      adAcc.ad_account_id,
      conn.access_token,
      bytes,
      "ad.jpg",
      ctx.latestMedia!.mime || "image/jpeg",
    );
    const adCreative = await createAdCreative(adAcc.ad_account_id, conn.access_token, {
      name: `${args.name} — Creative`,
      page_id: page.page_id,
      image_hash,
      headline: args.headline,
      description: args.primary_text,
      cta: args.cta,
      landing_url: args.landing_url ?? "https://adpilot.ro",
      lead_gen_form_id: form.id,
    });
    const ad = await createAd(adAcc.ad_account_id, conn.access_token, {
      name: `${args.name} — Ad`,
      adset_id: adset.id,
      creative_id: adCreative.id,
      status: "ACTIVE",
    });
    await supabaseAdmin
      .from("campaigns")
      .update({
        meta_campaign_id: metaCamp.id,
        meta_adset_id: adset.id,
        meta_ad_id: ad.id,
        meta_lead_form_id: form.id,
        status: "active",
      })
      .eq("id", campRow.id);
    return {
      ok: true,
      campaign_id: campRow.id,
      meta_campaign_id: metaCamp.id,
      message: "Campanie LIVE pe Meta ✅",
    };
  } catch (e: any) {
    return { error: e?.message ?? "Publish failed" };
  }
}