-- 1. Revoke direct column access to OAuth tokens for client roles.
REVOKE SELECT (access_token, token_expires_at) ON public.meta_connections FROM authenticated, anon;
REVOKE SELECT (page_access_token) ON public.meta_pages FROM authenticated, anon;

-- 2. Lock down user_roles: only service_role can mutate; authenticated keeps SELECT (existing policy).
CREATE POLICY "Only service role can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Only service role can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Only service role can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (false);
