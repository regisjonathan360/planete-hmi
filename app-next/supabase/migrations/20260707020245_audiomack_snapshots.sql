-- =========================================================
-- Planète HMI — Audiomack : tables de snapshots
-- Stockage hebdomadaire du classement Weekly 100: Haiti.
-- =========================================================

create table if not exists chart_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  country_code text not null,
  chart_name text not null,
  source_url text not null,
  source_updated_at timestamptz,
  collected_at timestamptz not null default now(),
  content_hash text,
  status text not null default 'success',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  -- Éviter les snapshots identiques successifs
  unique (platform, country_code, chart_name, content_hash)
);

create index chart_snapshots_platform_collected_idx
  on chart_snapshots (platform, country_code, collected_at desc);

create table if not exists chart_snapshot_entries (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references chart_snapshots(id) on delete cascade,
  platform_track_id text,
  rank integer not null,
  previous_rank integer,
  rank_change integer,
  title text not null,
  artist_name text not null,
  artwork_url text,
  source_track_url text,
  artist_slug text,
  track_slug text,
  album_name text,
  genre text,
  is_new boolean not null default false,
  weeks_on_chart integer not null default 1,
  peak_rank integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, rank)
);

-- RLS : lecture publique
alter table chart_snapshots enable row level security;
alter table chart_snapshot_entries enable row level security;

create policy "public read snapshots"
  on chart_snapshots for select using (status = 'success');
create policy "public read snapshot entries"
  on chart_snapshot_entries for select
  using (exists (
    select 1 from chart_snapshots s
    where s.id = chart_snapshot_entries.snapshot_id and s.status = 'success'
  ));
create policy "admin manage snapshots"
  on chart_snapshots for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage snapshot entries"
  on chart_snapshot_entries for all using (public.is_admin()) with check (public.is_admin());

grant select on chart_snapshots to anon, authenticated;
grant select on chart_snapshot_entries to anon, authenticated;
