-- Webhook-ul de înscriere face mai multe apeluri (Meta CAPI, alerte WhatsApp/email): 5s (implicit) nu ajung.
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
      ),
      timeout_milliseconds := 30000
    );
  exception when others then
    raise warning 'notify_new_signup failed: %', sqlerrm;
  end;
  return null;
end;
$$;
