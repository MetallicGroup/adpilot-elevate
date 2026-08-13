-- Idempotency for inbound WhatsApp messages.
-- Meta redelivers webhook events (notably when a handler is slow and the
-- request times out). Without a guard, a redelivered message could relaunch
-- the same campaign or resend the same reply. A partial unique index on the
-- inbound wa_message_id turns the "persist incoming" insert into an atomic
-- idempotency claim: the retry that loses the race gets a 23505 and is skipped.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_inbound_msgid_uniq
  ON public.whatsapp_messages (wa_message_id)
  WHERE direction = 'in' AND wa_message_id IS NOT NULL;
