-- Free Starter (3 zile/lună, fără card): coloane de urmărire pe profiles.
alter table public.profiles
  add column if not exists free_plan_month text,
  add column if not exists free_plan_started_at timestamptz,
  add column if not exists free_plan_notified_at timestamptz;

-- Blochează coloanele noi pentru non-service-role / non-admin (userii nu-și pot
-- auto-acorda plan gratuit); backend-ul (service_role) le scrie liber.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  NEW.free_plan_month := OLD.free_plan_month;
  NEW.free_plan_started_at := OLD.free_plan_started_at;
  NEW.free_plan_notified_at := OLD.free_plan_notified_at;
  return NEW;
end;
$function$;

-- Cron: la fiecare 30 min verifică granturile gratuite consumate și trimite
-- mesajul pe WhatsApp. Reia token-ul de autorizare din job-ul existent.
do $$
declare tok text;
begin
  select substring(command from 'Bearer ([a-f0-9]+)') into tok
  from cron.job where jobname = 'adpilot-wa-keepalive' limit 1;

  if exists (select 1 from cron.job where jobname = 'adpilot-free-plan-expiry') then
    perform cron.unschedule('adpilot-free-plan-expiry');
  end if;

  perform cron.schedule(
    'adpilot-free-plan-expiry',
    '*/30 * * * *',
    format(
      $cmd$ select net.http_post(url:='https://www.adpilot.ro/api/public/hooks/free-plan-expiry',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),body:='{}'::jsonb); $cmd$,
      tok
    )
  );
end $$;

select 'done' as status;
