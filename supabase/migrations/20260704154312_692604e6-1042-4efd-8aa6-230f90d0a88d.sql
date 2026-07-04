-- Add campaign link to WhatsApp messages and opt-out flag on connections
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wa_messages_campaign_id
  ON public.whatsapp_messages(campaign_id);

CREATE INDEX IF NOT EXISTS idx_wa_messages_user_created
  ON public.whatsapp_messages(user_id, created_at DESC);

ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS keepalive_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;