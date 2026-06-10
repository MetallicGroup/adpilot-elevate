import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getLeadTimeline,
  leadsToCsv,
  listCrmLeads,
  updateLeadNotes,
  updateLeadStatus,
} from "@/lib/crm/leads.service";
import { syncMetaLeads } from "@/lib/meta/leads";
import type { LeadStatus } from "@/lib/launcher/types";

export const syncAllLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const meta = await syncMetaLeads(context.userId);
    const leads = await listCrmLeads(context.userId);
    return { synced: meta.synced, leads };
  });

export const getCrmLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.string().optional(),
        platform: z.string().optional(),
        search: z.string().optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return listCrmLeads(context.userId, {
      status: data?.status as LeadStatus | undefined,
      platform: data?.platform,
      search: data?.search,
    });
  });

export const setLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ lead_id: z.string().uuid(), status: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await updateLeadStatus(context.userId, data.lead_id, data.status as LeadStatus);
    return { ok: true };
  });

export const setLeadNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ lead_id: z.string().uuid(), notes: z.string().max(5000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await updateLeadNotes(context.userId, data.lead_id, data.notes);
    return { ok: true };
  });

export const getLeadHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ lead_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return getLeadTimeline(context.userId, data.lead_id);
  });

export const exportLeadsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const leads = await listCrmLeads(context.userId);
    return { csv: leadsToCsv(leads) };
  });

export const linkWhatsAppPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ phone: z.string().min(8).max(20) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.replace(/\D/g, "");
    const { error } = await supabaseAdmin.from("user_whatsapp_phones").upsert(
      { user_id: context.userId, phone, verified: true },
      { onConflict: "user_id,phone" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
