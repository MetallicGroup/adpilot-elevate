DROP POLICY IF EXISTS "Public reads published booking campaigns" ON public.booking_campaigns;
REVOKE SELECT ON public.booking_campaigns FROM anon;