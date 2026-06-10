-- Per-user folder access on ad-media bucket
CREATE POLICY "Users read own ad-media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own ad-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own ad-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own ad-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-media' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS meta_lead_form_id text;