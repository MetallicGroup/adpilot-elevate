/**
 * WhatsApp AI agent: runs Lovable AI with tool-calling to control campaigns.
 * Server-only. Invoked from the WA webhook (no user JWT — we pass user_id explicitly).
 */
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { sendWhatsAppMessage, uploadWhatsAppMedia } from "./whatsapp.server";
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
- FORMATARE WhatsApp: pentru bold folosește UN SINGUR asterisc (*text*), pentru italic UN SINGUR underscore (_text_). NU folosi NICIODATĂ **text** (markdown) — pe WhatsApp apar stelele vizibile. Nu folosi tabele markdown sau headinguri (#). Pentru liste folosește „•" sau „- ".

Capacități:
- Poți lista campaniile cu \`list_campaigns\`.
- Poți vedea metrici (spend, lead-uri, CPL) cu \`get_insights\`.
- Poți porni/opri/pune pe pauză campanii (\`pause_campaign\`, \`resume_campaign\`).
- Poți modifica bugetul zilnic (\`update_budget\`).
- Poți genera copy nou (headline + text + CTA) cu \`generate_copy\` — folosește emoji-uri și subtexte clare.
- Poți crea o campanie complet nouă cu \`create_campaign\` — necesită o imagine trimisă de user pe WhatsApp + buget + descrierea ofertei. Confirmă mereu cu user-ul DETALIILE (nume, buget, copy) înainte să apelezi tool-ul.
- Poți reîncerca publicarea ultimului draft eșuat cu \`retry_last_campaign\` când userul spune „încearcă iar”.
- Poți lista lead-urile recente cu \`list_recent_leads\`.

IMPORTANT despre lead-uri (datele de contact):
- Userul cu care vorbești pe WhatsApp ESTE PROPRIETARUL contului și al lead-urilor. Lead-urile îi aparțin lui — au fost generate de campaniile lui Meta plătite din banii lui.
- Când îți cere „cine a completat", „trimite-mi clientul", „dă-mi numărul/emailul leadului" etc. — apelează \`list_recent_leads\` și trimite-i DIRECT pe WhatsApp numele, telefonul, emailul și mesajul. Este complet legal și conform GDPR (e operatorul de date, nu o terță parte).
- NU refuza niciodată pe motiv de „confidențialitate", „GDPR", „politici Meta" sau „nu pot partaja date personale". E GREȘIT — datele sunt ale lui.
- NU-l trimite la Facebook Business Suite / „Formulare instant" / „Lead Ads" ca să-și caute singur lead-urile. Tu i le dai aici, pe WhatsApp, instant.
- Format recomandat când livrezi un lead: „👤 *Nume* — 📞 telefon — ✉️ email — 💬 mesaj (dacă există)".

Reguli importante:
- Pentru acțiuni care schimbă bani (create_campaign, update_budget cu modificare >50%) — cere mereu confirmare scurtă ("Confirmi? Da/Nu") ÎNAINTE să apelezi tool-ul.
- Pentru pause/resume — execută direct, apoi confirmă într-o linie.
- Dacă userul îți trimite o poză fără context, întreabă-l ce vrea să facă cu ea (campanie nouă? doar copy?).
- Când generezi copy, oferă 2-3 variante scurte din care să aleagă.
- Dacă userul cere ceva ce nu poți face, spune clar și sugerează o alternativă.
- IMPORTANT pentru creative (poză SAU video): folosește DOAR fișiere trimise direct pe WhatsApp (vor apărea în „media disponibilă" din context). Acceptăm imagine (JPG/PNG) sau video (MP4/MOV — max ~100MB, 9:16/1:1/16:9). NU cere URL-uri externe și NU accepta link-uri spre site-uri (Pixabay, YouTube, etc.) — sistemul nu le poate descărca. Dacă userul nu a trimis nimic, cere-i clar: „Trimite-mi te rog poza SAU clipul pentru reclamă direct aici pe WhatsApp 📸🎬".
- Dacă pentru create_campaign nu există media disponibilă (latestMedia lipsește), NU apela tool-ul — întâi cere fișierul. Media din ultimele 24h rămâne disponibilă pentru confirmări ulterioare.
- NU cere niciodată userului URL-ul site-ului (landing_url). Pentru campanii Lead Generation formularul se completează direct pe Facebook/Instagram, nu e nevoie de site extern. Lasă landing_url gol și sistemul va folosi automat un URL valid implicit.
- ATENȚIE LOCAȚIE: dacă userul menționează un oraș (ex: „pe București", „în Cluj", „target Timișoara") — FOLOSEȘTE parametrul "cities" la create_campaign cu numele orașului (ex: ["Bucharest"]). NU lăsa doar countries=["RO"] când userul a cerut explicit un oraș. Confirmă în mesajul de confirmare locația exactă (oraș + rază km).
- NU anunța NICIODATĂ în avans că „lansezi acum" / „durează câteva secunde" / „stai puțin" înainte să apelezi un tool. Apelează direct tool-ul și trimite UN SINGUR mesaj DUPĂ ce primești rezultatul: dacă ok → confirmă LIVE cu detalii; dacă error → spune-i userului EXACT motivul (mesajul din câmpul "error" returnat de tool, tradus simplu în română, fără termeni tehnici) și sugerează ce poate face (ex: schimbă bugetul, alt oraș, reconectează contul Meta).
- NICIODATĂ nu spune „echipa tehnică a fost notificată" — nu există echipă tehnică în spate, ești TU agentul. Dacă ceva eșuează, arată motivul real returnat de sistem.
- Dacă userul spune „încearcă iar / mai încearcă / retry” după o lansare eșuată, apelează \`retry_last_campaign\` direct. Nu inventa explicații și nu spune că nu poți încerca.

FLOW OBLIGATORIU pentru CAMPANII NOI (înainte să apelezi create_campaign):
1. Întreabă userul ce vrea să obțină din reclamă:
   a) „Clienți potențiali" (lead form direct pe Facebook/Instagram — userul nu părăsește app-ul) → objective="leads"
   b) „Trafic pe site" (trimite oamenii pe website-ul lui) → objective="traffic" (în acest caz cere URL-ul site-ului)
2. Dacă a ales „clienți potențiali", întreabă-l dacă vrea să afle DOAR nume + telefon SAU și alte informații (ex: oraș, serviciu dorit, buget, dată preferată).
3. Dacă vrea informații suplimentare, întreabă-l CONCRET ce vrea să afle. Pentru fiecare info propune userului dacă e mai bine cu „răspuns scurt" (user tastează) sau „grilă" (user alege dintr-o listă de opțiuni). Sugerează tu opțiunile când e logic (ex: pentru „serviciu" propune lista de servicii din contextul lui).
4. Înainte să trimiți întrebările la Meta, REFORMULEAZĂ-le frumos și fără greșeli gramaticale, scurte (max 90 caractere fiecare), clare, profesioniste. Userul nu trebuie să vadă întrebări brute cu typos.
5. Confirmă cu userul lista finală de întrebări (1 mesaj scurt cu bullet-uri) și abia apoi apelează create_campaign cu "custom_questions".

Reguli pentru întrebări custom:
- Max 8 întrebări per formular (limita practică Meta).
- Întrebare scurtă: { label: "...", type: "short" }.
- Întrebare grilă (multiple choice): { label: "...", type: "choice", options: ["Opțiunea 1", "Opțiunea 2", ...] } — max 6 opțiuni, fiecare max 60 caractere.
- NU pune întrebări lungi (peste 90 caractere) — Meta le respinge sau apar urât în formular.`;

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

  if (isRetryPublishRequest(userMessage)) {
    const retry = await retryLastDraftCampaign(supabaseAdmin, ctx);
    const text = "error" in retry
      ? `Nu a mers încă. Motivul real: ${retry.error}`
      : "Gata — campania este LIVE acum ✅";
    await sendChunked(ctx, text);
    return { text };
  }

  // Pull pending anomaly action proposed in last outbound message, if any.
  const { data: lastOut } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("meta, created_at")
    .eq("user_id", ctx.userId)
    .eq("direction", "out")
    .not("meta", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pendingAction =
    lastOut?.meta && (lastOut.meta as any).anomaly_action
      ? (lastOut.meta as any).anomaly_action
      : null;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content:
        SYSTEM_PROMPT +
        mediaHint(ctx) +
        (pendingAction
          ? `\n\n[Acțiune sugerată în așteptare] ${JSON.stringify(pendingAction)}. Dacă userul răspunde afirmativ (da/ok/yes/rezolvă/fă), execută-o direct prin tool-ul corespunzător (pause_campaign pentru kind=pause, generate_copy pentru regen_copy, generate_image+create_campaign sau update creative pentru regen_image) și confirmă scurt. Dacă userul refuză, lasă-o.`
          : ""),
    },
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
    return "\n\n[Context media] Nu există nicio fotografie sau clip disponibil. Dacă userul vrea o campanie nouă, cere-i să trimită direct pe WhatsApp o poză sau un clip video.";
  }
  const kind = ctx.latestMedia.mime.toLowerCase().startsWith("video/") ? "VIDEO" : "imagine";
  return `\n\n[Context media] Userul a trimis un ${kind} (${ctx.latestMedia.mime}) — disponibil pentru create_campaign. NU cere URL, folosește direct tool-ul. Procesarea video la Meta durează ~30-60s — anunță userul să aștepte.`;
}

async function sendChunked(ctx: AgentCtx, text: string) {
  const CHUNK = 3500;
  // WhatsApp folosește *bold* / _italic_, NU markdown **bold**. Convertim înainte de trimitere.
  const normalized = text
    .replace(/\*\*\*(.+?)\*\*\*/g, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_");
  for (let i = 0; i < normalized.length; i += CHUNK) {
    const part = normalized.slice(i, i + CHUNK);
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
          "Creează și lansează o campanie Meta completă (Lead Generation SAU Traffic). Necesită imagine (latestMedia). Cere mereu CONFIRMAREA user-ului înainte să apelezi (inclusiv obiectiv, locație, întrebări).",
      inputSchema: z.object({
        name: z.string().max(80),
        daily_budget: z.number().positive().describe("Buget zilnic în RON/valuta cont"),
          objective: z
            .enum(["leads", "traffic"])
            .default("leads")
            .describe("'leads' = formular pe Facebook/IG, 'traffic' = trimite pe site (necesită landing_url)"),
        headline: z.string().max(40),
        primary_text: z.string().max(500),
        description: z.string().max(50).optional(),
        cta: z.enum(["Learn More", "Sign Up", "Shop Now", "Book Now", "Apply Now"]).default("Learn More"),
          landing_url: z
            .string()
            .url()
            .optional()
            .describe("Obligatoriu doar pentru objective='traffic'. Pentru 'leads' lasă gol."),
          custom_questions: z
            .array(
              z.object({
                label: z.string().max(90),
                type: z.enum(["short", "choice"]).default("short"),
                options: z.array(z.string().max(60)).max(6).optional(),
              }),
            )
            .max(8)
            .optional()
            .describe("Întrebări extra în formular peste nume+telefon. Doar pentru objective='leads'."),
        countries: z.array(z.string()).default(["RO"]).describe("Coduri ISO 2-litere, ex ['RO']"),
          cities: z
            .array(z.string())
            .optional()
            .describe(
              "Nume orașe pentru targetare locală (ex ['Bucharest','Cluj-Napoca']). Folosește în engleză sau română — sistemul caută cheia oficială Meta. Dacă e setat, countries e ignorat.",
            ),
          city_radius_km: z.number().int().min(10).max(80).default(25).describe("Raza în km în jurul orașelor"),
        age_min: z.number().int().min(13).max(65).default(18),
        age_max: z.number().int().min(13).max(65).default(65),
      }),
      execute: async (args) => {
        if (!ctx.latestMedia) {
          return { error: "Userul nu a trimis imagine. Cere-i să trimită o poză pentru reclamă." };
        }
          if (args.objective === "traffic" && (!args.landing_url || !/^https?:\/\//i.test(args.landing_url))) {
            return { error: "Pentru objective='traffic' ai nevoie de landing_url valid (https://...). Cere-l userului." };
          }
        return await createMetaCampaignFromAgent(supabaseAdmin, ctx, args);
      },
    }),

    generate_image: tool({
      description:
        "Generează o imagine pentru reclamă cu AI (1024x1024 JPG). Folosește când userul nu are poză. După generare, imaginea devine 'latestMedia' și poate fi folosită direct la create_campaign.",
      inputSchema: z.object({
        prompt: z.string().min(10).max(600).describe("Descriere detaliată a imaginii dorite, în engleză sau română"),
      }),
      execute: async ({ prompt }) => {
        try {
          const { generateCreativeImage } = await import("./wa-ai-extras.server");
          const img = await generateCreativeImage(ctx.userId, prompt);
          ctx.latestMedia = img;
          // Send preview to user on WhatsApp
          try {
            const r = await fetch(img.signedUrl);
            const bytes = new Uint8Array(await r.arrayBuffer());
            const mediaId = await uploadWhatsAppMedia(
              ctx.connection.phone_number_id,
              ctx.connection.access_token,
              bytes,
              "image/jpeg",
              "ad.jpg",
            );
            await sendWhatsAppMessage(
              ctx.connection.phone_number_id,
              ctx.connection.access_token,
              ctx.toPhone,
              { type: "image", mediaId, caption: "🎨 Iată o variantă. Vrei să o folosim?" },
            );
          } catch (e) {
            console.error("[generate_image] preview send", e);
          }
          return { ok: true, message: "Imagine generată și disponibilă pentru create_campaign." };
        } catch (e: any) {
          return { error: e?.message ?? "Generarea imaginii a eșuat" };
        }
      },
    }),

    duplicate_campaign: tool({
      description: "Duplică o campanie existentă (același target/buget). Opțional cu copy nou. Rezultatul e PAUSED ca să-l confirme userul.",
      inputSchema: z.object({
        campaign_id: z.string(),
        new_name: z.string().optional(),
        new_headline: z.string().max(40).optional(),
        new_primary_text: z.string().max(500).optional(),
      }),
      execute: async ({ campaign_id, new_name, new_headline, new_primary_text }) => {
        const camp = await getCampaign(supabaseAdmin, ctx.userId, campaign_id);
        if (!camp?.meta_campaign_id || !camp.meta_adset_id || !camp.meta_ad_id)
          return { error: "Campania nu e publicată complet pe Meta." };
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Fără Meta" };
        const { data: adAcc } = await supabaseAdmin
          .from("meta_ad_accounts").select("ad_account_id")
          .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle();
        const { data: page } = await supabaseAdmin
          .from("meta_pages").select("page_id")
          .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle();
        if (!adAcc?.ad_account_id || !page?.page_id) return { error: "Lipsesc ad account/page." };
        const { duplicateCampaign } = await import("./meta-ops.server");
        try {
          const res = await duplicateCampaign({
            adAccountId: adAcc.ad_account_id,
            accessToken: token,
            sourceMetaCampaignId: camp.meta_campaign_id,
            sourceMetaAdsetId: camp.meta_adset_id,
            sourceMetaAdId: camp.meta_ad_id,
            pageId: page.page_id,
            newName: new_name || `${camp.name} (copie)`,
            newCopy: { headline: new_headline, primary_text: new_primary_text },
          });
          await supabaseAdmin.from("campaigns").insert({
            user_id: ctx.userId, name: new_name || `${camp.name} (copie)`,
            platform: "meta", objective: camp.objective, status: "paused",
            budget: camp.budget, budget_mode: camp.budget_mode,
            targeting: camp.targeting, creative: camp.creative, lead_form: camp.lead_form,
            meta_campaign_id: res.campaign_id, meta_adset_id: res.adset_id,
            meta_ad_id: res.ad_id, meta_lead_form_id: res.lead_form_id,
          });
          return { ok: true, message: "Campanie duplicată pe PAUSED. Pornește-o când vrei.", ...res };
        } catch (e: any) {
          return { error: e?.message ?? "Duplicare eșuată" };
        }
      },
    }),

    change_targeting: tool({
      description: "Modifică targeting-ul (vârstă, oraș, gen) pe o campanie EXISTENTĂ — fără să o refaci.",
      inputSchema: z.object({
        campaign_id: z.string(),
        age_min: z.number().int().min(13).max(65).optional(),
        age_max: z.number().int().min(13).max(65).optional(),
        cities: z.array(z.string()).optional(),
        city_radius_km: z.number().int().min(10).max(80).default(25),
        countries: z.array(z.string()).optional(),
        genders: z.enum(["all", "male", "female"]).optional(),
      }),
      execute: async (args) => {
        const camp = await getCampaign(supabaseAdmin, ctx.userId, args.campaign_id);
        if (!camp?.meta_adset_id) return { error: "Adset Meta lipsă." };
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Fără Meta" };
        const { patchAdSetTargeting, findCityKey } = await import("./meta-ops.server");
        const cityKeys: Array<{ key: string; radius?: number }> = [];
        if (args.cities?.length) {
          for (const name of args.cities) {
            const hit = await findCityKey(token, name, (args.countries?.[0] ?? "RO").toUpperCase());
            if (hit) cityKeys.push({ key: hit.key, radius: args.city_radius_km });
          }
        }
        const genders = args.genders === "male" ? [1] : args.genders === "female" ? [2] : args.genders === "all" ? [] : undefined;
        try {
          await patchAdSetTargeting(camp.meta_adset_id, token, {
            age_min: args.age_min, age_max: args.age_max,
            cities: cityKeys.length ? cityKeys : undefined,
            countries: !cityKeys.length ? args.countries : undefined,
            genders,
          });
          return { ok: true, message: "Targeting actualizat ✅" };
        } catch (e: any) {
          return { error: e?.message ?? "Update targeting eșuat" };
        }
      },
    }),

    blacklist_placement: tool({
      description: "Scoate o categorie de plasare (audience_network, messenger, stories, reels, right_column).",
      inputSchema: z.object({
        campaign_id: z.string(),
        exclude: z.array(z.enum(["audience_network", "messenger", "stories", "reels", "right_column"])).min(1),
      }),
      execute: async ({ campaign_id, exclude }) => {
        const camp = await getCampaign(supabaseAdmin, ctx.userId, campaign_id);
        if (!camp?.meta_adset_id) return { error: "Adset Meta lipsă." };
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Fără Meta" };
        const { blacklistPlacement } = await import("./meta-ops.server");
        try {
          await blacklistPlacement(camp.meta_adset_id, token, exclude);
          return { ok: true, message: `Am scos: ${exclude.join(", ")} ✅` };
        } catch (e: any) {
          return { error: e?.message ?? "Update placement eșuat" };
        }
      },
    }),

    ab_test_creative: tool({
      description: "Adaugă un al doilea ad (variantă B) în adset-ul existent folosind ULTIMA imagine/video trimisă pe WhatsApp. Userul trebuie să fi trimis deja varianta B.",
      inputSchema: z.object({
        campaign_id: z.string(),
        new_headline: z.string().max(40).optional(),
        new_primary_text: z.string().max(500).optional(),
      }),
      execute: async ({ campaign_id, new_headline, new_primary_text }) => {
        if (!ctx.latestMedia) return { error: "Trimite varianta B (poză sau clip) pe WhatsApp întâi." };
        const camp = await getCampaign(supabaseAdmin, ctx.userId, campaign_id);
        if (!camp?.meta_adset_id) return { error: "Adset Meta lipsă." };
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Fără Meta" };
        const { data: adAcc } = await supabaseAdmin
          .from("meta_ad_accounts").select("ad_account_id")
          .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle();
        const { data: page } = await supabaseAdmin
          .from("meta_pages").select("page_id")
          .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle();
        if (!adAcc?.ad_account_id || !page?.page_id) return { error: "Lipsesc ad account/page." };
        try {
          const { data: file } = await supabaseAdmin.storage.from("wa-media").download(ctx.latestMedia.path);
          if (!file) return { error: "Nu pot citi media variantei B." };
          const bytes = new Uint8Array(await file.arrayBuffer());
          const isVideo = ctx.latestMedia.mime.toLowerCase().startsWith("video/");
          const { uploadAdImageFromBytes, uploadAdVideoFromBytes, createAbTestAd } = await import("./meta-ops.server");
          let image_hash: string | undefined;
          let video_id: string | undefined;
          let thumbnail_url: string | null | undefined;
          if (isVideo) {
            const v = await uploadAdVideoFromBytes(adAcc.ad_account_id, token, bytes, "ad_b.mp4", ctx.latestMedia.mime);
            video_id = v.video_id; thumbnail_url = v.thumbnail_url;
          } else {
            image_hash = await uploadAdImageFromBytes(adAcc.ad_account_id, token, bytes, "ad_b.jpg", ctx.latestMedia.mime);
          }
          const creative = (camp.creative ?? {}) as any;
          const res = await createAbTestAd({
            adAccountId: adAcc.ad_account_id, accessToken: token, pageId: page.page_id,
            adsetId: camp.meta_adset_id,
            headline: new_headline || creative.headline || camp.name,
            primary_text: new_primary_text || creative.primary_text || "",
            cta: creative.cta || "Learn More",
            landing_url: creative.landing_url || "https://adpilot.ro",
            image_hash, video_id, thumbnail_url,
            lead_gen_form_id: camp.meta_lead_form_id ?? null,
            variant: "B",
          });
          return { ok: true, message: "Variant B lansat ✅ în aceeași campanie.", ...res };
        } catch (e: any) {
          return { error: e?.message ?? "A/B test eșuat" };
        }
      },
    }),

    reply_to_lead: tool({
      description: "Trimite un mesaj WhatsApp către un lead (folosind numărul lui). Fereastra Meta de 24h se aplică — dacă leadul nu a scris recent, mesajul poate fi blocat.",
      inputSchema: z.object({
        lead_id: z.string(),
        text: z.string().min(1).max(900),
      }),
      execute: async ({ lead_id, text }) => {
        const { data: lead } = await supabaseAdmin
          .from("leads").select("phone, full_name, created_at")
          .eq("id", lead_id).eq("user_id", ctx.userId).maybeSingle();
        if (!lead?.phone) return { error: "Lead-ul nu are telefon." };
        const ageH = (Date.now() - new Date(lead.created_at).getTime()) / 3_600_000;
        if (ageH > 24) {
          return { error: "Au trecut peste 24h de la lead — Meta nu permite primul mesaj fără template aprobat." };
        }
        try {
          const phone = lead.phone.replace(/\D/g, "");
          await sendWhatsAppMessage(ctx.connection.phone_number_id, ctx.connection.access_token, phone, { type: "text", text });
          return { ok: true, message: `Mesaj trimis lui ${lead.full_name ?? phone} ✅` };
        } catch (e: any) {
          return { error: e?.message ?? "Trimitere eșuată" };
        }
      },
    }),

    get_invoice: tool({
      description: "Listează facturile Meta din ultima lună (sau N luni).",
      inputSchema: z.object({ months: z.number().int().min(1).max(6).default(1) }),
      execute: async ({ months }) => {
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Fără Meta" };
        const { data: adAcc } = await supabaseAdmin
          .from("meta_ad_accounts").select("ad_account_id")
          .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle();
        if (!adAcc?.ad_account_id) return { error: "Fără ad account" };
        const { getMetaInvoices } = await import("./meta-ops.server");
        try {
          return await getMetaInvoices(adAcc.ad_account_id, token, months);
        } catch (e: any) {
          return { error: e?.message ?? "Nu am putut citi facturile" };
        }
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

function isRetryPublishRequest(message: string): boolean {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(incearca|reincearca|retry)\b/.test(normalized) && /\b(iar|din nou|inca o data|retry)?\b/.test(normalized);
}

async function retryLastDraftCampaign(supabaseAdmin: any, ctx: AgentCtx) {
  if (!ctx.latestMedia) return { error: "Nu mai găsesc poza/clipul pentru reclamă. Trimite media încă o dată pe WhatsApp." };
  const { data: draft } = await supabaseAdmin
    .from("campaigns")
    .select("id, name, objective, budget, targeting, creative, lead_form")
    .eq("user_id", ctx.userId)
    .eq("platform", "meta")
    .eq("status", "draft")
    .is("meta_campaign_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) return { error: "Nu am găsit o campanie eșuată recentă pe care să o reîncerc." };

  const creative = (draft.creative ?? {}) as any;
  const leadForm = (draft.lead_form ?? {}) as any;
  const targeting = (draft.targeting ?? {}) as any;
  const age = String(targeting.age_groups?.[0] ?? "18-65").match(/(\d+)\D+(\d+)/);
  const locations = Array.isArray(targeting.locations) ? targeting.locations : ["RO"];
  const countries = locations.filter((l: string) => /^[A-Z]{2}$/.test(l));
  const cities = locations.filter((l: string) => !/^[A-Z]{2}$/.test(l));
  const { data: file, error: dlErr } = await supabaseAdmin.storage.from("wa-media").download(ctx.latestMedia.path);
  if (dlErr || !file) return { error: `Nu pot citi poza/clipul: ${dlErr?.message ?? "fișier lipsă"}` };

  const conn = await getActiveMetaSetup(supabaseAdmin, ctx.userId);
  if ("error" in conn) return conn;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const args = {
    name: draft.name,
    daily_budget: Number(draft.budget),
    objective: draft.objective === "LINK_CLICKS" ? "traffic" as const : "leads" as const,
    headline: String(creative.headline ?? draft.name).slice(0, 40),
    primary_text: String(creative.primary_text ?? creative.description ?? ""),
    description: String(creative.description ?? ""),
    cta: creative.cta ?? "Learn More",
    landing_url: creative.landing_url ?? "https://adpilot.ro",
    custom_questions: leadForm.custom_questions ?? [],
    countries: countries.length ? countries : ["RO"],
    cities: cities.length ? cities : undefined,
    age_min: age ? Number(age[1]) : 18,
    age_max: age ? Number(age[2]) : 65,
  };

  const cityKeys = await resolveCityKeys(conn.accessToken, args.cities, args.countries, 25);
  if (args.cities?.length && !cityKeys.length) return { error: `Nu am găsit orașele cerute (${args.cities.join(", ")}) în Meta.` };
  return publishCampaignToMeta(supabaseAdmin, {
    campaignRowId: draft.id,
    adAccountId: conn.adAccountId,
    accessToken: conn.accessToken,
    pageId: conn.pageId,
    pageAccessToken: conn.pageAccessToken,
    bytes,
    mediaMime: ctx.latestMedia.mime,
    args,
    objective: args.objective,
    cityKeys,
  });
}

async function getActiveMetaSetup(supabaseAdmin: any, userId: string) {
  const { data: conn } = await supabaseAdmin
    .from("meta_connections")
    .select("id, access_token")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!conn?.access_token) return { error: "Conectează Meta din Settings înainte." };

  const { data: adAcc } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("ad_account_id")
    .eq("user_id", userId)
    .eq("connection_id", conn.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!adAcc?.ad_account_id) return { error: "Selectează un ad account din Settings." };

  const { data: page } = await supabaseAdmin
    .from("meta_pages")
    .select("page_id, page_access_token")
    .eq("user_id", userId)
    .eq("connection_id", conn.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!page?.page_id || !page.page_access_token) return { error: "Conectează o Pagină în Settings." };

  return {
    accessToken: conn.access_token as string,
    adAccountId: adAcc.ad_account_id as string,
    pageId: page.page_id as string,
    pageAccessToken: page.page_access_token as string,
  };
}

async function resolveCityKeys(accessToken: string, cities: string[] | undefined, countries: string[], radius: number) {
  const { findCityKey } = await import("./meta-publish.server");
  const cityKeys: Array<{ key: string; radius?: number }> = [];
  if (!cities?.length) return cityKeys;
  const country = (countries?.[0] ?? "RO").toUpperCase();
  for (const cityName of cities) {
    const hit = await findCityKey(accessToken, cityName, country);
    if (hit) cityKeys.push({ key: hit.key, radius });
  }
  return cityKeys;
}

async function publishCampaignToMeta(
  supabaseAdmin: any,
  input: {
    campaignRowId: string;
    adAccountId: string;
    accessToken: string;
    pageId: string;
    pageAccessToken: string;
    bytes: Uint8Array;
    mediaMime: string;
    args: {
      name: string;
      daily_budget: number;
      headline: string;
      primary_text: string;
      description?: string;
      cta: string;
      landing_url?: string;
      custom_questions?: Array<{ label: string; type?: "short" | "choice"; options?: string[] }>;
      countries: string[];
      age_min: number;
      age_max: number;
    };
    objective: "leads" | "traffic";
    cityKeys: Array<{ key: string; radius?: number }>;
  },
) {
  const { createLeadForm, uploadAdImageFromBytes, createCampaign, createAdSet, createAdCreative, createAd } =
    await import("./meta-publish.server");

  try {
    let form: { id: string } | null = null;
    if (input.objective === "leads") {
      form = await createLeadForm(input.pageId, input.pageAccessToken, {
        name: input.args.name,
        fields: ["Name", "Phone"],
        privacy_url: "https://adpilot.ro/privacy-policy",
        custom_questions: input.args.custom_questions,
      });
      await supabaseAdmin.from("campaigns").update({ meta_lead_form_id: form?.id ?? null }).eq("id", input.campaignRowId);
    }
    const metaCamp = await createCampaign(
      input.adAccountId,
      input.accessToken,
      input.args.name,
      "ACTIVE",
      input.objective === "traffic" ? "OUTCOME_TRAFFIC" : "OUTCOME_LEADS",
    );
    await supabaseAdmin.from("campaigns").update({ meta_campaign_id: metaCamp.id }).eq("id", input.campaignRowId);
    const adset = await createAdSet(input.adAccountId, input.accessToken, {
      name: `${input.args.name} — AdSet`,
      campaign_id: metaCamp.id,
      daily_budget_cents: Math.round(input.args.daily_budget * 100),
      page_id: input.pageId,
      targeting: {
        countries: input.args.countries,
        age_min: input.args.age_min,
        age_max: input.args.age_max,
        cities: input.cityKeys.length ? input.cityKeys : undefined,
      },
      status: "ACTIVE",
      objective: input.objective,
    });
    await supabaseAdmin.from("campaigns").update({ meta_adset_id: adset.id }).eq("id", input.campaignRowId);
    const isVideo = (input.mediaMime || "").toLowerCase().startsWith("video/");
    let image_hash: string | undefined;
    let video_id: string | undefined;
    let thumbnail_url: string | null | undefined;
    if (isVideo) {
      const { uploadAdVideoFromBytes } = await import("./meta-publish.server");
      const ext = (input.mediaMime.split("/")[1] || "mp4").split(";")[0];
      const v = await uploadAdVideoFromBytes(input.adAccountId, input.accessToken, input.bytes, `ad.${ext}`, input.mediaMime || "video/mp4");
      video_id = v.video_id;
      thumbnail_url = v.thumbnail_url;
    } else {
      image_hash = await uploadAdImageFromBytes(input.adAccountId, input.accessToken, input.bytes, "ad.jpg", input.mediaMime || "image/jpeg");
    }
    const adCreative = await createAdCreative(input.adAccountId, input.accessToken, {
      name: `${input.args.name} — Creative`,
      page_id: input.pageId,
      image_hash,
      video_id,
      thumbnail_url,
      headline: input.args.headline,
      description: input.args.primary_text,
      cta: input.args.cta,
      landing_url: input.args.landing_url ?? "https://adpilot.ro",
      lead_gen_form_id: form?.id,
    });
    const ad = await createAd(input.adAccountId, input.accessToken, {
      name: `${input.args.name} — Ad`,
      adset_id: adset.id,
      creative_id: adCreative.id,
      status: "ACTIVE",
    });
    await supabaseAdmin.from("campaigns").update({ meta_ad_id: ad.id }).eq("id", input.campaignRowId);
    await supabaseAdmin
      .from("campaigns")
      .update({
        meta_campaign_id: metaCamp.id,
        meta_adset_id: adset.id,
        meta_ad_id: ad.id,
        meta_lead_form_id: form?.id ?? null,
        status: "active",
      })
      .eq("id", input.campaignRowId);
    return {
      ok: true,
      campaign_id: input.campaignRowId,
      meta_campaign_id: metaCamp.id,
      message: input.objective === "traffic" ? "Campanie LIVE (trafic pe site) ✅" : "Campanie LIVE (lead form) ✅",
    };
  } catch (e: any) {
    const msg = e?.message ?? "Publish failed";
    console.error("[wa-agent] create_campaign publish failed:", msg, e);
    return { error: msg };
  }
}

async function createMetaCampaignFromAgent(
  supabaseAdmin: any,
  ctx: AgentCtx,
  args: {
    name: string;
    daily_budget: number;
    objective?: "leads" | "traffic";
    headline: string;
    primary_text: string;
    description?: string;
    cta: string;
    landing_url?: string;
    custom_questions?: Array<{ label: string; type?: "short" | "choice"; options?: string[] }>;
    countries: string[];
    cities?: string[];
    city_radius_km?: number;
    age_min: number;
    age_max: number;
  },
) {
  const objective: "leads" | "traffic" = args.objective ?? "leads";
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

  // Resolve city names → Meta city keys (if any)
  const { findCityKey } = await import("./meta-publish.server");
  const cityKeys: Array<{ key: string; radius?: number }> = [];
  const resolvedCityNames: string[] = [];
  if (args.cities && args.cities.length) {
    const country = (args.countries?.[0] ?? "RO").toUpperCase();
    for (const cityName of args.cities) {
      const hit = await findCityKey(conn.access_token, cityName, country);
      if (hit) {
        cityKeys.push({ key: hit.key, radius: args.city_radius_km ?? 25 });
        resolvedCityNames.push(hit.name);
      }
    }
    if (!cityKeys.length) {
      return { error: `Nu am găsit orașele cerute (${args.cities.join(", ")}) în Meta. Verifică numele.` };
    }
  }

  // Insert campaign row first
  const { data: campRow, error: insErr } = await supabaseAdmin
    .from("campaigns")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      platform: "meta",
      objective: objective === "traffic" ? "LINK_CLICKS" : "LEAD_GENERATION",
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
      lead_form:
        objective === "leads"
          ? {
              title: args.name,
              fields: ["Name", "Phone"],
              custom_questions: args.custom_questions ?? [],
            }
          : null,
      targeting: {
        locations: resolvedCityNames.length ? resolvedCityNames : args.countries,
        age_groups: [`${args.age_min}-${args.age_max}`],
        genders: ["All"],
      },
    })
    .select("id")
    .single();
  if (insErr || !campRow) return { error: insErr?.message || "Nu pot crea campania în DB" };

  return publishCampaignToMeta(supabaseAdmin, {
    campaignRowId: campRow.id,
    adAccountId: adAcc.ad_account_id,
    accessToken: conn.access_token,
    pageId: page.page_id,
    pageAccessToken: page.page_access_token,
    bytes,
    mediaMime: ctx.latestMedia!.mime,
    args,
    objective,
    cityKeys,
  });
}