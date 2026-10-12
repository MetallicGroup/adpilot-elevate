-- Referral tracking for sales agents (e.g. ?ref=Cristian on signup).

alter table public.profiles
  add column if not exists referral_code text;

comment on column public.profiles.referral_code is
  'Sales/partner referral code captured at signup (from ?ref= or utm_campaign).';

-- Block owners from changing attribution after signup.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'service_role'
     or auth.role() = 'service_role'
     or public.has_role(auth.uid(), 'admin') then
    return NEW;
  end if;

  NEW.plan := OLD.plan;
  NEW.subscription_status := OLD.subscription_status;
  NEW.suspended := OLD.suspended;
  NEW.admin_notes := OLD.admin_notes;
  NEW.trial_ends_at := OLD.trial_ends_at;
  NEW.referral_code := OLD.referral_code;
  return NEW;
end;
$$;

revoke update (referral_code) on public.profiles from authenticated, anon;

-- Copy referral_code from auth user_metadata at profile create.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, phone, referral_code)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    nullif(trim(NEW.raw_user_meta_data->>'phone'), ''),
    nullif(trim(NEW.raw_user_meta_data->>'referral_code'), '')
  );

  if lower(NEW.email) = 'danudda2810@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (NEW.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return NEW;
end;
$function$;

-- Include referral in the admin signup webhook payload; point at prod.
create or replace function public.notify_new_signup()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://www.adpilot.ro/api/public/hooks/new-signup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-signup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'adpilot_signup_hook_secret')
      ),
      body := jsonb_build_object(
        'user_id', NEW.id,
        'full_name', NEW.full_name,
        'phone', NEW.phone,
        'referral_code', NEW.referral_code
      )
    );
  exception when others then
    raise warning 'notify_new_signup failed: %', sqlerrm;
  end;
  return null;
end;
$$;
