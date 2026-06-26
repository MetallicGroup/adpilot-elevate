
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS meta jsonb;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS last_anomaly_check_at timestamptz;

ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS last_daily_report_at timestamptz;
