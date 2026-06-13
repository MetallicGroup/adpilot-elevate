import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, subject, status, last_message_at, created_at")
      .eq("user_id", context.userId)
      .order("last_message_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tickets: data ?? [] };
  });

const CreateTicketInput = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(4000),
});

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTicketInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase
      .from("support_tickets")
      .insert({ user_id: context.userId, subject: data.subject })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await context.supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender: "user",
      body: data.body,
    });
    if (mErr) throw new Error(mErr.message);
    return { ticket };
  });

const TicketIdInput = z.object({ ticket_id: z.string().uuid() });

export const getMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TicketIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticket_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket not found");
    const { data: messages } = await context.supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", data.ticket_id)
      .order("created_at", { ascending: true });
    return { ticket, messages: messages ?? [] };
  });

const AddMsgInput = z.object({
  ticket_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const addMyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddMsgInput.parse(d))
  .handler(async ({ data, context }) => {
    // Verify ownership via RLS by reading first
    const { data: ticket } = await context.supabase
      .from("support_tickets")
      .select("id, user_id")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!ticket || ticket.user_id !== context.userId) throw new Error("Forbidden");
    const { data: msg, error } = await context.supabase
      .from("support_messages")
      .insert({ ticket_id: data.ticket_id, sender: "user", body: data.body })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase
      .from("support_tickets")
      .update({ last_message_at: new Date().toISOString(), status: "open" })
      .eq("id", data.ticket_id);
    return { message: msg };
  });