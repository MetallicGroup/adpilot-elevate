import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await (ctx.supabase as any).rpc("is_admin");
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
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(actorId);
    await (supabaseAdmin as any).from("audit_log").insert({
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
    const { data } = await (context.supabase as any).rpc("is_admin");
    return { admin: !!data };
  });

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
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
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, plan, subscription_status, trial_ends_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const ids = (profiles ?? []).map((p: any) => p.id);
    if (ids.length === 0) return { users: [] as AdminUserRow[] };

    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map<string, string>();
    for (const u of authList?.users ?? []) emailById.set(u.id, u.email ?? "");

    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, user_id, status")
      .in("user_id", ids);
    const campaignsByUser = new Map<string, { total: number; active: number; ids: string[] }>();
    for (const c of (campaigns ?? []) as any[]) {
      const acc = campaignsByUser.get(c.user_id) ?? { total: 0, active: 0, ids: [] };
      acc.total += 1;
      if (c.status === "active") acc.active += 1;
      acc.ids.push(c.id);
      campaignsByUser.set(c.user_id, acc);
    }

    const allCampaignIds = (campaigns ?? []).map((c: any) => c.id);
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

    const users: AdminUserRow[] = (profiles ?? []).map((p: any) => {
      const c = campaignsByUser.get(p.id) ?? { total: 0, active: 0, ids: [] };
      const s = spendByUser.get(p.id) ?? { spend: 0, leads: 0 };
      return {
        id: p.id,
        email: emailById.get(p.id) ?? null,
        full_name: p.full_name,
        phone: p.phone ?? null,
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
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!profile) throw new Error("User not found");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);

    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, platform, status, budget, budget_mode, objective, created_at, meta_campaign_id, creative, targeting, lead_form")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false });

    const ids = (campaigns ?? []).map((c: any) => c.id);
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
    const campaignsOut = (campaigns ?? []).map((c: any) => ({
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
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    const { data: tickets } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, subject, status, priority, last_message_at, created_at")
      .order("last_message_at", { ascending: false })
      .limit(200);

    const ids = Array.from(new Set((tickets ?? []).map((t: any) => t.user_id)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const nameById = new Map<string, string>();
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name ?? "");

    return {
      tickets: (tickets ?? []).map((t: any) => ({ ...t, user_name: nameById.get(t.user_id) ?? "" })),
    };
  });

const TicketIdInput = z.object({ ticket_id: z.string().uuid() });

export const getTicketThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TicketIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const admin = await (context.supabase as any).rpc("is_admin");
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
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
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
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
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
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const patch: any = { plan: data.plan, subscription_status: data.subscription_status };
    if (data.trial_ends_at !== undefined) patch.trial_ends_at = data.trial_ends_at;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "user.plan_changed", "user", data.user_id, patch);
    return { ok: true };
  });

// ====== DASHBOARD KPIs ======
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();

    const [profilesRes, campaignsRes, perfRes, leadsRes, ticketsRes, waConnsRes, signupsRes, subsRes] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, plan, subscription_status, trial_ends_at, created_at, suspended"),
        supabaseAdmin.from("campaigns").select("id, status, platform, created_at"),
        supabaseAdmin.from("performance_data").select("spend, leads, clicks, impressions, date"),
        supabaseAdmin.from("leads").select("id, created_at"),
        supabaseAdmin.from("support_tickets").select("id, status, priority, created_at"),
        supabaseAdmin.from("whatsapp_connections").select("id, status"),
        supabaseAdmin.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo),
        supabaseAdmin
          .from("subscriptions")
          .select("user_id, price_id, status, current_period_end, trial_end, cancel_at_period_end, environment, created_at"),
      ]);

    const profiles = profilesRes.data ?? [];
    const campaigns = campaignsRes.data ?? [];
    const perf = perfRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const tickets = ticketsRes.data ?? [];
    const waConns = waConnsRes.data ?? [];

    const totalSpend = perf.reduce((s: number, p: any) => s + Number(p.spend ?? 0), 0);
    const totalLeads = leads.length;
    const trialUsers = profiles.filter((p: any) => p.subscription_status === "trial").length;
    const activeSubs = profiles.filter((p: any) => p.subscription_status === "active").length;
    const suspendedUsers = profiles.filter((p: any) => p.suspended).length;
    const expiringTrials = profiles.filter((p: any) => {
      if (p.subscription_status !== "trial" || !p.trial_ends_at) return false;
      const ends = new Date(p.trial_ends_at).getTime();
      return ends > now.getTime() && ends < now.getTime() + 3 * 86400_000;
    }).length;

    // Signups by day for last 30 days
    const signupsByDay: Record<string, number> = {};
    for (const s of signupsRes.data ?? []) {
      const day = (s.created_at as string).slice(0, 10);
      signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
    }
    const signupsSeries = Object.entries(signupsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Spend by day last 30 days
    const spendByDay: Record<string, number> = {};
    for (const p of perf) {
      const day = (p.date as string)?.slice(0, 10) ?? "";
      if (!day) continue;
      spendByDay[day] = (spendByDay[day] ?? 0) + Number(p.spend ?? 0);
    }
    const spendSeries = Object.entries(spendByDay)
      .map(([date, spend]) => ({ date, spend }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    // ====== Financiar (din subscriptions; DOAR mediul live, exclus comp) ======
    const monthlyLei = (priceId?: string | null): number => {
      const v = (priceId ?? "").toLowerCase();
      if (!v || v.includes("comp")) return 0; // comp = cont gratuit (admin/propriu)
      if (v.includes("premium")) return 995;
      if (v.includes("pro")) return 495;
      if (v.includes("starter")) return 249;
      return 0;
    };
    const planName = (priceId?: string | null): string => {
      const v = (priceId ?? "").toLowerCase();
      if (v.includes("comp")) return "Comp (gratuit)";
      if (v.includes("premium")) return "Premium";
      if (v.includes("pro")) return "Pro";
      if (v.includes("starter")) return "Starter";
      return "Necunoscut";
    };
    const subs = (subsRes.data ?? []).filter((s: any) => s.environment === "live");
    const payingSubs = subs.filter((s: any) => s.status === "active" && monthlyLei(s.price_id) > 0);
    const trialingSubs = subs.filter(
      (s: any) =>
        s.status === "trialing" ||
        (s.trial_end && new Date(s.trial_end).getTime() > now.getTime() && s.status !== "canceled"),
    );
    const canceledSubs = subs.filter((s: any) => s.status === "canceled");
    const cancelingSubs = subs.filter((s: any) => s.status === "active" && s.cancel_at_period_end);
    const compSubs = subs.filter((s: any) => (s.price_id ?? "").toLowerCase().includes("comp"));
    const mrr = payingSubs.reduce((sum: number, s: any) => sum + monthlyLei(s.price_id), 0);
    const byPlan: Record<string, number> = {};
    for (const s of payingSubs) {
      const n = planName(s.price_id);
      byPlan[n] = (byPlan[n] ?? 0) + 1;
    }

    // ====== Conectări Facebook + sursa înscrierii ======
    const [metaConnsRes, authListRes] = await Promise.all([
      supabaseAdmin
        .from("meta_connections")
        .select("user_id, created_at, is_active, meta_user_name")
        .order("created_at", { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    const activeConns = (metaConnsRes.data ?? []).filter((c: any) => c.is_active);
    const authUsers = authListRes.data?.users ?? [];
    const authById = new Map<string, any>();
    for (const u of authUsers) authById.set(u.id, u);
    const classifySource = (u: any): "facebook" | "google" | "email" =>
      u?.user_metadata?.signup_source === "facebook"
        ? "facebook"
        : u?.app_metadata?.provider === "google"
          ? "google"
          : "email";
    const bySource = { facebook: 0, google: 0, email: 0 };
    for (const u of authUsers) bySource[classifySource(u)]++;
    const fbUserIds = new Set(activeConns.map((c: any) => c.user_id));
    const recentFb = activeConns.slice(0, 10).map((c: any) => {
      const u = authById.get(c.user_id);
      return {
        user_id: c.user_id,
        name: (u?.user_metadata?.full_name as string) ?? c.meta_user_name ?? null,
        email: u?.email ?? null,
        source: u ? classifySource(u) : "email",
        at: c.created_at,
      };
    });

    return {
      kpis: {
        total_users: profiles.length,
        trial_users: trialUsers,
        active_subs: activeSubs,
        suspended_users: suspendedUsers,
        expiring_trials_3d: expiringTrials,
        new_signups_7d: profiles.filter((p: any) => p.created_at >= sevenDaysAgo).length,
        total_campaigns: campaigns.length,
        active_campaigns: campaigns.filter((c: any) => c.status === "active").length,
        meta_campaigns: campaigns.filter((c: any) => c.platform === "meta").length,
        total_spend: totalSpend,
        total_leads: totalLeads,
        open_tickets: tickets.filter((t: any) => t.status === "open").length,
        urgent_tickets: tickets.filter((t: any) => t.status === "open" && t.priority === "urgent").length,
        wa_connected: waConns.filter((w: any) => w.status === "active").length,
        wa_total: waConns.length,
      },
      signups_30d: signupsSeries,
      spend_30d: spendSeries,
      facebook: {
        connected: fbUserIds.size,
        total: profiles.length,
        by_source: bySource,
        recent: recentFb,
      },
      finance: {
        mrr,
        arr: mrr * 12,
        paying: payingSubs.length,
        trialing: trialingSubs.length,
        canceling: cancelingSubs.length,
        canceled: canceledSubs.length,
        comp: compSubs.length,
        by_plan: byPlan,
        currency: "lei",
      },
    };
  });

// ====== USER NOTES / SUSPEND / EXTEND TRIAL ======
const UpdateUserAdminInput = z.object({
  user_id: z.string().uuid(),
  admin_notes: z.string().max(5000).optional(),
  suspended: z.boolean().optional(),
  extend_trial_days: z.number().int().min(0).max(365).optional(),
});

export const updateUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateUserAdminInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const patch: any = {};
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    if (data.suspended !== undefined) patch.suspended = data.suspended;
    if (data.extend_trial_days && data.extend_trial_days > 0) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("trial_ends_at")
        .eq("id", data.user_id)
        .maybeSingle();
      const base = prof?.trial_ends_at ? new Date(prof.trial_ends_at) : new Date();
      base.setDate(base.getDate() + data.extend_trial_days);
      patch.trial_ends_at = base.toISOString();
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "user.admin_update", "user", data.user_id, patch);
    return { ok: true };
  });

// ====== ALL CAMPAIGNS (ADMIN) ======
export const listAllCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, user_id, name, platform, status, budget, objective, created_at, meta_campaign_id")
      .order("created_at", { ascending: false })
      .limit(300);
    const ids = Array.from(new Set((campaigns ?? []).map((c: any) => c.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const nameById = new Map<string, string>();
    for (const p of profs ?? []) nameById.set(p.id, p.full_name ?? "");

    const cIds = (campaigns ?? []).map((c: any) => c.id);
    const spendByCampaign = new Map<string, number>();
    const leadsByCampaign = new Map<string, number>();
    if (cIds.length) {
      const { data: perf } = await supabaseAdmin
        .from("performance_data")
        .select("campaign_id, spend, leads")
        .in("campaign_id", cIds);
      for (const p of perf ?? []) {
        const k = p.campaign_id as string;
        spendByCampaign.set(k, (spendByCampaign.get(k) ?? 0) + Number(p.spend ?? 0));
        leadsByCampaign.set(k, (leadsByCampaign.get(k) ?? 0) + Number(p.leads ?? 0));
      }
    }
    return {
      campaigns: (campaigns ?? []).map((c: any) => ({
        ...c,
        user_name: nameById.get(c.user_id) ?? "",
        spend: spendByCampaign.get(c.id) ?? 0,
        leads: leadsByCampaign.get(c.id) ?? 0,
      })),
    };
  });

// ====== WHATSAPP CONVERSATION VIEWER ======
const ConvInput = z.object({ user_id: z.string().uuid(), limit: z.number().int().min(1).max(500).optional() });

export const getUserWhatsAppConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConvInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { data: messages } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("id, direction, msg_type, text, created_at, meta")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    return { messages: (messages ?? []).reverse() };
  });

// ====== ADMIN MANUAL WA SEND ======
const AdminSendWAInput = z.object({
  user_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const adminSendWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdminSendWAInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { getCentralWhatsApp, sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    const wa = getCentralWhatsApp();
    if (!wa) throw new Error("WhatsApp central neconfigurat");
    const { data: conn } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("user_phone, status")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!conn?.user_phone || conn.status !== "active") throw new Error("Utilizatorul nu are WhatsApp conectat");
    await sendWhatsAppMessage(wa.phoneNumberId, wa.accessToken, conn.user_phone, {
      type: "text",
      text: data.body,
    });
    await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: data.user_id,
      direction: "out",
      msg_type: "text",
      text: data.body,
      meta: { sent_by_admin: context.userId },
    });
    await logAudit(context.userId, "wa.manual_send", "user", data.user_id, { len: data.body.length });
    return { ok: true };
  });

// ====== BROADCAST ======
const BroadcastInput = z.object({
  body: z.string().trim().min(1).max(4000),
  segment: z.enum(["all", "trial", "active", "premium", "pro"]).default("all"),
});

export const createBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BroadcastInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { getCentralWhatsApp, sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    const wa = getCentralWhatsApp();
    if (!wa) throw new Error("WhatsApp central neconfigurat");

    // Find target users
    let query = supabaseAdmin.from("profiles").select("id, plan, subscription_status, suspended");
    if (data.segment === "trial") query = query.eq("subscription_status", "trial");
    else if (data.segment === "active") query = query.eq("subscription_status", "active");
    else if (data.segment === "premium") query = query.eq("plan", "premium");
    else if (data.segment === "pro") query = query.eq("plan", "pro");
    const { data: profs } = await query;
    const userIds = (profs ?? []).filter((p: any) => !p.suspended).map((p: any) => p.id);

    const { data: conns } = userIds.length
      ? await supabaseAdmin
          .from("whatsapp_connections")
          .select("user_id, user_phone, status")
          .in("user_id", userIds)
          .eq("status", "active")
      : { data: [] as any[] };

    const recipients = (conns ?? []).filter((c: any) => c.user_phone);

    const { data: broadcast, error: bErr } = await (supabaseAdmin as any)
      .from("broadcasts")
      .insert({
        created_by: context.userId,
        channel: "whatsapp",
        segment: data.segment,
        body: data.body,
        total_recipients: recipients.length,
        status: "sending",
      })
      .select()
      .single();
    if (bErr) throw new Error(bErr.message);

    let sent = 0;
    let failed = 0;
    const failures: any[] = [];
    for (const r of recipients) {
      try {
        await sendWhatsAppMessage(wa.phoneNumberId, wa.accessToken, r.user_phone, {
          type: "text",
          text: data.body,
        });
        await supabaseAdmin.from("whatsapp_messages").insert({
          user_id: r.user_id,
          direction: "out",
          msg_type: "text",
          text: data.body,
          meta: { broadcast_id: broadcast.id },
        });
        sent++;
        // small delay to avoid WA rate limits
        await new Promise((res) => setTimeout(res, 150));
      } catch (e: any) {
        failed++;
        failures.push({ user_id: r.user_id, error: e?.message ?? String(e) });
      }
    }

    await (supabaseAdmin as any)
      .from("broadcasts")
      .update({
        total_sent: sent,
        total_failed: failed,
        status: "done",
        details: { failures: failures.slice(0, 50) },
      })
      .eq("id", broadcast.id);

    await logAudit(context.userId, "broadcast.sent", "broadcast", broadcast.id, {
      segment: data.segment,
      sent,
      failed,
    });

    return { broadcast_id: broadcast.id, total: recipients.length, sent, failed };
  });

// ====== EMAIL BROADCAST ======
const EmailBroadcastInput = z.object({
  segment: z.enum(["all", "no_fb", "no_campaign"]).default("no_fb"),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(1).max(6000),
  include_proof: z.boolean().default(true),
});

export const sendEmailBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EmailBroadcastInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { runEmailBroadcast } = await import("@/lib/email-broadcast.server");

    // Reply-to = emailul adminului, ca răspunsurile userilor să ajungă la el.
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const replyTo = au?.user?.email ?? undefined;

    const { data: broadcast } = await supabaseAdmin
      .from("broadcasts")
      .insert({
        created_by: context.userId,
        channel: "email",
        segment: data.segment,
        body: `[${data.subject}] ${data.message}`,
        total_recipients: 0,
        status: "sending",
      })
      .select()
      .single();

    const res = await runEmailBroadcast({
      segment: data.segment,
      subject: data.subject,
      message: data.message,
      includeProof: data.include_proof,
      replyTo,
    });

    if (broadcast?.id) {
      await supabaseAdmin
        .from("broadcasts")
        .update({
          total_recipients: res.total,
          total_sent: res.sent,
          total_failed: res.failed,
          status: "done",
        })
        .eq("id", broadcast.id);
    }
    await logAudit(context.userId, "email_broadcast.sent", "broadcast", broadcast?.id ?? null, {
      segment: data.segment,
      ...res,
    });
    return res;
  });

// ====== WHATSAPP TEMPLATE BROADCAST (către useri cu telefon, chiar neconectați) ======
const WaTemplateBroadcastInput = z.object({
  template_name: z.string().trim().min(1).max(100),
  lang_code: z.string().trim().min(2).max(10).default("ro"),
  segment: z.enum(["phone_all", "phone_no_fb"]).default("phone_all"),
  personalize: z.boolean().default(true), // template cu {{1}} = prenume
});

export const sendWhatsAppTemplateBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WaTemplateBroadcastInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { getCentralWhatsApp, sendWhatsAppTemplate } = await import("@/lib/whatsapp.server");
    const wa = getCentralWhatsApp();
    if (!wa) throw new Error("WhatsApp central neconfigurat");

    const [{ data: profs }, { data: conns }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone").not("phone", "is", null),
      supabaseAdmin.from("meta_connections").select("user_id").eq("is_active", true),
    ]);
    const fbUsers = new Set((conns ?? []).map((c: any) => c.user_id));
    const recipients = (profs ?? []).filter((p: any) => {
      const digits = String(p.phone ?? "").replace(/\D/g, "");
      if (digits.length < 10) return false;
      if (data.segment === "phone_no_fb" && fbUsers.has(p.id)) return false;
      return true;
    });

    const { data: broadcast } = await supabaseAdmin
      .from("broadcasts")
      .insert({
        created_by: context.userId,
        channel: "whatsapp_template",
        segment: data.segment,
        body: `template: ${data.template_name} (${data.lang_code})`,
        total_recipients: recipients.length,
        status: "sending",
      })
      .select()
      .single();

    let sent = 0;
    let failed = 0;
    const failures: any[] = [];
    for (const p of recipients) {
      try {
        const first = String(p.full_name ?? "").trim().split(/\s+/)[0] || "acolo";
        const params = data.personalize ? [first] : [];
        const { id } = await sendWhatsAppTemplate(
          wa.phoneNumberId,
          wa.accessToken,
          String(p.phone),
          data.template_name,
          data.lang_code,
          params,
        );
        await supabaseAdmin.from("whatsapp_messages").insert({
          user_id: p.id,
          direction: "out",
          msg_type: "template",
          text: `[template: ${data.template_name}]`,
          wa_message_id: id,
          meta: { broadcast_id: broadcast?.id, template: data.template_name },
        });
        sent++;
        await new Promise((res) => setTimeout(res, 200));
      } catch (e: any) {
        failed++;
        failures.push({ user_id: p.id, error: e?.message ?? String(e) });
      }
    }

    if (broadcast?.id) {
      await supabaseAdmin
        .from("broadcasts")
        .update({ total_sent: sent, total_failed: failed, status: "done", details: { failures: failures.slice(0, 50) } })
        .eq("id", broadcast.id);
    }
    await logAudit(context.userId, "wa_template_broadcast.sent", "broadcast", broadcast?.id ?? null, {
      template: data.template_name,
      segment: data.segment,
      total: recipients.length,
      sent,
      failed,
    });
    return { total: recipients.length, sent, failed };
  });

export const listBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { data } = await (supabaseAdmin as any)
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return { broadcasts: data ?? [] };
  });

// ====== AUDIT LOG ======
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { data } = await (supabaseAdmin as any)
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return { entries: data ?? [] };
  });

// ====== STATUS AI (Anthropic + OpenAI) ======
// Notă: niciun provider nu expune soldul exact prin API cu o cheie normală.
// Facem un probe minim (aproape 0 tokeni) ca să știm dacă mai putem genera:
// cheie validă, fără credit, sau nefuncțional. Soldul exact = consola providerului.
type AiProbe = {
  configured: boolean;
  status: "ok" | "no_credit" | "invalid_key" | "error" | "missing";
  label: string;
  detail?: string;
};

async function probeAnthropic(): Promise<AiProbe> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { configured: false, status: "missing", label: "Cheie lipsă" };
  try {
    const { LLM } = await import("@/lib/llm.server");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: LLM.chat,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    if (res.ok) return { configured: true, status: "ok", label: "Operațional" };
    const body = (await res.text()).toLowerCase();
    if (res.status === 401) return { configured: true, status: "invalid_key", label: "Cheie invalidă" };
    if (body.includes("credit balance") || body.includes("billing"))
      return { configured: true, status: "no_credit", label: "Fără credit", detail: "Reîncarcă în consolă" };
    return { configured: true, status: "error", label: `Eroare ${res.status}` };
  } catch (e: any) {
    return { configured: true, status: "error", label: "Nu răspunde", detail: e?.message };
  }
}

async function probeOpenAi(): Promise<AiProbe> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { configured: false, status: "missing", label: "Cheie lipsă" };
  try {
    // Chat mini, 1 token: revelează și lipsa de credit (429 insufficient_quota).
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    if (res.ok) return { configured: true, status: "ok", label: "Operațional" };
    const body = (await res.text()).toLowerCase();
    if (res.status === 401) return { configured: true, status: "invalid_key", label: "Cheie invalidă" };
    if (body.includes("insufficient_quota") || body.includes("billing") || body.includes("quota"))
      return { configured: true, status: "no_credit", label: "Fără credit", detail: "Reîncarcă în consolă" };
    return { configured: true, status: "error", label: `Eroare ${res.status}` };
  } catch (e: any) {
    return { configured: true, status: "error", label: "Nu răspunde", detail: e?.message };
  }
}

export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [anthropic, openai] = await Promise.all([probeAnthropic(), probeOpenAi()]);
    return { anthropic, openai, checked_at: new Date().toISOString() };
  });

// ====== TICKET PRIORITY ======
const TicketPriorityInput = z.object({
  ticket_id: z.string().uuid(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

export const setTicketPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TicketPriorityInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ priority: data.priority })
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "ticket.priority_changed", "ticket", data.ticket_id, { priority: data.priority });
    return { ok: true };
  });

// ====== CAMPAIGN PAUSE (ADMIN) ======
const CampaignStatusInput = z.object({
  campaign_id: z.string().uuid(),
  status: z.enum(["active", "paused"]),
});

export const adminSetCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CampaignStatusInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: data.status })
      .eq("id", data.campaign_id);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "campaign.status_changed", "campaign", data.campaign_id, { status: data.status });
    return { ok: true };
  });