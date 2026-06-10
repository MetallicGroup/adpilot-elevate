import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateLauncherAdCopy } from "@/lib/launcher/copy-generator";
import { launchFromDraft, resolvePlatformForUser } from "@/lib/launcher/launch.service";
import { suggestLeadFields } from "@/lib/launcher/presets";
import type { LauncherSimpleAnswers, LeadFieldConfig } from "@/lib/launcher/types";
import { syncMetaLeads } from "@/lib/meta/leads";
import { getMetaInsightsSummary, syncMetaInsights } from "@/lib/meta/insights";
import { getWhatsAppConfig } from "./config.server";
import { detectIntent, extractCampaignDraftHints } from "./intent-router";
import { sendWhatsAppMessage } from "./sendMessage";

type Session = {
  id: string;
  user_id: string | null;
  phone: string;
  current_step: string;
  intent?: string | null;
  draft_campaign_id: string | null;
  collected_data: Record<string, unknown>;
};

async function getOrCreateSession(phone: string): Promise<Session> {
  const { data: existing } = await supabaseAdmin
    .from("conversation_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) return existing as Session;

  const { data: linked } = await supabaseAdmin
    .from("user_whatsapp_phones")
    .select("user_id")
    .eq("phone", phone)
    .eq("verified", true)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("conversation_sessions")
    .insert({
      phone,
      user_id: linked?.user_id ?? null,
      current_step: "idle",
      collected_data: {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Session;
}

async function updateSession(sessionId: string, patch: Partial<Session>) {
  await supabaseAdmin
    .from("conversation_sessions")
    .update({
      current_step: patch.current_step,
      collected_data: patch.collected_data,
      draft_campaign_id: patch.draft_campaign_id,
      intent: patch.intent,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}

function buildAnswers(data: Record<string, unknown>): LauncherSimpleAnswers {
  return {
    promotion_goal: (data.promotion_goal as LauncherSimpleAnswers["promotion_goal"]) || "leads",
    niche: (data.niche as LauncherSimpleAnswers["niche"]) || "general",
    service: (data.service as string) || "Serviciul nostru",
    city: (data.city as string) || "București",
    radius_km: (data.radius_km as number) || 15,
    daily_budget: (data.daily_budget as number) || 50,
    business_name: data.business_name as string | undefined,
    privacy_policy_url: (data.privacy_policy_url as string) || "https://adpilot.ro/privacy-policy",
  };
}

export async function handleWhatsAppMessage(from: string, text: string, mediaUrls: string[] = []) {
  const { appUrl } = getWhatsAppConfig();
  const session = await getOrCreateSession(from);

  if (!session.user_id) {
    await sendWhatsAppMessage(
      from,
      `Bună! 👋 Nu te-am recunoscut încă.\n\nConectează contul AdPilot aici:\n${appUrl}/settings\n\nApoi adaugă numărul tău de WhatsApp în setări.`,
    );
    return;
  }

  const userId = session.user_id;
  const intent = detectIntent(text);
  const data = { ...session.collected_data };

  if (mediaUrls.length) {
    const existing = (data.creative_urls as string[]) || [];
    data.creative_urls = [...existing, ...mediaUrls].slice(0, 5);
    await updateSession(session.id, { collected_data: data, current_step: session.current_step });
    await sendWhatsAppMessage(from, `Am primit ${mediaUrls.length} fișier(e). Poți trimite până la 5 poze/video.`);
    return;
  }

  if (intent === "greeting") {
    await sendWhatsAppMessage(
      from,
      `Bună! Sunt asistentul AdPilot 🤖\n\nPot să:\n• Creez o reclamă nouă\n• Îți arăt lead-urile\n• Îți trimit raportul de azi\n• Oprească o campanie\n\nScrie, de exemplu:\n"Vreau o reclamă pentru machiaj de mireasă în București cu 50 lei pe zi"`,
    );
    return;
  }

  if (intent === "connect_platform") {
    await sendWhatsAppMessage(from, `Conectează platforma aici:\n${appUrl}/settings`);
    return;
  }

  if (intent === "get_leads") {
    await syncMetaLeads(userId);
    const { data: leads } = await supabaseAdmin
      .from("leads_crm")
      .select("name, phone, campaign_name, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!leads?.length) {
      await sendWhatsAppMessage(from, "Nu ai lead-uri noi încă. Când vine primul, te anunț automat 🎉");
      return;
    }

    const list = leads
      .map((l, i) => `${i + 1}. ${l.name ?? "—"} · ${l.phone ?? "—"} · ${l.campaign_name ?? ""}`)
      .join("\n");
    await sendWhatsAppMessage(from, `Ultimele lead-uri:\n\n${list}\n\nVezi tot în AdPilot: ${appUrl}/leads`);
    return;
  }

  if (intent === "get_report") {
    await syncMetaInsights(userId);
    const summary = await getMetaInsightsSummary(userId);
    await sendWhatsAppMessage(
      from,
      `Raportul tău de azi 📊\n\nCheltuit: ${summary.spend.toFixed(0)} RON\nLead-uri: ${summary.leads}\nCost/lead: ${summary.cpl.toFixed(0)} RON\nClickuri: ${summary.clicks}\n\n${
        summary.leads > 0 ? "Reclamele merg bine. Recomandăm să păstrăm bugetul încă 24h." : "Încă nu avem suficiente date. Verificăm din nou mâine."
      }`,
    );
    return;
  }

  if (intent === "pause_campaign") {
    await sendWhatsAppMessage(
      from,
      "Am înregistrat cererea de pauză. Deschide AdPilot pentru confirmare — siguranța contului tău e importantă.",
    );
    return;
  }

  if (intent === "create_campaign" || session.current_step.startsWith("create_")) {
    const hints = extractCampaignDraftHints(text);
    if (hints.daily_budget) data.daily_budget = hints.daily_budget;
    if (hints.city) data.city = hints.city.charAt(0).toUpperCase() + hints.city.slice(1);
    if (hints.platform) data.platform = hints.platform;
    if (!data.service && text.length > 10) data.service = text;

    const step = session.current_step === "idle" ? "create_service" : session.current_step;

    if (step === "create_service" && !data.service) {
      await updateSession(session.id, { current_step: "create_service", collected_data: data, intent: "create_campaign" });
      await sendWhatsAppMessage(from, "Super! Ce serviciu sau produs vrei să promovezi?");
      return;
    }

    if (!data.city) {
      await updateSession(session.id, { current_step: "create_city", collected_data: data });
      await sendWhatsAppMessage(from, "Din ce oraș vrei clienți? (ex: București, Cluj, Iași)");
      return;
    }

    if (!data.daily_budget) {
      await updateSession(session.id, { current_step: "create_budget", collected_data: data });
      await sendWhatsAppMessage(from, "Cât vrei să investești pe zi?\n\n30 RON\n50 RON\n100 RON\n\nSau scrie o sumă personalizată.");
      return;
    }

    if (!data.platform) {
      const resolved = await resolvePlatformForUser(userId);
      if (resolved) data.platform = resolved;
      else {
        await updateSession(session.id, { current_step: "create_platform", collected_data: data });
        await sendWhatsAppMessage(from, "Unde vrei să rulăm reclama?\n\n• Meta\n• TikTok");
        return;
      }
    }

    const answers = buildAnswers(data);
    const leadFields = (data.lead_fields as LeadFieldConfig[]) || suggestLeadFields(answers.niche);
    const generated = generateLauncherAdCopy(answers, leadFields);
    data.generated = generated;

    if (session.current_step !== "awaiting_confirm") {
      await updateSession(session.id, { current_step: "awaiting_confirm", collected_data: data });
      await sendWhatsAppMessage(
        from,
        `Reclama este gata ✅\n\nPlatformă: ${data.platform === "meta" ? "Meta" : "TikTok"}\nServiciu: ${answers.service}\nLocație: ${answers.city} + 15 km\nBuget: ${answers.daily_budget} lei/zi\n\nText reclamă:\n${generated.primary_text.slice(0, 500)}...\n\nRăspunde:\n• "Pornește reclama" — pentru a crea (în pauză, pentru siguranță)\n• "Salvează draft" — păstrezi pentru mai târziu`,
      );
      return;
    }

    if (/pornește|porneste|start|da\b/i.test(text)) {
      try {
        const platform = (data.platform as "meta" | "tiktok") || "meta";
        if (platform === "meta") {
          const { data: account } = await supabaseAdmin
            .from("meta_ad_accounts")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          const pages = await import("@/lib/meta/campaign").then((m) => m.fetchMetaPages(userId));
          if (!account || !pages.length) {
            await sendWhatsAppMessage(from, `Conectează Meta și o pagină Facebook:\n${appUrl}/settings`);
            return;
          }
          await launchFromDraft({
            userId,
            answers,
            generated,
            leadFields,
            creativeUrls: (data.creative_urls as string[]) || [],
            platform: "meta",
            adAccountUuid: account.id,
            pageId: pages[0].id,
            privacyPolicyUrl: answers.privacy_policy_url || `${appUrl}/privacy-policy`,
          });
        } else {
          await launchFromDraft({
            userId,
            answers,
            generated,
            leadFields,
            creativeUrls: (data.creative_urls as string[]) || [],
            platform: "tiktok",
            privacyPolicyUrl: answers.privacy_policy_url || `${appUrl}/privacy-policy`,
          });
        }
        await updateSession(session.id, { current_step: "idle", collected_data: {}, draft_campaign_id: null });
        await sendWhatsAppMessage(from, "Gata! Reclama ta e pregătită ✅\n\nTe anunțăm pe WhatsApp când vine primul lead.");
      } catch (err) {
        await sendWhatsAppMessage(from, `Nu am putut crea reclama: ${err instanceof Error ? err.message : "eroare"}. Încearcă din dashboard.`);
      }
      return;
    }
  }

  await sendWhatsAppMessage(
    from,
    `Nu am înțeles complet. Poți scrie:\n• "Vreau o reclamă pentru [serviciu] în [oraș]"\n• "Arată-mi lead-urile"\n• "Raportul de azi"`,
  );
}
