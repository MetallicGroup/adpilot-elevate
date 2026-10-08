-- Oferta de înscriere trece de la 30 la 7 zile gratuite (de la crearea contului).
-- Se aplică la lansarea redesign-ului, NU înainte: conturile existente trec și ele
-- la 7 zile de la creare, deci cele mai vechi de 7 zile pierd accesul gratuit.

create or replace function public.set_signup_trial_defaults()
returns trigger language plpgsql as $fn$
begin
  if NEW.signup_trial_ends_at is null then
    NEW.signup_trial_ends_at := coalesce(NEW.created_at, now()) + interval '7 days';
  end if;
  if NEW.pay_token is null then
    NEW.pay_token := gen_random_uuid();
  end if;
  return NEW;
end;
$fn$;

-- Conturile existente: 7 zile de la creare (rulat ca service_role, altfel trigger-ul
-- protect_profile_privileged_columns anulează modificarea).
set role service_role;
update public.profiles set signup_trial_ends_at = created_at + interval '7 days';
reset role;
