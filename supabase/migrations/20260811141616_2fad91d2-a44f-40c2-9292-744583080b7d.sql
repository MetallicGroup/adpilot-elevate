-- 1) Hide internal admin notes from the account owner via column-level grants
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, plan, created_at, updated_at, trial_ends_at, subscription_status, suspended)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2) Signed-in users must not call this SECURITY DEFINER helper directly (no RLS policy uses it)
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;

-- 3) has_role must stay callable by authenticated (RLS policies depend on it),
--    but restrict it so a signed-in user can only ask about their own roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  )
$$;