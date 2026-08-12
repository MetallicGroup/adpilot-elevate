-- 1) Invoker-privilege admin helper (relies on user_roles own-row SELECT policy)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 2) Repoint admin policies to is_admin()
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins manage all tickets" ON public.support_tickets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins all ticket msgs" ON public.support_messages;
CREATE POLICY "Admins all ticket msgs" ON public.support_messages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins view audit log" ON public.audit_log;
CREATE POLICY "Admins view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view broadcasts" ON public.broadcasts;
CREATE POLICY "Admins view broadcasts" ON public.broadcasts FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view all campaigns" ON public.campaigns;
CREATE POLICY "Admins view all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view all leads" ON public.leads;
CREATE POLICY "Admins view all leads" ON public.leads FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view all wa_messages" ON public.whatsapp_messages;
CREATE POLICY "Admins view all wa_messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view all wa_connections" ON public.whatsapp_connections;
CREATE POLICY "Admins view all wa_connections" ON public.whatsapp_connections FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view all performance" ON public.performance_data;
CREATE POLICY "Admins view all performance" ON public.performance_data FOR SELECT TO authenticated USING (public.is_admin());

-- 3) Signed-in users can no longer execute the SECURITY DEFINER role function
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;

-- 4) Column-level restriction for anonymous reads on public booking pages
REVOKE SELECT ON public.booking_campaigns FROM anon;
GRANT SELECT (id, slug, service, offer, landing_copy, hero_image_url, business_id, status, objective, call_phone, created_at)
  ON public.booking_campaigns TO anon;

REVOKE SELECT ON public.booking_questions FROM anon;
GRANT SELECT (id, booking_campaign_id, key, label, type, options, required, help_text, position, created_at)
  ON public.booking_questions TO anon;
