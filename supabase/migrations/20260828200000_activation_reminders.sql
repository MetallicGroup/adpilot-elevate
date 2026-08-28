-- Drip de activare: urmărim câte remindere am trimis + când.
alter table public.profiles
  add column if not exists activation_step int not null default 0,
  add column if not exists activation_last_sent_at timestamptz;

-- Protejăm coloanele noi (doar service_role/admin le scriu).
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
  NEW.activation_step := OLD.activation_step;
  NEW.activation_last_sent_at := OLD.activation_last_sent_at;
  return NEW;
end;
$function$;

-- Cron orar: trimite reminderele de activare.
do $$
declare tok text;
begin
  select substring(command from 'Bearer ([a-f0-9]+)') into tok
  from cron.job where jobname = 'adpilot-wa-keepalive' limit 1;
  if exists (select 1 from cron.job where jobname = 'adpilot-activation-reminders') then
    perform cron.unschedule('adpilot-activation-reminders');
  end if;
  perform cron.schedule(
    'adpilot-activation-reminders',
    '20 * * * *',
    format(
      $cmd$ select net.http_post(url:='https://www.adpilot.ro/api/public/hooks/activation-reminders',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),body:='{}'::jsonb); $cmd$,
      tok
    )
  );
end $$;

select 'done' as status;
create or replace function public.get_activation_candidates()
returns table(user_id uuid, email text, full_name text, activation_step int)
language sql
security definer
set search_path to 'public'
as $fn$
  select p.id, u.email::text, p.full_name, p.activation_step
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email_confirmed_at is not null
    and u.email is not null
    and u.created_at <= now() - interval '24 hours'
    and u.created_at >= now() - interval '7 days'
    and p.activation_step < 3
    and (p.activation_last_sent_at is null or p.activation_last_sent_at < now() - interval '22 hours')
    and not exists (select 1 from public.meta_connections mc where mc.user_id = p.id and mc.is_active = true)
  order by u.created_at asc
  limit 200;
$fn$;
revoke all on function public.get_activation_candidates() from anon, authenticated;
select 'fn creata' as s;
