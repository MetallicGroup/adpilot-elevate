CREATE TABLE public.meta_warmup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested integer NOT NULL,
  ok integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  stopped boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_warmup_runs_user_created_idx ON public.meta_warmup_runs (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.meta_warmup_runs TO authenticated;
GRANT ALL ON public.meta_warmup_runs TO service_role;
ALTER TABLE public.meta_warmup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own warmup select" ON public.meta_warmup_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own warmup insert" ON public.meta_warmup_runs FOR INSERT WITH CHECK (auth.uid() = user_id);