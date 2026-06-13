
-- Make legacy per-user Meta credentials optional
ALTER TABLE public.whatsapp_connections
  ALTER COLUMN phone_number_id DROP NOT NULL,
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN verify_token DROP NOT NULL;

-- Drop unique on legacy phone_number_id (no longer set)
ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_phone_number_id_key;

-- Add shared-number fields
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS user_phone TEXT,
  ADD COLUMN IF NOT EXISTS activation_code TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Default status to 'pending' instead of 'active'
ALTER TABLE public.whatsapp_connections
  ALTER COLUMN status SET DEFAULT 'pending';

-- One row per user
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_user_id_uniq
  ON public.whatsapp_connections (user_id);

-- Phone & activation lookups
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_user_phone_uniq
  ON public.whatsapp_connections (user_phone) WHERE user_phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_activation_code_uniq
  ON public.whatsapp_connections (activation_code) WHERE activation_code IS NOT NULL;
