-- meta_ad_accounts avea trigger-ul `meta_ad_accounts_touch` (touch_updated_at)
-- care setează NEW.updated_at, dar tabelul nu avea coloana → orice UPDATE
-- (ex. selectarea contului activ) eșua cu: record "new" has no field "updated_at".
alter table public.meta_ad_accounts
  add column if not exists updated_at timestamptz not null default now();
