alter table public.profiles disable trigger trg_profiles_protect_privileged;
update public.profiles set plan='pro', subscription_status='active' where id='abf02ca8-b2a7-4d00-9f0f-faa4067f9fb5';
alter table public.profiles enable trigger trg_profiles_protect_privileged;