/**
 * WhatsApp AI agent: Claude (tool-calling) to control Meta campaigns from WhatsApp.
 * Server-only. Invoked from the WA webhook (no user JWT — we pass user_id explicitly).
 */
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { sendWhatsAppMessage, uploadWhatsAppMedia } from "./whatsapp.server";
import { metaApiVersion } from "./meta.server";
import { setMetaCampaignStatus } from "./campaign-control.server";
import { WA_AGENT_SYSTEM_PROMPT, WA_COPYWRITER_SYSTEM } from "./wa-agent-prompt.server";
import {
  budgetLearningWarning,
  classifyPublishError,
  creativeCountForBudget,
  normalizeCreatives,
  objectiveFromDraft,
  suggestNicheFormQuestions,
  type AgentPublishSnapshot,
  type CreativeVariant,
} from "./wa-campaign-strategy.server";

const GRAPH = "https://graph.facebook.com";

// Backstop server-side pentru tool-urile care cheltuie bani. Nu depinde de LLM:
// oricât ar greși modelul (ex. "setează bugetul la 100000"), aici se oprește.
// Peste plafon, userul trebuie să seteze bugetul din aplicație, nu din chat.
const MIN_AGENT_DAILY_BUDGET_RON = 5;
const MAX_AGENT_DAILY_BUDGET_RON = 1000;

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

const SYSTEM_PROMPT = WA_AGENT_SYSTEM_PROMPT;

export async function runWhatsAppAgent(
  ctx: AgentCtx,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { chatModel } = await import("./llm.server");
  const model = chatModel();

  const tools = buildTools(ctx, supabaseAdmin);

  if (isRetryPublishRequest(userMessage) && shouldRetryPublishFromHistory(history, userMessage)) {
    const retry = await retryLastDraftCampaign(supabaseAdmin, ctx);
    const text = "error" in retry
      ? formatPublishErrorForWhatsApp(retry.error)
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

  const dynamicHint =
    mediaHint(ctx) +
    (pendingAction
      ? `\n\n[Acțiune sugerată în așteptare] ${JSON.stringify(pendingAction)}. Dacă userul răspunde afirmativ (da/ok/yes/rezolvă/fă), execută-o direct prin tool-ul corespunzător (pause_campaign pentru kind=pause, generate_copy pentru regen_copy, generate_image+create_campaign sau update creative pentru regen_image) și confirmă scurt. Dacă userul refuză, lasă-o.`
      : "");

  const messages: ModelMessage[] = [
    // Prefix STATIC (toolurile se randează înainte de system, deci breakpoint-ul
    // de pe system cache-uiește tool-urile + system-ul împreună — ~6k tokeni).
    // Se citesc la ~10% pe pașii următori ai buclei de tool-calling și pe mesajele
    // ulterioare din aceeași conversație (fereastra de cache = 5 min). Taie ~40-50%
    // din costul agentului fără să-i schimbe comportamentul.
    {
      role: "system",
      content: SYSTEM_PROMPT,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    // Partea VOLATILĂ (media curentă, acțiune în așteptare) — după breakpoint,
    // nu se cache-uiește, ca să nu invalideze prefixul static.
    ...(dynamicHint ? [{ role: "system" as const, content: dynamicHint }] : []),
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
        const url = `${GRAPH}/${metaApiVersion()}/${camp.meta_campaign_id}/insights?fields=spend,impressions,clicks,actions,account_currency&date_preset=${datePreset}&access_token=${encodeURIComponent(token)}`;
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok) return { error: j?.error?.message || `Meta ${r.status}` };
        const row = j?.data?.[0] ?? {};
        const leads = Number((row.actions ?? []).find((a: any) => a.action_type === "lead")?.value ?? 0);
        let spend = Number(row.spend ?? 0);
        const curr = String(row.account_currency ?? "RON").toUpperCase();
        if (curr !== "RON" && spend > 0) {
          const { currencyToRon } = await import("@/lib/currency.server");
          spend = await currencyToRon(spend, curr);
        }
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
      execute: async ({ campaign_id }) =>
        setMetaCampaignStatus({ userId: ctx.userId, campaignId: campaign_id, next: "PAUSED" }),
    }),

    resume_campaign: tool({
      description: "Pornește/reactivează o campanie Meta.",
      inputSchema: z.object({ campaign_id: z.string() }),
      execute: async ({ campaign_id }) =>
        setMetaCampaignStatus({ userId: ctx.userId, campaignId: campaign_id, next: "ACTIVE" }),
    }),

    update_budget: tool({
      description: "Modifică bugetul zilnic al unei campanii (în RON sau valuta contului). User trebuie să confirme dacă creșterea e >50%.",
      inputSchema: z.object({
        campaign_id: z.string(),
        new_daily_budget: z.number().positive().describe("Buget zilnic în unități întregi (ex 50 = 50 RON/zi)"),
      }),
      execute: async ({ campaign_id, new_daily_budget }) => {
        if (new_daily_budget < MIN_AGENT_DAILY_BUDGET_RON || new_daily_budget > MAX_AGENT_DAILY_BUDGET_RON) {
          return {
            error: `Bugetul zilnic trebuie să fie între ${MIN_AGENT_DAILY_BUDGET_RON} și ${MAX_AGENT_DAILY_BUDGET_RON} RON. Pentru sume mai mari, setează-l din aplicație (Campanii).`,
          };
        }
        const camp = await getCampaign(supabaseAdmin, ctx.userId, campaign_id);
        if (!camp) return { error: "Campanie negăsită" };
        if (!camp.meta_adset_id) return { error: "AdSet Meta lipsă" };
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Fără conexiune Meta" };
        // Buget în lei → valuta contului (ex. USD/EUR), altfel Meta interpretează
        // cifra în valuta contului (50 lei ar deveni $50).
        const { ronBudgetToAccountCents } = await import("@/lib/currency.server");
        const conv = await ronBudgetToAccountCents(new_daily_budget, (camp as any).ad_account_id, token);
        const r = await fetch(`${GRAPH}/${metaApiVersion()}/${camp.meta_adset_id}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: `daily_budget=${conv.cents}&access_token=${encodeURIComponent(token)}`,
        });
        const j = await r.json();
        if (!r.ok) return { error: j?.error?.message || `Meta ${r.status}` };
        await supabaseAdmin.from("campaigns").update({ budget: new_daily_budget }).eq("id", campaign_id);
        return { ok: true, new_daily_budget, ...(conv.note ? { note: conv.note } : {}) };
      },
    }),

    generate_copy: tool({
      description:
        "Generează 3 variante de copy pe unghiuri DISTINCTE (durere / beneficiu / social proof): headline (max 40), primary text, description (max 30), CTA. Folosește pentru orice nișă — trimite un brief complet (afacere, ofertă, oraș, obiectiv).",
      inputSchema: z.object({
        product_description: z
          .string()
          .describe(
            "Brief complet: tip afacere, ce promovează, ofertă, oraș/zonă, obiectiv (leads/sales/calls/traffic/signups), ton dorit, dovezi dacă există.",
          ),
        tone: z.enum(["profesionist", "casual", "urgent", "premium"]).default("casual"),
        language: z.string().default("ro"),
        objective: z
          .enum(["leads", "sales", "calls", "traffic", "signups"])
          .optional()
          .describe("Obiectivul campaniei — influențează CTA și unghiul."),
        business_type: z
          .string()
          .max(80)
          .optional()
          .describe("Categorie afacere (ex: cabinet stomatologic, salon, ecom)."),
      }),
      execute: async ({ product_description, tone, language, objective, business_type }) => {
        const { chatModel } = await import("./llm.server");
        const brief = [
          product_description,
          business_type ? `Tip afacere: ${business_type}` : "",
          objective ? `Obiectiv Meta: ${objective}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        const sub = await generateText({
          model: chatModel(),
          messages: [
            {
              role: "system",
              content: WA_COPYWRITER_SYSTEM(language, tone),
            },
            { role: "user", content: brief },
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
        "Creează și lansează o campanie Meta (1 ad set + mai multe creative pe unghiuri). Necesită imagine/video (latestMedia). Confirmă mereu cu userul ÎNAINTE (obiectiv, locație, vârstă, buget, copy, formular).",
      inputSchema: z.object({
        name: z.string().max(80),
        daily_budget: z.number().positive().describe("Buget zilnic în RON (comun pe ad set — Meta împarte pe creative)"),
        objective: z
          .enum(["leads", "sales", "calls", "traffic", "signups"])
          .default("leads")
          .describe(
            "'leads' = formular FB/IG · 'sales' = vânzări + Pixel · 'signups' = înscrieri CompleteRegistration · 'calls' = Sună acum · 'traffic' = vizite site",
          ),
        business_type: z
          .string()
          .max(80)
          .optional()
          .describe("Tip afacere (ex: cabinet stomatologic, salon, ecom) — pentru formular + buget dinamic."),
        headline: z.string().max(40).describe("Headline principal (sau al unghiului 1)"),
        primary_text: z.string().max(500).describe("Text principal (sau al unghiului 1)"),
        description: z.string().max(50).optional(),
        cta: z.enum(["Learn More", "Sign Up", "Shop Now", "Book Now", "Apply Now", "Call Now"]).default("Learn More"),
        creatives: z
          .array(
            z.object({
              angle: z.enum(["pain", "benefit", "social_proof"]).optional(),
              headline: z.string().max(40),
              primary_text: z.string().max(500),
              description: z.string().max(30).optional(),
              cta: z.enum(["Learn More", "Sign Up", "Shop Now", "Book Now", "Apply Now", "Call Now"]).optional(),
            }),
          )
          .min(2)
          .max(6)
          .optional()
          .describe(
            "OBLIGATORIU pentru rezultate bune: 3 variante pe unghiuri DISTINCTE (pain/benefit/social_proof). Același buget pe ad set — Meta alocă. Dacă lipsește, se lansează doar copy-ul principal.",
          ),
        landing_url: z
          .string()
          .url()
          .optional()
          .describe("Obligatoriu pentru sales/signups/traffic. Pentru leads/calls lasă gol."),
        call_phone: z
          .string()
          .max(30)
          .optional()
          .describe("Doar pentru calls: numărul de apel."),
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
          .describe("Întrebări calificare pe nișă (leads). Dacă goale, sistemul sugerează automat pe business_type."),
        countries: z.array(z.string()).default(["RO"]).describe("Coduri ISO, ex ['RO']"),
        cities: z
          .array(z.string())
          .optional()
          .describe("Orașe locale (ex ['Bucharest']). Dacă e setat, countries e ignorat la geo."),
        city_radius_km: z.number().int().min(10).max(80).default(25),
        interests: z
          .array(z.string().max(60))
          .max(10)
          .optional()
          .describe("Sugestii interese EN. Default GOL (Advantage+). Max 1–3."),
        age_min: z.number().int().min(13).max(65).default(18),
        age_max: z.number().int().min(13).max(65).default(65),
        pixel_id: z
          .string()
          .max(40)
          .optional()
          .describe("Pixel ales când sunt mai mulți (din list_pixels)."),
        beneficiary: z.string().max(100).optional().describe("DSA: nume firmă/persoană promovată."),
      }),
      execute: async (args) => {
        if (args.daily_budget < MIN_AGENT_DAILY_BUDGET_RON || args.daily_budget > MAX_AGENT_DAILY_BUDGET_RON) {
          return {
            error: `Bugetul zilnic trebuie să fie între ${MIN_AGENT_DAILY_BUDGET_RON} și ${MAX_AGENT_DAILY_BUDGET_RON} RON. Pentru sume mai mari, lansează campania din aplicație.`,
          };
        }
        if (!ctx.latestMedia) {
          return { error: "Userul nu a trimis imagine. Cere-i să trimită o poză pentru reclamă." };
        }
        if (
          (args.objective === "sales" ||
            args.objective === "signups" ||
            args.objective === "traffic") &&
          (!args.landing_url || !/^https?:\/\//i.test(args.landing_url))
        ) {
          return {
            error: `Pentru '${args.objective}' am nevoie de link-ul ${
              args.objective === "sales"
                ? "magazinului/categoriei/produsului"
                : args.objective === "signups"
                  ? "paginii de înscriere (ex: pagina unde se fac cont)"
                  : "site-ului"
            } (https://...). Cere-l userului.`,
          };
        }

        const maxCreatives = creativeCountForBudget(args.daily_budget);
        const creatives = normalizeCreatives(
          {
            headline: args.headline,
            primary_text: args.primary_text,
            description: args.description,
            cta: args.cta,
          },
          args.creatives as CreativeVariant[] | undefined,
          maxCreatives,
        );

        let custom_questions = args.custom_questions;
        if (args.objective === "leads" && (!custom_questions || custom_questions.length === 0)) {
          custom_questions = suggestNicheFormQuestions(
            args.business_type || args.name,
            args.primary_text,
          ).map((q) => ({
            label: q.label,
            type: (q.type ?? "short") as "short" | "choice",
            options: q.options,
          }));
        }

        const budgetNote = budgetLearningWarning(
          args.daily_budget,
          args.objective === "calls" ? "calls" : args.objective,
          args.business_type,
          args.cities?.[0],
        );

        if (args.objective === "calls") {
          const raw = (args.call_phone || "").replace(/[^\d+]/g, "");
          if (!raw) {
            return {
              error:
                "Pentru campania de apeluri am nevoie de numărul pe care vrei să primești apelurile. Cere-l userului.",
            };
          }
          const tel = raw.startsWith("+") ? raw : `+40${raw.replace(/^0/, "")}`;
          const result = await createMetaCampaignFromAgent(supabaseAdmin, ctx, {
            ...args,
            objective: "traffic",
            landing_url: `tel:${tel}`,
            cta: "Call Now",
            creatives,
            custom_questions,
          });
          if (budgetNote && !("error" in result && result.error)) {
            return { ...result, budget_note: budgetNote, creatives_launched: creatives.length };
          }
          return result;
        }

        const result = await createMetaCampaignFromAgent(supabaseAdmin, ctx, {
          ...args,
          creatives,
          custom_questions,
        });
        if (budgetNote && !("error" in result && result.error)) {
          return { ...result, budget_note: budgetNote, creatives_launched: creatives.length };
        }
        return { ...result, creatives_launched: creatives.length };
      },
    }),

    retry_last_campaign: tool({
      description:
        "Reîncearcă publicarea ultimului draft eșuat (cu snapshot salvat: obiectiv, creative, pixel, media). Folosește când userul zice „încearcă iar” / retry după o eroare de lansare.",
      inputSchema: z.object({
        beneficiary: z
          .string()
          .max(100)
          .optional()
          .describe("Dacă eroarea a fost DSA — noul nume firmă/persoană."),
      }),
      execute: async ({ beneficiary }) => {
        return retryLastDraftCampaign(supabaseAdmin, ctx, { beneficiary });
      },
    }),

    generate_image: tool({
      description:
        "Generează o imagine pentru reclamă cu AI (gpt-image-1, calitate maximă, 1024x1024). Folosește când userul nu are poză proprie. Promptul trebuie să fie mobile-first, legat de ofertă, cu text scurt pe imagine (max ~5–6 cuvinte) dacă e cazul. Dacă userul a trimis o poză de REFERINȚĂ și vrea ca AI-ul să plece de la ea, apelează cu use_reference=true. După generare imaginea devine 'latestMedia', se salvează în storage și rămâne disponibilă pentru create_campaign la mesajele următoare (userul NU trebuie să o retrimită). Tool-ul trimite SINGUR userului mesajul despre timpul de asteptare la start — nu-l anunta tu inainte.",
      inputSchema: z.object({
        prompt: z
          .string()
          .min(10)
          .max(600)
          .describe(
            "Descriere detaliată: tip afacere, scenă, stil, atmosferă, culori, text scurt pe imagine legat de ofertă. Mobile-first, realist, fără clutter. Română sau engleză.",
          ),
        use_reference: z
          .boolean()
          .optional()
          .describe("true dacă userul a trimis o poză de referință pe WhatsApp și vrea ca imaginea AI să plece de la ea (latestMedia trebuie să fie o imagine)."),
      }),
      execute: async ({ prompt, use_reference }) => {
        try {
          // Limită lunară de poze AI: Starter = 0, Pro = 10, Premium = nelimitat.
          const { checkAiPhotoQuota, recordAiPhoto } = await import("./plan.server");
          const quota = await checkAiPhotoQuota(supabaseAdmin, ctx.userId);
          if (!quota.allowed) {
            return quota.limit === 0
              ? {
                  error:
                    "Generarea de poze cu AI e disponibilă în planurile *Pro* și *Premium*. Fă upgrade din Setări, sau trimite-mi o poză proprie pentru reclamă. 📸",
                }
              : {
                  error: `Ai atins limita de *${quota.limit} poze AI* pe luna aceasta (planul Pro). Treci pe *Premium* pentru poze nelimitate, sau trimite-mi o poză proprie. 📸`,
                };
          }

          // Imagine de referință (opțional): doar dacă userul a trimis o IMAGINE.
          let reference: { bytes: Uint8Array; mime: string } | null = null;
          if (
            use_reference &&
            ctx.latestMedia &&
            ctx.latestMedia.mime.toLowerCase().startsWith("image/")
          ) {
            try {
              const { data: refFile } = await supabaseAdmin.storage
                .from("wa-media")
                .download(ctx.latestMedia.path);
              if (refFile) {
                reference = {
                  bytes: new Uint8Array(await refFile.arrayBuffer()),
                  mime: ctx.latestMedia.mime,
                };
              }
            } catch (e) {
              console.error("[generate_image] reference download", e);
            }
          }

          // Mesaj „durează ~1-2 min" ÎNAINTE de generare (excepția de la regula de a nu anunța).
          try {
            await sendWhatsAppMessage(
              ctx.connection.phone_number_id,
              ctx.connection.access_token,
              ctx.toPhone,
              {
                type: "text",
                text: reference
                  ? "🎨 Am început să creez imaginea plecând de la poza ta... durează un minut, maxim două. Ți-o trimit imediat ce e gata. ⏳"
                  : "🎨 Am început să-ți creez imaginea cu AI... durează un minut, maxim două. Ți-o trimit imediat ce e gata. ⏳",
              },
            );
          } catch (e) {
            console.error("[generate_image] heads-up send", e);
          }

          const { generateCreativeImage } = await import("./wa-ai-extras.server");
          const img = await generateCreativeImage(ctx.userId, prompt, reference);
          await recordAiPhoto(supabaseAdmin, ctx.userId);
          ctx.latestMedia = img;

          // Persistă imaginea generată ca „media disponibilă" pentru mesajele URMĂTOARE,
          // ca la aprobare userul să NU trebuiască să o retrimită — o luăm din storage.
          try {
            await supabaseAdmin.from("whatsapp_messages").insert({
              user_id: ctx.userId,
              connection_id: ctx.connection.id,
              wa_message_id: `ai-gen-${Date.now()}`,
              direction: "in",
              msg_type: "image",
              text: "[imagine generată cu AI]",
              media_path: img.path,
              media_mime: "image/jpeg",
            });
          } catch (e) {
            console.error("[generate_image] persist media row", e);
          }

          // Trimite preview-ul pe WhatsApp
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
              {
                type: "image",
                mediaId,
                caption:
                  "🎨 Gata! Îți place varianta asta? Spune *da* și o folosim la reclamă, sau *altă variantă* dacă vrei să încerc din nou. 👇",
              },
            );
          } catch (e) {
            console.error("[generate_image] preview send", e);
          }
          return {
            ok: true,
            message:
              "Imaginea a fost generată, trimisă userului pentru aprobare și salvată în storage (disponibilă la create_campaign fără retrimitere). Așteaptă confirmarea userului (da / altă variantă) înainte să lansezi.",
          };
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

    list_pixels: tool({
      description:
        "Listează pixelii Meta + health (last_fired_time, active în ultimele 30 zile). Folosește înainte de sales/signups. Preferă pixelul *active*. Dacă sunt mai mulți, întreabă userul.",
      inputSchema: z.object({}),
      execute: async () => {
        const token = await getMetaToken(supabaseAdmin, ctx.userId);
        if (!token) return { error: "Conectează Meta din Settings înainte." };
        const { data: adAcc } = await supabaseAdmin
          .from("meta_ad_accounts").select("ad_account_id")
          .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle();
        if (!adAcc?.ad_account_id) return { error: "Selectează un ad account din Settings." };
        const { listAdPixels } = await import("./meta-publish.server");
        const pixels = await listAdPixels(adAcc.ad_account_id, token);
        const healthy = pixels.filter((p) => p.active).length;
        return {
          count: pixels.length,
          healthy_count: healthy,
          pixels: pixels.map((p) => ({
            id: p.id,
            name: p.name,
            last_fired_time: p.last_fired_time,
            active: p.active,
            health: p.active ? "ok" : "no_recent_events",
          })),
          tip:
            healthy === 0 && pixels.length > 0
              ? "Pixelii există dar n-au evenimente recente — Sales/Signups vor învăța greu. Repară Pixel/CAPI pe site sau pornește pe Traffic/Leads."
              : healthy > 0
                ? "Cel puțin un Pixel e activ (evenimente în ultimele 30 zile)."
                : "Niciun Pixel pe cont — pentru Sales/Signups trebuie instalat.",
        };
      },
    }),

    create_landing_page: tool({
      description:
        "Creează o pagină de prezentare AdPilot (landing page) pentru obiectivul ales și returnează link-ul public. Folosește-o când userul vrea programări, clienți potențiali sau apeluri și nu are site.",
      inputSchema: z.object({
        objective: z.enum(["bookings", "leads", "calls"]),
        business_name: z.string().min(2).max(80),
        service: z.string().min(2).max(120).describe("Ce serviciu/ofertă promovează"),
        city: z.string().max(80).nullable().default(null),
        offer: z.string().max(200).nullable().default(null),
        phone: z.string().max(30).nullable().default(null),
      }),
      execute: async ({ objective, business_name, service, city, offer, phone }) => {
        try {
          const { buildLandingDraftCore, saveLandingCore } = await import("@/lib/goal-setup.server");
          const fallbackPhone =
            phone ?? (objective === "calls" ? await getClickToCallPhone(supabaseAdmin, ctx.userId) : null);
          const draft = await buildLandingDraftCore(ctx.userId, {
            objective,
            business_name,
            service,
            city,
            offer,
            phone: fallbackPhone,
          });
          const saved = await saveLandingCore(ctx.userId, draft);
          return {
            ok: true,
            url: saved.url,
            headline: draft.copy.headline,
            questions: draft.questions.map((q) => q.label),
          };
        } catch (e: any) {
          return { error: e?.message ?? "Nu am putut crea pagina de prezentare." };
        }
      },
    }),

    cancel_subscription: tool({
      description:
        "Anulează abonamentul AdPilot al userului (la finalul perioadei plătite) sau îl reactivează. Folosește-l când userul cere anulare / dezabonare / oprire abonament.",
      inputSchema: z.object({
        reactivate: z.boolean().default(false).describe("true = anulează anularea (reactivează)"),
      }),
      execute: async ({ reactivate }) => {
        try {
          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .select("stripe_subscription_id, status, current_period_end, environment")
            .eq("user_id", ctx.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!sub?.stripe_subscription_id) return { error: "Nu am găsit un abonament activ pe contul tău." };

          const { createStripeClient } = await import("./stripe.server");
          const stripe = createStripeClient(sub.environment === "sandbox" ? "sandbox" : "live");
          const updated: any = await stripe.subscriptions.update(sub.stripe_subscription_id, {
            cancel_at_period_end: !reactivate,
          });

          await supabaseAdmin
            .from("subscriptions")
            .update({ cancel_at_period_end: !reactivate, updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", sub.stripe_subscription_id);

          const endUnix =
            updated?.items?.data?.[0]?.current_period_end ?? updated?.current_period_end ?? null;
          return {
            ok: true,
            canceled: !reactivate,
            access_until: endUnix ? new Date(endUnix * 1000).toISOString() : sub.current_period_end,
          };
        } catch (e: any) {
          return { error: e?.message ?? "Nu am putut modifica abonamentul" };
        }
      },
    }),

    request_human_support: tool({
      description:
        "Escaladează conversația către echipa umană AdPilot. Creează un tichet de suport și trimite alertă pe WhatsApp echipei. Folosește-l când userul cere ajutor uman sau problema nu poate fi rezolvată automat.",
      inputSchema: z.object({
        name: z.string().min(2).max(80).describe("Numele clientului"),
        phone: z.string().max(30).nullable().default(null).describe("Telefonul de contact"),
        problem: z.string().min(5).max(600).describe("Ce a scris/vrea clientul — rezumat clar al problemei"),
        urgency: z.enum(["normal", "urgent"]).default("normal"),
        meta_error: z
          .string()
          .max(600)
          .nullable()
          .default(null)
          .describe(
            "Eroarea EXACTĂ primită de la Meta, dacă escaladarea vine după o campanie/acțiune eșuată. Lasă gol dacă nu există o eroare Meta.",
          ),
      }),
      execute: async ({ name, phone, problem, urgency, meta_error }) => {
        try {
          const contactPhone = phone ?? ctx.toPhone ?? null;
          let email: string | null = null;
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(ctx.userId);
            email = u?.user?.email ?? null;
          } catch {
            email = null;
          }

          const { data: ticket } = await supabaseAdmin
            .from("support_tickets")
            .insert({
              user_id: ctx.userId,
              subject: `WhatsApp: ${problem.slice(0, 60)}`,
              status: "open",
              priority: urgency === "urgent" ? "high" : "normal",
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle();

          if (ticket?.id) {
            await supabaseAdmin.from("support_messages").insert({
              ticket_id: ticket.id,
              sender: "user",
              body: `${problem}\n\nContact: ${name} — ${contactPhone ?? "n/a"}`,
              sent_to_whatsapp: true,
            });
          }

          const { notifyAdminSupportRequest } = await import("./whatsapp/admin-alerts.server");
          await notifyAdminSupportRequest({
            name,
            phone: contactPhone,
            email,
            problem,
            urgency,
            metaError: meta_error,
          });

          return { ok: true, ticket_id: ticket?.id ?? null };
        } catch (e: any) {
          return { error: e?.message ?? "Nu am putut trimite solicitarea către echipă." };
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

async function getClickToCallPhone(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("display_phone, user_phone")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const raw = data?.display_phone || data?.user_phone;
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  return `+40${digits.replace(/^0/, "")}`;
}

function isRetryPublishRequest(message: string): boolean {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(incearca|reincearca|retry)\b/.test(normalized) && /\b(iar|din nou|inca o data|retry)?\b/.test(normalized);
}

function normalizeRo(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function shouldRetryPublishFromHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
): boolean {
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const last = normalizeRo(lastAssistant);
  const current = normalizeRo(userMessage);

  // „Încearcă iar” immediately after an AI image failure should retry image generation,
  // not publish an old draft campaign from days ago.
  if (/(generare ai|imagine|poza|foto)/.test(last) && /(nu a putut crea|nu a mers|a esuat|problema)/.test(last)) {
    return false;
  }

  if (/(too many calls|rate limit|rate-limiting|nu mai incerc automat)/.test(last)) {
    return /(campanie|reclama|public|lans)/.test(current);
  }

  if (/(campanie|reclama|public|lans|meta|motivul real)/.test(last)) {
    return true;
  }

  return /(campanie|reclama|public|lans)/.test(current);
}

function isMetaRateLimitError(message: string): boolean {
  const normalized = normalizeRo(message);
  return (
    normalized.includes("too many calls") ||
    normalized.includes("rate-limiting") ||
    normalized.includes("rate limiting") ||
    normalized.includes("call limit")
  );
}

function formatPublishErrorForWhatsApp(error: string): string {
  return classifyPublishError(error).user_message;
}

async function retryLastDraftCampaign(
  supabaseAdmin: any,
  ctx: AgentCtx,
  opts?: { beneficiary?: string },
) {
  const { data: draft } = await supabaseAdmin
    .from("campaigns")
    .select("id, name, objective, budget, targeting, creative, lead_form, pixel_id")
    .eq("user_id", ctx.userId)
    .eq("platform", "meta")
    .eq("status", "draft")
    .is("meta_campaign_id", null)
    .gte("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) {
    return {
      error:
        "Nu am găsit o campanie eșuată recentă pe care să o reîncerc. Dacă vrei, îmi spui din nou detaliile și o lansez curat.",
    };
  }

  const creative = (draft.creative ?? {}) as any;
  const snapshot = (creative.agent_publish ?? null) as AgentPublishSnapshot | null;
  const leadForm = (draft.lead_form ?? {}) as any;
  const targeting = (draft.targeting ?? {}) as any;
  const age = String(targeting.age_groups?.[0] ?? `${snapshot?.age_min ?? 18}-${snapshot?.age_max ?? 65}`).match(
    /(\d+)\D+(\d+)/,
  );
  const locations = Array.isArray(targeting.locations) ? targeting.locations : snapshot?.countries ?? ["RO"];
  const countries =
    snapshot?.countries?.length
      ? snapshot.countries
      : locations.filter((l: string) => /^[A-Z]{2}$/.test(l));
  const cities =
    snapshot?.cities?.length
      ? snapshot.cities
      : locations.filter((l: string) => !/^[A-Z]{2}$/.test(l));

  const mediaPath = ctx.latestMedia?.path || snapshot?.media_path;
  const mediaMime = ctx.latestMedia?.mime || snapshot?.media_mime || "image/jpeg";
  if (!mediaPath) {
    return {
      error:
        "Nu mai găsesc poza/clipul pentru reclamă. Trimite media încă o dată pe WhatsApp, apoi spune *încearcă iar*.",
    };
  }

  const { data: file, error: dlErr } = await supabaseAdmin.storage.from("wa-media").download(mediaPath);
  if (dlErr || !file) {
    return { error: `Nu pot citi poza/clipul: ${dlErr?.message ?? "fișier lipsă"}` };
  }

  const conn = await getActiveMetaSetup(supabaseAdmin, ctx.userId);
  if ("error" in conn) return conn;

  const objective = objectiveFromDraft(draft.objective, snapshot);
  const creatives = normalizeCreatives(
    {
      headline: String(snapshot?.headline ?? creative.headline ?? draft.name).slice(0, 40),
      primary_text: String(snapshot?.primary_text ?? creative.primary_text ?? creative.description ?? ""),
      description: String(snapshot?.description ?? creative.description ?? ""),
      cta: snapshot?.cta ?? creative.cta ?? "Learn More",
    },
    snapshot?.creatives,
    creativeCountForBudget(Number(snapshot?.daily_budget ?? draft.budget)),
  );

  const bytes = new Uint8Array(await file.arrayBuffer());
  const args = {
    name: snapshot?.name ?? draft.name,
    daily_budget: Number(snapshot?.daily_budget ?? draft.budget),
    objective,
    headline: creatives[0]!.headline,
    primary_text: creatives[0]!.primary_text,
    description: creatives[0]!.description ?? "",
    cta: creatives[0]!.cta ?? snapshot?.cta ?? creative.cta ?? "Learn More",
    landing_url: snapshot?.landing_url ?? creative.landing_url ?? "https://adpilot.ro",
    beneficiary:
      (opts?.beneficiary && opts.beneficiary.trim()) ||
      snapshot?.beneficiary ||
      (typeof creative.beneficiary === "string" ? creative.beneficiary : undefined),
    custom_questions: snapshot?.custom_questions ?? leadForm.custom_questions ?? [],
    countries: countries.length ? countries : ["RO"],
    cities: cities.length ? cities : undefined,
    city_radius_km: snapshot?.city_radius_km ?? 25,
    age_min: snapshot?.age_min ?? (age ? Number(age[1]) : 18),
    age_max: snapshot?.age_max ?? (age ? Number(age[2]) : 65),
    interests: snapshot?.interests,
    pixel_id: snapshot?.pixel_id ?? draft.pixel_id ?? undefined,
    creatives,
  };

  // Persist beneficiary fix into snapshot for next retries
  if (opts?.beneficiary) {
    await supabaseAdmin
      .from("campaigns")
      .update({
        creative: {
          ...creative,
          beneficiary: opts.beneficiary,
          agent_publish: { ...(snapshot ?? {}), beneficiary: opts.beneficiary },
        },
      })
      .eq("id", draft.id);
  }

  const cityKeys = await resolveCityKeys(
    conn.accessToken,
    args.cities,
    args.countries,
    args.city_radius_km ?? 25,
  );
  if (args.cities?.length && !cityKeys.length) {
    return { error: `Nu am găsit orașele cerute (${args.cities.join(", ")}) în Meta.` };
  }

  const result = await publishCampaignToMeta(supabaseAdmin, {
    campaignRowId: draft.id,
    adAccountId: conn.adAccountId,
    accessToken: conn.accessToken,
    pageId: conn.pageId,
    pageAccessToken: conn.pageAccessToken,
    bytes,
    mediaMime,
    args,
    objective: objective === "calls" ? "traffic" : (objective as "leads" | "traffic" | "sales" | "signups"),
    cityKeys,
    userId: ctx.userId,
  });

  if ("error" in result && result.error) {
    return { error: classifyPublishError(result.error).user_message, raw_error: result.error };
  }
  return result;
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
      beneficiary?: string;
      interests?: string[];
      pixel_id?: string;
      creatives?: CreativeVariant[];
    };
    objective: "leads" | "traffic" | "sales" | "signups";
    cityKeys: Array<{ key: string; radius?: number }>;
    userId: string;
  },
) {
  const { createLeadForm, uploadAdImageFromBytes, createCampaign, createAdSet, createAdCreative, createAd, fetchPageName, fetchPageInstagramId, resolveAdTargeting } =
    await import("./meta-publish.server");

  const persistPublishError = async (msg: string) => {
    try {
      const { data: row } = await supabaseAdmin
        .from("campaigns")
        .select("creative")
        .eq("id", input.campaignRowId)
        .maybeSingle();
      const creative = (row?.creative ?? {}) as Record<string, unknown>;
      await supabaseAdmin
        .from("campaigns")
        .update({
          status: "draft",
          creative: {
            ...creative,
            last_publish_error: msg,
            last_publish_error_at: new Date().toISOString(),
          },
        })
        .eq("id", input.campaignRowId);
    } catch {
      /* ignore */
    }
  };

  try {
    const { checkAdAccountRunnable } = await import("./meta-publish.server");
    const runnable = await checkAdAccountRunnable(input.adAccountId, input.accessToken);
    if (!runnable.ok) {
      await supabaseAdmin.from("campaigns").update({ status: "draft" }).eq("id", input.campaignRowId);
      return { error: runnable.message ?? "Contul de reclame nu este activ pe Facebook." };
    }

    let form: { id: string } | null = null;
    let objective: "leads" | "traffic" | "sales" | "signups" = input.objective;
    let landing_url = input.args.landing_url ?? "https://adpilot.ro";
    let fallbackNote = "";
    let pixel_id: string | undefined;
    let pixelHealthNote = "";

    const creatives = normalizeCreatives(
      {
        headline: input.args.headline,
        primary_text: input.args.primary_text,
        description: input.args.description,
        cta: input.args.cta,
      },
      input.args.creatives,
      creativeCountForBudget(input.args.daily_budget),
    );

    if (input.objective === "leads") {
      try {
        form = await createLeadForm(input.pageId, input.pageAccessToken, {
          name: input.args.name,
          fields: ["Name", "Phone"],
          privacy_url: "https://adpilot.ro/privacy-policy",
          custom_questions: input.args.custom_questions,
        });
        await supabaseAdmin.from("campaigns").update({ meta_lead_form_id: form?.id ?? null }).eq("id", input.campaignRowId);
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        if (/pages_manage_ads/i.test(msg)) {
          const phone = await getClickToCallPhone(supabaseAdmin, input.userId);
          if (!phone) {
            return {
              error:
                "Lipsește permisiunea pages_manage_ads (face parte din Marketing API) și nu găsesc un număr de telefon salvat. " +
                "Pentru a lansa o campanie 'Sună acum', trimite-mi te rog numărul de telefon pe care vrei să sune clienții.",
            };
          }
          objective = "traffic";
          landing_url = `tel:${phone}`;
          fallbackNote = "formular lead dezactivat — campanie 'Sună acum'";
          for (const c of creatives) c.cta = "Call Now";
          await supabaseAdmin
            .from("campaigns")
            .update({
              objective: "LINK_CLICKS",
              lead_form: null,
              creative: {
                ...input.args,
                cta: "Call Now",
                landing_url,
                variants: creatives,
              },
            })
            .eq("id", input.campaignRowId);
        } else {
          throw e;
        }
      }
    }

    if (objective === "sales" || objective === "signups") {
      const { listAdPixels } = await import("./meta-publish.server");
      const pixels = await listAdPixels(input.adAccountId, input.accessToken);
      let chosen = input.args.pixel_id
        ? pixels.find((p) => p.id === input.args.pixel_id) ?? null
        : null;
      if (!chosen) {
        const healthy = pixels.filter((p) => p.active);
        if (healthy.length === 1) chosen = healthy[0]!;
        else if (pixels.length === 1) chosen = pixels[0]!;
        else if (healthy.length > 1) {
          chosen = healthy[0]!;
          fallbackNote =
            (fallbackNote ? fallbackNote + " · " : "") +
            `ai ${healthy.length} pixeli activi — am folosit '${chosen.name}'. Dacă vrei altul, spune-mi`;
        } else if (pixels.length > 1) {
          chosen = pixels[0]!;
          fallbackNote =
            (fallbackNote ? fallbackNote + " · " : "") +
            `ai ${pixels.length} pixeli pe cont — am folosit '${chosen.name}' (fără evenimente recente)`;
        }
      }
      if (chosen) {
        pixel_id = chosen.id;
        if (!chosen.active) {
          pixelHealthNote =
            `Pixelul '${chosen.name}' n-are evenimente în ultimele 30 zile — Sales/Signups învață greu. Verifică Pixel + CAPI pe site.`;
          fallbackNote = (fallbackNote ? fallbackNote + " · " : "") + pixelHealthNote;
        } else {
          fallbackNote =
            (fallbackNote ? fallbackNote + " · " : "") +
            `Pixel activ: ${chosen.name}`;
        }
        await supabaseAdmin.from("campaigns").update({ pixel_id: chosen.id }).eq("id", input.campaignRowId);
      } else {
        const what = objective === "signups" ? "înscrieri" : "vânzări reale";
        objective = "traffic";
        fallbackNote =
          (fallbackNote ? fallbackNote + " · " : "") +
          `n-am găsit Pixel Meta pe cont — am făcut campanie de *trafic* spre site. Instalează Pixel-ul (și CAPI) pe site ca să optimizăm pe ${what}`;
        await supabaseAdmin.from("campaigns").update({ objective: "LINK_CLICKS" }).eq("id", input.campaignRowId);
      }
    }

    const metaObjective =
      objective === "traffic"
        ? "OUTCOME_TRAFFIC"
        : objective === "sales" || objective === "signups"
          ? "OUTCOME_SALES"
          : "OUTCOME_LEADS";

    const metaCamp = await createCampaign(
      input.adAccountId,
      input.accessToken,
      input.args.name,
      "ACTIVE",
      metaObjective,
    );
    await supabaseAdmin.from("campaigns").update({ meta_campaign_id: metaCamp.id }).eq("id", input.campaignRowId);

    const dsaName =
      (input.args.beneficiary && input.args.beneficiary.trim()) ||
      (await fetchPageName(input.pageId, input.pageAccessToken)) ||
      (await fetchPageName(input.pageId, input.accessToken)) ||
      "AdPilot";

    const detailed = input.args.interests?.length
      ? await resolveAdTargeting(input.accessToken, input.args.interests)
      : null;
    if (detailed) {
      if (detailed.matched.length) {
        fallbackNote =
          (fallbackNote ? fallbackNote + " · " : "") +
          `sugestii interese: ${detailed.matched.join(", ")}`;
      }
      if (detailed.missed.length) {
        fallbackNote =
          (fallbackNote ? fallbackNote + " · " : "") +
          `n-am găsit în Meta: ${detailed.missed.join(", ")}`;
      }
    }

    const { ronBudgetToAccountCents } = await import("@/lib/currency.server");
    const budgetConv = await ronBudgetToAccountCents(
      input.args.daily_budget,
      input.adAccountId,
      input.accessToken,
    );
    if (budgetConv.note) {
      fallbackNote = (fallbackNote ? fallbackNote + " · " : "") + budgetConv.note;
    }

    const buildAdSet = (beneficiary: string) =>
      createAdSet(input.adAccountId, input.accessToken, {
        name: `${input.args.name} — AdSet`,
        campaign_id: metaCamp.id,
        daily_budget_cents: budgetConv.cents,
        page_id: input.pageId,
        dsa_beneficiary: beneficiary,
        dsa_payor: beneficiary,
        targeting: {
          countries: input.args.countries,
          age_min: input.args.age_min,
          age_max: input.args.age_max,
          cities: input.cityKeys.length ? input.cityKeys : undefined,
          interests: detailed?.interests,
          behaviors: detailed?.behaviors,
        },
        status: "ACTIVE",
        objective,
        pixel_id,
        advantage_placements: true,
      });

    let adset: { id: string };
    try {
      adset = await buildAdSet(dsaName);
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const isDsa = /beneficiar|beneficiary|payer|payor|person or organization|organization being promoted|dsa/i.test(m);
      if (!isDsa) throw e;
      const fallbacks = [
        (await fetchPageName(input.pageId, input.pageAccessToken)) || "",
        (await fetchPageName(input.pageId, input.accessToken)) || "",
        input.args.name,
      ].filter((n) => n && n.trim() && n.trim() !== dsaName.trim());
      let last: any = e;
      let ok: { id: string } | null = null;
      for (const name of fallbacks) {
        try {
          ok = await buildAdSet(name.trim().slice(0, 100));
          break;
        } catch (err) {
          last = err;
        }
      }
      if (!ok) throw last;
      adset = ok;
    }
    await supabaseAdmin.from("campaigns").update({ meta_adset_id: adset.id }).eq("id", input.campaignRowId);

    const isVideo = (input.mediaMime || "").toLowerCase().startsWith("video/");
    let image_hash: string | undefined;
    let video_id: string | undefined;
    let thumbnail_url: string | null | undefined;
    if (isVideo) {
      const { uploadAdVideoFromBytes } = await import("./meta-publish.server");
      const ext = (input.mediaMime.split("/")[1] || "mp4").split(";")[0];
      const v = await uploadAdVideoFromBytes(
        input.adAccountId,
        input.accessToken,
        input.bytes,
        `ad.${ext}`,
        input.mediaMime || "video/mp4",
      );
      video_id = v.video_id;
      thumbnail_url = v.thumbnail_url;
    } else {
      image_hash = await uploadAdImageFromBytes(
        input.adAccountId,
        input.accessToken,
        input.bytes,
        "ad.jpg",
        input.mediaMime || "image/jpeg",
      );
    }

    const igId =
      (await fetchPageInstagramId(input.pageId, input.pageAccessToken)) ||
      (await fetchPageInstagramId(input.pageId, input.accessToken));

    const adIds: string[] = [];
    for (let i = 0; i < creatives.length; i++) {
      const variant = creatives[i]!;
      const label = variant.angle ? String(variant.angle) : `V${i + 1}`;
      const adCta = variant.cta || creatives[0]?.cta || input.args.cta;
      const adCreative = await createAdCreative(input.adAccountId, input.accessToken, {
        name: `${input.args.name} — ${label}`,
        page_id: input.pageId,
        instagram_user_id: igId,
        image_hash,
        video_id,
        thumbnail_url,
        headline: variant.headline,
        description: variant.primary_text,
        cta: adCta,
        landing_url,
        lead_gen_form_id: form?.id,
      });
      const ad = await createAd(input.adAccountId, input.accessToken, {
        name: `${input.args.name} — ${label}`,
        adset_id: adset.id,
        creative_id: adCreative.id,
        status: "ACTIVE",
      });
      adIds.push(ad.id);
    }

    const primaryAdId = adIds[0]!;
    fallbackNote =
      (fallbackNote ? fallbackNote + " · " : "") +
      `${creatives.length} creative în același ad set (Advantage+ placements)`;

    const { data: existingRow } = await supabaseAdmin
      .from("campaigns")
      .select("creative")
      .eq("id", input.campaignRowId)
      .maybeSingle();
    const prevCreative = (existingRow?.creative ?? {}) as Record<string, unknown>;

    await supabaseAdmin
      .from("campaigns")
      .update({
        meta_campaign_id: metaCamp.id,
        meta_adset_id: adset.id,
        meta_ad_id: primaryAdId,
        meta_lead_form_id: form?.id ?? null,
        status: "active",
        creative: {
          ...prevCreative,
          headline: creatives[0]!.headline,
          primary_text: creatives[0]!.primary_text,
          description: creatives[0]!.description ?? input.args.description ?? "",
          cta: creatives[0]!.cta ?? input.args.cta,
          landing_url,
          variants: creatives,
          meta_ad_ids: adIds,
          last_publish_error: null,
        },
        ...(objective === "sales" || objective === "signups"
          ? { objective: "CONVERSIONS", lead_form: null }
          : objective === "traffic"
            ? { objective: "LINK_CLICKS", lead_form: null }
            : {}),
      })
      .eq("id", input.campaignRowId);

    const baseMsg =
      objective === "sales"
        ? "Campanie de *vânzări* LIVE ✅ — Pixel + mai multe creative."
        : objective === "signups"
          ? "Campanie de *înscrieri* LIVE ✅ — Pixel + mai multe creative."
          : objective === "traffic"
            ? `Campanie LIVE ✅${fallbackNote ? " — " + fallbackNote : ""}`
            : `Campanie LIVE (lead form) ✅ — ${creatives.length} creative.`;

    return {
      ok: true,
      campaign_id: input.campaignRowId,
      meta_campaign_id: metaCamp.id,
      meta_ad_ids: adIds,
      creatives_count: creatives.length,
      message: fallbackNote && objective !== "traffic" ? `${baseMsg} ${fallbackNote}` : baseMsg,
      pixel_health_note: pixelHealthNote || undefined,
    };
  } catch (e: any) {
    const msg = e?.message ?? "Publish failed";
    console.error("[wa-agent] create_campaign publish failed:", msg, e);
    await persistPublishError(msg);
    return { error: msg, hint: classifyPublishError(msg) };
  }
}

async function createMetaCampaignFromAgent(
  supabaseAdmin: any,
  ctx: AgentCtx,
  args: {
    name: string;
    daily_budget: number;
    objective?: "leads" | "traffic" | "sales" | "calls" | "signups";
    business_type?: string;
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
    beneficiary?: string;
    interests?: string[];
    pixel_id?: string;
    creatives?: CreativeVariant[];
  },
) {
  const objective: "leads" | "traffic" | "sales" | "signups" =
    args.objective === "calls" ? "traffic" : (args.objective ?? "leads");

  const { assertCanPublishCampaign } = await import("@/lib/access.server");
  await assertCanPublishCampaign(supabaseAdmin, ctx.userId);

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

  const { data: file, error: dlErr } = await supabaseAdmin.storage
    .from("wa-media")
    .download(ctx.latestMedia!.path);
  if (dlErr || !file) return { error: `Nu pot citi imaginea: ${dlErr?.message}` };
  const bytes = new Uint8Array(await file.arrayBuffer());

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

  const creatives = normalizeCreatives(
    {
      headline: args.headline,
      primary_text: args.primary_text,
      description: args.description,
      cta: args.cta,
    },
    args.creatives,
    creativeCountForBudget(args.daily_budget),
  );

  const snapshot: AgentPublishSnapshot = {
    objective: args.objective === "calls" ? "calls" : objective,
    name: args.name,
    daily_budget: args.daily_budget,
    headline: creatives[0]!.headline,
    primary_text: creatives[0]!.primary_text,
    description: creatives[0]!.description ?? args.description,
    cta: (creatives[0]!.cta as string) ?? args.cta,
    landing_url: args.landing_url,
    beneficiary: args.beneficiary,
    countries: args.countries,
    cities: args.cities,
    city_radius_km: args.city_radius_km,
    age_min: args.age_min,
    age_max: args.age_max,
    interests: args.interests,
    pixel_id: args.pixel_id,
    custom_questions: args.custom_questions,
    creatives,
    media_path: ctx.latestMedia!.path,
    media_mime: ctx.latestMedia!.mime,
  };

  const dbObjective =
    objective === "traffic"
      ? "LINK_CLICKS"
      : objective === "sales" || objective === "signups"
        ? "CONVERSIONS"
        : "LEAD_GENERATION";

  const { data: campRow, error: insErr } = await supabaseAdmin
    .from("campaigns")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      platform: "meta",
      objective: dbObjective,
      status: "draft",
      budget: args.daily_budget,
      budget_mode: "BUDGET_MODE_DAY",
      creative: {
        headline: creatives[0]!.headline,
        description: creatives[0]!.description ?? args.description ?? "",
        primary_text: creatives[0]!.primary_text,
        cta: creatives[0]!.cta ?? args.cta,
        landing_url: args.landing_url ?? "https://adpilot.ro",
        media_url: ctx.latestMedia!.signedUrl,
        beneficiary: args.beneficiary,
        variants: creatives,
        agent_publish: snapshot,
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
    args: { ...args, creatives },
    objective,
    cityKeys,
    userId: ctx.userId,
  });
}
