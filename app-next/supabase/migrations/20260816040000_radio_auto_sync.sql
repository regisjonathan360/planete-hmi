-- Configuration de la collecte automatique des previews audio pour la radio.
alter table public.radio_config
  add column if not exists auto_sync_enabled boolean not null default true,
  add column if not exists auto_source_key text default 'deezer_haiti_top100',
  add column if not exists last_auto_sync_at timestamptz,
  add column if not exists last_auto_sync_status text,
  add column if not exists last_auto_sync_error text;

update public.radio_config
set auto_sync_enabled = coalesce(auto_sync_enabled, true),
    auto_source_key = coalesce(nullif(auto_source_key, ''), 'deezer_haiti_top100')
where auto_sync_enabled is null or auto_source_key is null or auto_source_key = '';
