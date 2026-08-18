-- Colectăm numărul de telefon la înregistrare (obligatoriu în formularul de signup).
-- Stocat în auth user_metadata.phone și copiat în profiles.phone de handle_new_user.

alter table public.profiles add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    nullif(trim(NEW.raw_user_meta_data->>'phone'), '')
  );

  if lower(NEW.email) = 'danudda2810@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (NEW.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return NEW;
end;
$function$;
