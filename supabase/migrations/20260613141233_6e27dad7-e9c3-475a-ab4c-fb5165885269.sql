
CREATE TABLE public.whatsapp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL UNIQUE,
  waba_id TEXT,
  display_phone TEXT,
  access_token TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_connections TO authenticated;
GRANT ALL ON public.whatsapp_connections TO service_role;

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own WA connections"
ON public.whatsapp_connections FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER whatsapp_connections_touch
BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  wa_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  msg_type TEXT NOT NULL DEFAULT 'text',
  text TEXT,
  media_path TEXT,
  media_mime TEXT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_messages_user_created_idx
  ON public.whatsapp_messages (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own WA messages"
ON public.whatsapp_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own WA messages"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);
