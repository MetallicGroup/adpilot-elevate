-- 1) Prevent privilege escalation via self-update on profiles
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (backend/webhooks) and admins may change anything
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.subscription_status := OLD.subscription_status;
  NEW.suspended := OLD.suspended;
  NEW.admin_notes := OLD.admin_notes;
  NEW.trial_ends_at := OLD.trial_ends_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_protect_privileged ON public.profiles;
CREATE TRIGGER trg_profiles_protect_privileged
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 2) Remove direct EXECUTE for signed-in users on the SECURITY DEFINER role helper.
-- RLS policies referencing it keep working because policy expressions are
-- evaluated with the table owner's rights.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;