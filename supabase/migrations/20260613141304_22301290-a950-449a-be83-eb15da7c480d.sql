
CREATE POLICY "WA media: users read own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'wa-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "WA media: users insert own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wa-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "WA media: users delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wa-media' AND (storage.foldername(name))[1] = auth.uid()::text);
