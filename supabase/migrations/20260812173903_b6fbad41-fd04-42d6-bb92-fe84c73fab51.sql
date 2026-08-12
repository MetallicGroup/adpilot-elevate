select vault.create_secret('918680ae6e00a398cda65aeb9c6c26f8c8c13702a4afcc81', 'adpilot_signup_hook_secret', 'Shared secret for the new-signup WhatsApp alert hook');

create or replace function public.notify_new_signup()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://project--5785506e-f54a-4fa0-9cd0-b98a0a8bf624.lovable.app/api/public/hooks/new-signup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-signup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'adpilot_signup_hook_secret')
      ),
      body := jsonb_build_object('user_id', NEW.id, 'full_name', NEW.full_name)
    );
  exception when others then
    raise warning 'notify_new_signup failed: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists trg_profiles_notify_signup on public.profiles;
create trigger trg_profiles_notify_signup
after insert on public.profiles
for each row execute function public.notify_new_signup();