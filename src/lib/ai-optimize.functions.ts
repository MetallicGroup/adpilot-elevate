import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ campaign_id: z.string().uuid() });

type AiInsight = { insight_text: string; action: string | null };

/**
 * Reads a campaign's recent performance + creative and asks Lovable AI to produce
 * 1-3 short, plain-language insights (in Romanian) with an optional next action.
 * Persists them to ai_insights and returns the inserted rows.
 */
export const generateAiInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, name, objective, budget, budget_mode, targeting, creative, status, platform")
      .eq("id", data.campaign_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!campaign) throw new Error("Campaign not found");

    const { data: perf } = await supabase
      .from("performance_data")
      .select("date, spend, impressions, clicks, ctr, leads, cpl")
      .eq("campaign_id", data.campaign_id)
      .order("date", { ascending: false })
      .limit(14);

    const totals = (perf ?? []).reduce(
      (a, p) => ({
        spend: a.spend + Number(p.spend ?? 0),
        impressions: a.impressions + Number(p.impressions ?? 0),
        clicks: a.clicks + Number(p.clicks ?? 0),
        leads: a.leads + Number(p.leads ?? 0),
      }),
      { spend: 0, impressions: 0, clicks: 0, leads: 0 },
    );
    const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpl = totals.leads ? totals.spend / totals.leads : 0;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `Ești un strategist de reclame Meta. Analizează această campanie și dă 2-3 observații SCURTE (max 25 cuvinte fiecare) în română, simple, fără jargon. Pentru fiecare, sugerează o acțiune concretă într-un câmp "action" (max 12 cuvinte) sau null.

Campanie: ${JSON.stringify({
      name: campaign.name,
      objective: campaign.objective,
      budget: `${campaign.budget} ${campaign.budget_mode === "BUDGET_MODE_DAY" ? "/zi" : "total"}`,
      targeting: campaign.targeting,
      creative_headline: (campaign.creative as any)?.headline,
      creative_cta: (campaign.creative as any)?.cta,
      status: campaign.status,
    })}

Performanță cumulată: ${JSON.stringify({ ...totals, ctr_pct: ctr.toFixed(2), cpl: cpl.toFixed(2) })}

Răspunde DOAR cu JSON valid de forma: {"insights":[{"insight_text":"...","action":"..."|null}]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Răspunzi DOAR cu JSON valid, fără markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI gateway error (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: { insights?: AiInsight[] } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { insights: [{ insight_text: cleaned.slice(0, 300), action: null }] };
    }
    const insights = (parsed.insights ?? []).slice(0, 5).filter((i) => i.insight_text?.trim());
    if (!insights.length) return { inserted: 0 };

    const rows = insights.map((i) => ({
      user_id: userId,
      campaign_id: campaign.id,
      insight_text: i.insight_text.trim().slice(0, 600),
      action: i.action ? i.action.toString().trim().slice(0, 200) : null,
    }));
    const { error: insErr } = await supabase.from("ai_insights").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { inserted: rows.length };
  });