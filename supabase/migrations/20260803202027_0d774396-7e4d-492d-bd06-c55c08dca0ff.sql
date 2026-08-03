REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;

CREATE POLICY "Users insert own meta connections"
ON public.meta_connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own meta connections"
ON public.meta_connections FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own meta ad accounts" ON public.meta_ad_accounts;
CREATE POLICY "Users view own meta ad accounts" ON public.meta_ad_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own meta ad accounts" ON public.meta_ad_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own meta ad accounts" ON public.meta_ad_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own meta ad accounts" ON public.meta_ad_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);