-- =========================================================
-- Planète HMI — Module Classements : schéma de base
-- Toutes les dates sont en UTC (timestamptz).
-- =========================================================

-- ---------- Types ----------
create type artist_haitian_status as enum (
  'verified_haitian',
  'verified_haitian_diaspora',
  'verified_haitian_group',
  'pending_review',
  'insufficient_evidence',
  'rejected'
);

-- ---------- Artistes ----------
create table artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  haitian_status artist_haitian_status not null default 'pending_review',
  country_code text,
  is_active boolean not null default true,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column artists.haitian_status is 'Statut vérifié d''appartenance haïtienne (base de l''éligibilité).';

-- ---------- Chansons ----------
create table tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  normalized_title text not null,
  isrc text,
  track_family_id uuid,
  release_date date,
  duration_ms integer,
  default_artwork_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tracks_isrc_uidx on tracks (isrc) where isrc is not null;
create index tracks_normalized_title_idx on tracks (normalized_title);
create index tracks_release_date_idx on tracks (release_date);
comment on column tracks.track_family_id is 'Regroupe les versions équivalentes (single/album, audio/vidéo, clean/explicit confirmés).';

-- ---------- Chanson ↔ Artistes ----------
create table track_artists (
  track_id uuid not null references tracks (id) on delete cascade,
  artist_id uuid not null references artists (id) on delete cascade,
  role text not null, -- primary | co_primary | featured | producer | remixer | composer
  billing_order integer,
  created_at timestamptz not null default now(),
  primary key (track_id, artist_id, role)
);

-- ---------- Correspondances par plateforme ----------
create table platform_tracks (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references tracks (id) on delete set null,
  platform text not null, -- youtube | spotify | audiomack | apple_music | tiktok
  external_id text not null,
  external_url text,
  platform_title text,
  platform_artist_text text,
  isrc text,
  duration_ms integer,
  artwork_url text,
  match_status text,
  match_confidence numeric,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_id)
);

-- ---------- Sources de classement ----------
create table chart_sources (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  source_key text unique not null,
  display_name text not null,
  chart_context text,
  market_code text,
  genre_id text,
  ingestion_mode text not null, -- OFFICIAL_API | OFFICIAL_EXPORT | VERIFIED_ADMIN_IMPORT | PARTNER_FEED | DISABLED
  source_url text,
  is_enabled boolean not null default true,
  is_automatic boolean not null default false,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Éditions hebdomadaires ----------
create table chart_editions (
  id uuid primary key default gen_random_uuid(),
  chart_source_id uuid not null references chart_sources (id) on delete cascade,
  edition_key text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  source_updated_at timestamptz,
  collected_at timestamptz,
  validated_at timestamptz,
  published_at timestamptz,
  status text not null default 'draft',
  -- draft|collecting|imported|matching|needs_review|validated|ready|published|failed|stale|archived
  entry_count integer not null default 0,
  is_stale boolean not null default false,
  validation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chart_source_id, period_start, period_end)
);
create index chart_editions_status_idx on chart_editions (status);
create index chart_editions_source_period_idx on chart_editions (chart_source_id, period_start desc);

-- ---------- Entrées d'une édition ----------
create table chart_entries (
  id uuid primary key default gen_random_uuid(),
  chart_edition_id uuid not null references chart_editions (id) on delete cascade,
  track_id uuid references tracks (id) on delete set null,
  platform_track_id uuid references platform_tracks (id) on delete set null,
  source_position integer not null,
  filtered_position integer,
  previous_filtered_position integer,
  peak_filtered_position integer,
  weeks_on_chart integer,
  consecutive_weeks integer,
  movement integer,
  entry_status text, -- new | up | down | stable | reentry | exit
  metric_value numeric,
  metric_unit text,
  raw_artist_text text,
  raw_track_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chart_edition_id, track_id),
  unique (chart_edition_id, filtered_position)
);
comment on column chart_entries.source_position is 'Position d''origine sur la plateforme — jamais modifiée.';
comment on column chart_entries.filtered_position is 'Position Planète HMI (1..20) après filtrage haïtien.';

-- ---------- Imports administratifs ----------
create table chart_imports (
  id uuid primary key default gen_random_uuid(),
  chart_source_id uuid references chart_sources (id) on delete set null,
  uploaded_by uuid,
  original_filename text,
  file_hash text,
  raw_payload jsonb,
  row_count integer,
  valid_row_count integer,
  invalid_row_count integer,
  status text,
  created_at timestamptz not null default now()
);

-- ---------- File de correspondance (vérification humaine) ----------
create table chart_match_queue (
  id uuid primary key default gen_random_uuid(),
  chart_import_id uuid references chart_imports (id) on delete cascade,
  raw_entry jsonb,
  suggested_track_id uuid,
  confidence numeric,
  resolution_status text default 'pending',
  resolved_track_id uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Journal des exécutions de synchronisation ----------
create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  chart_source_id uuid references chart_sources (id) on delete set null,
  run_type text,
  started_at timestamptz,
  finished_at timestamptz,
  status text,
  records_received integer,
  records_normalized integer,
  records_matched integer,
  records_rejected integer,
  error_code text,
  error_message text,
  metadata jsonb
);

-- ---------- Journal d'audit administratif ----------
create table chart_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- Déclencheur updated_at ----------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_artists_updated before update on artists
  for each row execute function set_updated_at();
create trigger trg_tracks_updated before update on tracks
  for each row execute function set_updated_at();
create trigger trg_platform_tracks_updated before update on platform_tracks
  for each row execute function set_updated_at();
create trigger trg_chart_sources_updated before update on chart_sources
  for each row execute function set_updated_at();
create trigger trg_chart_editions_updated before update on chart_editions
  for each row execute function set_updated_at();
create trigger trg_chart_entries_updated before update on chart_entries
  for each row execute function set_updated_at();
