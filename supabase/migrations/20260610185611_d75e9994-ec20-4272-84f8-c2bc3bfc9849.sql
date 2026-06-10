GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_pages TO authenticated;
GRANT ALL ON public.meta_pages TO service_role;

CREATE POLICY "Users update own meta pages" ON public.meta_pages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users insert own meta pages" ON public.meta_pages FOR INSERT WITH CHECK (auth.uid() = user_id);