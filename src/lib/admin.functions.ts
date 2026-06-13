import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function logAudit(
  actorId: string,
  action: string,
  target_type: string | null,
  target_id: string | null,
  details?: any,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(actorId);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: actorId,
      actor_email: au?.user?.email ?? null,
      action,
      target_type,
      target_id,
      details: details ?? null,
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  campaign_count: number;
  active_campaigns: number;
  total_spend: number;
  total_leads: number;
  wa_connected: boolean;
  open_tickets: number;
};

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, plan, subscription_status, trial_ends_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return { users: [] as AdminUserRow[] };

    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map<string, string>();
    for (const u of authList?.users ?? []) emailById.set(u.id, u.email ?? "");

    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, user_id, status")
      .in("user_id", ids);
    const campaignsByUser = new Map<string, { total: number; active: number; ids: string[] }>();
    for (const c of campaigns ?? []) {
      const acc = campaignsByUser.get(c.user_id) ?? { total: 0, active: 0, ids: [] };
      acc.total += 1;
      if (c.status === "active") acc.active += 1;
      acc.ids.push(c.id);
      campaignsByUser.set(c.user_id, acc);
    }

    const allCampaignIds = (campaigns ?? []).map((c) => c.id);
    const spendByUser = new Map<string, { spend: number; leads: number }>();
    if (allCampaignIds.length) {
      const { data: perf } = await supabaseAdmin
        .from("performance_data")
        .select("campaign_id, spend, leads")
        .in("campaign_id", allCampaignIds);
      const userByCampaign = new Map<string, string>();
      for (const c of campaigns ?? []) userByCampaign.set(c.id, c.user_id);
      for (const p of perf ?? []) {
        const uid = userByCampaign.get(p.campaign_id as string);
        if (!uid) continue;
        const acc = spendByUser.get(uid) ?? { spend: 0, leads: 0 };
        acc.spend += Number(p.spend ?? 0);
        acc.leads += Number(p.leads ?? 0);
        spendByUser.set(uid, acc);
      }
    }

    const { data: waConns } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("user_id, status")
      .in("user_id", ids);
    const waByUser = new Map<string, boolean>();
    for (const w of waConns ?? []) waByUser.set(w.user_id, w.status === "active");

    const { data: tix } = await supabaseAdmin
      .from("support_tickets")
      .select("user_id, status")
      .in("user_id", ids)
      .eq("status", "open");
    const tixByUser = new Map<string, number>();
    for (const t of tix ?? []) tixByUser.set(t.user_id, (tixByUser.get(t.user_id) ?? 0) + 1);

    const users: AdminUserRow[] = (profiles ?? []).map((p) => {
      const c = campaignsByUser.get(p.id) ?? { total: 0, active: 0, ids: [] };
      const s = spendByUser.get(p.id) ?? { spend: 0, leads: 0 };
      return {
        id: p.id,
        email: emailById.get(p.id) ?? null,
        full_name: p.full_name,
        plan: p.plan,
        subscription_status: (p as any).subscription_status ?? "trial",
        trial_ends_at: (p as any).trial_ends_at ?? null,
        created_at: p.created_at,
        campaign_count: c.total,
        active_campaigns: c.active,
        total_spend: s.spend,
        total_leads: s.leads,
        wa_connected: waByUser.get(p.id) ?? false,
        open_tickets: tixByUser.get(p.id) ?? 0,
      };
    });

    return { users };
  });

const UserIdInput = z.object({ user_id: z.string().uuid() });

export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UserIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!profile) throw new Error("User not found");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);

    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, platform, status, budget, budget_mode, objective, created_at, meta_campaign_id")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false });

    const ids = (campaigns ?? []).map((c) => c.id);
    const perfByCampaign = new Map<string, { spend: number; impressions: number; clicks: number; leads: number }>();
    if (ids.length) {
      const { data: perf } = await supabaseAdmin
        .from("performance_data")
        .select("campaign_id, spend, impressions, clicks, leads")
        .in("campaign_id", ids);
      for (const p of perf ?? []) {
        const k = p.campaign_id as string;
        const acc = perfByCampaign.get(k) ?? { spend: 0, impressions: 0, clicks: 0, leads: 0 };
        acc.spend += Number(p.spend ?? 0);
        acc.impressions += Number(p.impressions ?? 0);
        acc.clicks += Number(p.clicks ?? 0);
        acc.leads += Number(p.leads ?? 0);
        perfByCampaign.set(k, acc);
      }
    }
    const campaignsOut = (campaigns ?? []).map((c) => ({
      ...c,
      ...(perfByCampaign.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, leads: 0 }),
    }));

    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id, full_name, phone, email, created_at, campaign_id")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: tickets } = await supabaseAdmin
      .from("support_tickets")
      .select("id, subject, status, last_message_at, created_at")
      .eq("user_id", data.user_id)
      .order("last_message_at", { ascending: false });

    const { data: wa } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("status, user_phone, display_phone, activated_at, last_message_at")
      .eq("user_id", data.user_id)
      .maybeSingle();

    return {
      profile: { ...profile, email: authUser?.user?.email ?? null },
      campaigns: campaignsOut,
      leads: leads ?? [],
      tickets: tickets ?? [],
      whatsapp: wa,
    };
  });

export const listAllTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tickets } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, subject, status, last_message_at, created_at")
      .order("last_message_at", { ascending: false })
      .limit(200);

    const ids = Array.from(new Set((tickets ?? []).map((t) => t.user_id)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const nameById = new Map<string, string>();
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name ?? "");

    return {
      tickets: (tickets ?? []).map((t) => ({ ...t, user_name: nameById.get(t.user_id) ?? "" })),
    };
  });

const TicketIdInput = z.object({ ticket_id: z.string().uuid() });

export const getTicketThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TicketIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const isAdminUser = !!admin.data;

    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found");
    if (!isAdminUser && ticket.user_id !== context.userId) throw new Error("Forbidden");

    const { data: messages } = await supabaseAdmin
      .from("support_messages")
      .select("*")
      .eq("ticket_id", data.ticket_id)
      .order("created_at", { ascending: true });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", ticket.user_id)
      .maybeSingle();

    return { ticket, messages: messages ?? [], user_name: profile?.full_name ?? "" };
  });

const AdminReplyInput = z.object({
  ticket_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdminReplyInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCentralWhatsApp, sendWhatsAppMessage } = await import("@/lib/whatsapp.server");

    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, subject")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found");

    // Try to send via WhatsApp
    let sentToWa = false;
    try {
      const wa = getCentralWhatsApp();
      if (wa) {
        const { data: conn } = await supabaseAdmin
          .from("whatsapp_connections")
          .select("user_phone, status")
          .eq("user_id", ticket.user_id)
          .maybeSingle();
        if (conn?.user_phone && conn.status === "active") {
          await sendWhatsAppMessage(wa.phoneNumberId, wa.accessToken, conn.user_phone, {
            type: "text",
            text: `🛟 *Suport AdPilot* — răspuns la tichetul „${ticket.subject}":\n\n${data.body}`,
          });
          // Also log in whatsapp_messages
          await supabaseAdmin.from("whatsapp_messages").insert({
            user_id: ticket.user_id,
            direction: "out",
            msg_type: "text",
            text: `[Suport] ${data.body}`,
            meta: { support_ticket_id: ticket.id },
          });
          sentToWa = true;
        }
      }
    } catch (e) {
      console.error("[adminReplyTicket] WA send failed", e);
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("support_messages")
      .insert({
        ticket_id: data.ticket_id,
        sender: "admin",
        body: data.body,
        sent_to_whatsapp: sentToWa,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("support_tickets")
      .update({ last_message_at: new Date().toISOString(), status: "open" })
      .eq("id", data.ticket_id);

    return { message: inserted, sent_to_whatsapp: sentToWa };
  });

const SetStatusInput = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum(["open", "closed"]),
});

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetStatusInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: data.status })
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SetPlanInput = z.object({
  user_id: z.string().uuid(),
  plan: z.string().min(1).max(50),
  subscription_status: z.enum(["trial", "active", "past_due", "canceled"]),
  trial_ends_at: z.string().nullable().optional(),
});

export const setUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetPlanInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { plan: data.plan, subscription_status: data.subscription_status };
    if (data.trial_ends_at !== undefined) patch.trial_ends_at = data.trial_ends_at;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });