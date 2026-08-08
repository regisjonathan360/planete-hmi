-- =========================================================
-- Planète HMI — ALL MIGRATIONS COMBINED (Idempotent)
-- Safe to run on hosted Supabase that already has some tables.
-- Generated from 15 migration files in order.
-- =========================================================

-- =========================================================
-- Migration 1: 20260706044049_create_charts_schema.sql
-- =========================================================

-- ---------- Types ----------
DO $$ BEGIN
  CREATE TYPE artist_haitian_status AS ENUM (
    'verified_haitian',
    'verified_haitian_diaspora',
    'verified_haitian_group',
    'pending_review',
    'insufficient_evidence',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Artistes ----------
CREATE TABLE IF NOT EXISTS artists (
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
COMMENT ON COLUMN artists.haitian_status IS 'Statut vérifié d''appartenance haïtienne (base de l''éligibilité).';

-- ---------- Chansons ----------
CREATE TABLE IF NOT EXISTS tracks (
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
CREATE UNIQUE INDEX IF NOT EXISTS tracks_isrc_uidx ON tracks (isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracks_normalized_title_idx ON tracks (normalized_title);
CREATE INDEX IF NOT EXISTS tracks_release_date_idx ON tracks (release_date);
COMMENT ON COLUMN tracks.track_family_id IS 'Regroupe les versions équivalentes (single/album, audio/vidéo, clean/explicit confirmés).';

-- ---------- Chanson ↔ Artistes ----------
CREATE TABLE IF NOT EXISTS track_artists (
  track_id uuid not null references tracks (id) on delete cascade,
  artist_id uuid not null references artists (id) on delete cascade,
  role text not null,
  billing_order integer,
  created_at timestamptz not null default now(),
  primary key (track_id, artist_id, role)
);

-- ---------- Correspondances par plateforme ----------
CREATE TABLE IF NOT EXISTS platform_tracks (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references tracks (id) on delete set null,
  platform text not null,
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
CREATE TABLE IF NOT EXISTS chart_sources (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  source_key text unique not null,
  display_name text not null,
  chart_context text,
  market_code text,
  genre_id text,
  ingestion_mode text not null,
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
CREATE TABLE IF NOT EXISTS chart_editions (
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
  entry_count integer not null default 0,
  is_stale boolean not null default false,
  validation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chart_source_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS chart_editions_status_idx ON chart_editions (status);
CREATE INDEX IF NOT EXISTS chart_editions_source_period_idx ON chart_editions (chart_source_id, period_start desc);

-- ---------- Entrées d'une édition ----------
CREATE TABLE IF NOT EXISTS chart_entries (
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
  entry_status text,
  metric_value numeric,
  metric_unit text,
  raw_artist_text text,
  raw_track_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chart_edition_id, track_id),
  unique (chart_edition_id, filtered_position)
);
COMMENT ON COLUMN chart_entries.source_position IS 'Position d''origine sur la plateforme — jamais modifiée.';
COMMENT ON COLUMN chart_entries.filtered_position IS 'Position Planète HMI (1..20) après filtrage haïtien.';

-- ---------- Imports administratifs ----------
CREATE TABLE IF NOT EXISTS chart_imports (
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

-- ---------- File de correspondance ----------
CREATE TABLE IF NOT EXISTS chart_match_queue (
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
CREATE TABLE IF NOT EXISTS sync_runs (
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
CREATE TABLE IF NOT EXISTS chart_audit_logs (
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
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- Triggers (safe: drop if exists then create)
DROP TRIGGER IF EXISTS trg_artists_updated ON artists;
CREATE TRIGGER trg_artists_updated BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tracks_updated ON tracks;
CREATE TRIGGER trg_tracks_updated BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_platform_tracks_updated ON platform_tracks;
CREATE TRIGGER trg_platform_tracks_updated BEFORE UPDATE ON platform_tracks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chart_sources_updated ON chart_sources;
CREATE TRIGGER trg_chart_sources_updated BEFORE UPDATE ON chart_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chart_editions_updated ON chart_editions;
CREATE TRIGGER trg_chart_editions_updated BEFORE UPDATE ON chart_editions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chart_entries_updated ON chart_entries;
CREATE TRIGGER trg_chart_entries_updated BEFORE UPDATE ON chart_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- Migration 2: 20260706173846_create_charts_rls.sql
-- =========================================================

-- ---------- Rôles applicatifs ----------
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);
COMMENT ON TABLE user_roles IS 'Attribution de rôles applicatifs (ex. admin) aux utilisateurs Supabase Auth.';

-- Fonctions helper RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.edition_is_published(edition uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chart_editions e
    WHERE e.id = edition AND e.status = 'published'
  );
$$;

-- ---------- Activer la RLS partout ----------
ALTER TABLE artists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_artists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tracks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_editions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_imports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_match_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_audit_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- LECTURE PUBLIQUE — données publiées (safe: DROP + CREATE)
-- =========================================================

DROP POLICY IF EXISTS "public read published editions" ON chart_editions;
CREATE POLICY "public read published editions"
  ON chart_editions FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "public read entries of published editions" ON chart_entries;
CREATE POLICY "public read entries of published editions"
  ON chart_entries FOR SELECT
  USING (public.edition_is_published(chart_edition_id));

DROP POLICY IF EXISTS "public read enabled sources" ON chart_sources;
CREATE POLICY "public read enabled sources"
  ON chart_sources FOR SELECT
  USING (is_enabled = true);

DROP POLICY IF EXISTS "public read tracks in published entries" ON tracks;
CREATE POLICY "public read tracks in published entries"
  ON tracks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chart_entries ce
    WHERE ce.track_id = tracks.id
      AND public.edition_is_published(ce.chart_edition_id)
  ));

DROP POLICY IF EXISTS "public read artists in published entries" ON artists;
CREATE POLICY "public read artists in published entries"
  ON artists FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM track_artists ta
    JOIN chart_entries ce ON ce.track_id = ta.track_id
    WHERE ta.artist_id = artists.id
      AND public.edition_is_published(ce.chart_edition_id)
  ));

DROP POLICY IF EXISTS "public read track_artists in published entries" ON track_artists;
CREATE POLICY "public read track_artists in published entries"
  ON track_artists FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chart_entries ce
    WHERE ce.track_id = track_artists.track_id
      AND public.edition_is_published(ce.chart_edition_id)
  ));

DROP POLICY IF EXISTS "public read platform_tracks in published entries" ON platform_tracks;
CREATE POLICY "public read platform_tracks in published entries"
  ON platform_tracks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chart_entries ce
    WHERE ce.platform_track_id = platform_tracks.id
      AND public.edition_is_published(ce.chart_edition_id)
  ));

-- =========================================================
-- ÉCRITURE / LECTURE COMPLÈTE — ADMINISTRATEURS
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'artists','tracks','track_artists','platform_tracks','chart_sources',
    'chart_editions','chart_entries','chart_imports','chart_match_queue',
    'sync_runs','chart_audit_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admin manage ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());',
      'admin manage ' || t, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "admin manage user_roles" ON user_roles;
CREATE POLICY "admin manage user_roles"
  ON user_roles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =========================================================
-- GRANTS
-- =========================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON
  chart_editions, chart_entries, chart_sources,
  tracks, artists, track_artists, platform_tracks
TO anon, authenticated;


-- =========================================================
-- Migration 3: 20260706184453_create_charts_read_api.sql
-- =========================================================

-- Vue publique enrichie
CREATE OR REPLACE VIEW chart_public_entries
WITH (security_invoker = true) AS
SELECT
  ce.id                    AS entry_id,
  cs.source_key,
  cs.platform,
  cs.display_name          AS source_display_name,
  cs.chart_context,
  cs.market_code,
  cs.ingestion_mode,
  cs.is_automatic,
  e.id                     AS edition_id,
  e.period_start,
  e.period_end,
  e.published_at,
  e.source_updated_at,
  e.is_stale,
  ce.filtered_position,
  ce.source_position,
  ce.previous_filtered_position,
  ce.peak_filtered_position,
  ce.weeks_on_chart,
  ce.consecutive_weeks,
  ce.movement,
  ce.entry_status,
  ce.metric_value,
  ce.metric_unit,
  t.id                     AS track_id,
  t.title                  AS track_title,
  t.default_artwork_url,
  coalesce(pt.external_url, null) AS platform_url,
  coalesce(pt.artwork_url, t.default_artwork_url) AS artwork_url,
  (
    SELECT string_agg(a.name, ', ' ORDER BY ta.billing_order)
    FROM track_artists ta
    JOIN artists a ON a.id = ta.artist_id
    WHERE ta.track_id = t.id AND ta.role IN ('primary','co_primary')
  ) AS artists_text
FROM chart_entries ce
JOIN chart_editions e ON e.id = ce.chart_edition_id AND e.status = 'published'
JOIN chart_sources cs ON cs.id = e.chart_source_id
JOIN tracks t ON t.id = ce.track_id
LEFT JOIN platform_tracks pt ON pt.id = ce.platform_track_id;

COMMENT ON VIEW chart_public_entries IS 'Entrées de classements publiées, enrichies. security_invoker => RLS des tables de base appliquée.';

-- Dernière édition publiée par source
CREATE OR REPLACE FUNCTION latest_published_edition(p_source_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM chart_editions e
  WHERE e.chart_source_id = p_source_id AND e.status = 'published'
  ORDER BY e.period_start DESC
  LIMIT 1;
$$;

-- Aperçu multi-source
CREATE OR REPLACE FUNCTION get_chart_overview(p_limit int default 10)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(src)::jsonb ORDER BY src.ordre), '[]'::jsonb)
  FROM (
    SELECT
      cs.source_key,
      cs.platform,
      cs.display_name,
      cs.chart_context,
      cs.market_code,
      cs.ingestion_mode,
      cs.is_automatic,
      CASE cs.platform
        WHEN 'youtube' THEN 1 WHEN 'spotify' THEN 2 WHEN 'audiomack' THEN 3
        WHEN 'apple_music' THEN 4 WHEN 'tiktok' THEN 5 ELSE 6 END AS ordre,
      e.id            AS edition_id,
      e.period_start,
      e.period_end,
      e.published_at,
      e.source_updated_at,
      e.is_stale,
      e.entry_count,
      (
        SELECT coalesce(jsonb_agg(row_to_json(ent)::jsonb ORDER BY ent.filtered_position), '[]'::jsonb)
        FROM (
          SELECT cpe.filtered_position, cpe.source_position, cpe.movement,
                 cpe.entry_status, cpe.metric_value, cpe.metric_unit,
                 cpe.track_id, cpe.track_title, cpe.artists_text,
                 cpe.artwork_url, cpe.platform_url,
                 cpe.peak_filtered_position, cpe.weeks_on_chart
          FROM chart_public_entries cpe
          WHERE cpe.edition_id = e.id AND cpe.filtered_position <= p_limit
        ) ent
      ) AS entries
    FROM chart_sources cs
    LEFT JOIN LATERAL (
      SELECT * FROM chart_editions ce2
      WHERE ce2.chart_source_id = cs.id AND ce2.status = 'published'
      ORDER BY ce2.period_start DESC LIMIT 1
    ) e ON true
    WHERE cs.is_enabled = true
  ) src;
$$;

-- Top complet d'une plateforme
CREATE OR REPLACE FUNCTION get_platform_chart(p_source_key text, p_limit int default 20, p_edition uuid default null)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cible AS (
    SELECT cs.id AS source_id, cs.*,
           coalesce(p_edition, latest_published_edition(cs.id)) AS edition_id
    FROM chart_sources cs
    WHERE cs.source_key = p_source_key AND cs.is_enabled = true
  )
  SELECT CASE WHEN (SELECT edition_id FROM cible) IS NULL THEN NULL
  ELSE (
    SELECT jsonb_build_object(
      'source_key', c.source_key,
      'platform', c.platform,
      'display_name', c.display_name,
      'chart_context', c.chart_context,
      'market_code', c.market_code,
      'ingestion_mode', c.ingestion_mode,
      'is_automatic', c.is_automatic,
      'edition', (
        SELECT jsonb_build_object(
          'edition_id', e.id, 'period_start', e.period_start, 'period_end', e.period_end,
          'published_at', e.published_at, 'source_updated_at', e.source_updated_at,
          'is_stale', e.is_stale, 'entry_count', e.entry_count)
        FROM chart_editions e WHERE e.id = c.edition_id
      ),
      'entries', (
        SELECT coalesce(jsonb_agg(row_to_json(ent)::jsonb ORDER BY ent.filtered_position), '[]'::jsonb)
        FROM (
          SELECT cpe.filtered_position, cpe.source_position, cpe.movement,
                 cpe.entry_status, cpe.metric_value, cpe.metric_unit,
                 cpe.track_id, cpe.track_title, cpe.artists_text,
                 cpe.artwork_url, cpe.platform_url,
                 cpe.peak_filtered_position, cpe.weeks_on_chart, cpe.consecutive_weeks
          FROM chart_public_entries cpe
          WHERE cpe.edition_id = c.edition_id AND cpe.filtered_position <= p_limit
        ) ent
      )
    )
    FROM cible c
  ) END;
$$;

GRANT EXECUTE ON FUNCTION get_chart_overview(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_platform_chart(text, int, uuid) TO anon, authenticated;
GRANT SELECT ON chart_public_entries TO anon, authenticated;


-- =========================================================
-- Migration 4: 20260706194222_create_charts_maintenance.sql
-- =========================================================

CREATE OR REPLACE FUNCTION current_canonical_week_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT (date_trunc('week', (now() AT TIME ZONE 'UTC')) - interval '3 days')::timestamptz;
$$;

CREATE OR REPLACE FUNCTION mark_stale_editions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (cs.id) e.id, e.source_updated_at
    FROM chart_sources cs
    JOIN chart_editions e ON e.chart_source_id = cs.id AND e.status = 'published'
    WHERE cs.is_enabled = true
    ORDER BY cs.id, e.period_start DESC
  LOOP
    IF r.source_updated_at IS NULL OR r.source_updated_at < current_canonical_week_start() THEN
      UPDATE chart_editions SET is_stale = true WHERE id = r.id AND is_stale = false;
      IF found THEN v_count := v_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION current_canonical_week_start() TO service_role;
GRANT EXECUTE ON FUNCTION mark_stale_editions() TO service_role;


-- =========================================================
-- Migration 5: 20260706201617_create_charts_cron.sql
-- =========================================================

CREATE TABLE IF NOT EXISTS chart_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
INSERT INTO chart_config (key, value) VALUES
  ('publication_day', 'Monday'),
  ('publication_time', '08:00'),
  ('publication_timezone', 'America/Port-au-Prince')
ON CONFLICT (key) DO NOTHING;

-- Note: pg_cron schedule commands are NOT included here.
-- They must be configured manually via Supabase Dashboard on Cloud.


-- =========================================================
-- Migration 6: 20260707020245_audiomack_snapshots.sql
-- =========================================================

CREATE TABLE IF NOT EXISTS chart_snapshots (
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
  unique (platform, country_code, chart_name, content_hash)
);

CREATE INDEX IF NOT EXISTS chart_snapshots_platform_collected_idx
  ON chart_snapshots (platform, country_code, collected_at desc);

CREATE TABLE IF NOT EXISTS chart_snapshot_entries (
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

-- RLS
ALTER TABLE chart_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_snapshot_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read snapshots" ON chart_snapshots;
CREATE POLICY "public read snapshots"
  ON chart_snapshots FOR SELECT USING (status = 'success');

DROP POLICY IF EXISTS "public read snapshot entries" ON chart_snapshot_entries;
CREATE POLICY "public read snapshot entries"
  ON chart_snapshot_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chart_snapshots s
    WHERE s.id = chart_snapshot_entries.snapshot_id AND s.status = 'success'
  ));

DROP POLICY IF EXISTS "admin manage snapshots" ON chart_snapshots;
CREATE POLICY "admin manage snapshots"
  ON chart_snapshots FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin manage snapshot entries" ON chart_snapshot_entries;
CREATE POLICY "admin manage snapshot entries"
  ON chart_snapshot_entries FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON chart_snapshots TO anon, authenticated;
GRANT SELECT ON chart_snapshot_entries TO anon, authenticated;


-- =========================================================
-- Migration 7: 20260707153000_add_audiomack_haiti_genre_sources.sql
-- =========================================================

INSERT INTO chart_sources (
  platform, source_key, display_name, chart_context, market_code,
  genre_id, ingestion_mode, source_url, is_enabled, is_automatic
) VALUES
  ('audiomack','audiomack_haiti_weekly100','Audiomack - Weekly 100 Haiti','Top Songs Haiti - All','HT','all','VERIFIED_ADMIN_IMPORT','https://audiomack.com/geo-charts/playlist/haiti',true,false),
  ('audiomack','audiomack_haiti_top_songs_afrosounds','Audiomack - Haiti Afrosounds','Top Songs Haiti - Afrosounds','HT','afrosounds','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_hip_hop_rap','Audiomack - Haiti Hip-Hop/Rap','Top Songs Haiti - Hip-Hop/Rap','HT','hip-hop-rap','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_latin','Audiomack - Haiti Latin','Top Songs Haiti - Latin','HT','latin','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_jazz_blues','Audiomack - Haiti Jazz/Blues','Top Songs Haiti - Jazz/Blues','HT','jazz-blues','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_caribbean','Audiomack - Haiti Caribbean','Top Songs Haiti - Caribbean','HT','caribbean','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_pop','Audiomack - Haiti Pop','Top Songs Haiti - Pop','HT','pop','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_r_b','Audiomack - Haiti R&B','Top Songs Haiti - R&B','HT','r-b','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_gospel','Audiomack - Haiti Gospel','Top Songs Haiti - Gospel','HT','gospel','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_electronic','Audiomack - Haiti Electronic','Top Songs Haiti - Electronic','HT','electronic','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_rock','Audiomack - Haiti Rock','Top Songs Haiti - Rock','HT','rock','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_punjabi','Audiomack - Haiti Punjabi','Top Songs Haiti - Punjabi','HT','punjabi','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_country','Audiomack - Haiti Country','Top Songs Haiti - Country','HT','country','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_instrumental','Audiomack - Haiti Instrumental','Top Songs Haiti - Instrumental','HT','instrumental','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_podcast','Audiomack - Haiti Podcast','Top Haiti - Podcast','HT','podcast','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false)
ON CONFLICT (source_key) DO UPDATE SET
  display_name = excluded.display_name,
  chart_context = excluded.chart_context,
  market_code = excluded.market_code,
  genre_id = excluded.genre_id,
  ingestion_mode = excluded.ingestion_mode,
  source_url = excluded.source_url,
  is_enabled = excluded.is_enabled,
  is_automatic = excluded.is_automatic,
  updated_at = now();

CREATE INDEX IF NOT EXISTS chart_sources_platform_market_genre_idx
  ON chart_sources (platform, market_code, genre_id);

CREATE INDEX IF NOT EXISTS artists_haitian_status_idx
  ON artists (haitian_status);


-- =========================================================
-- Migration 8: 20260707170000_enable_audiomack_haiti_official_sync.sql
-- =========================================================

INSERT INTO chart_sources (
  platform, source_key, display_name, chart_context, market_code,
  genre_id, ingestion_mode, source_url, is_enabled, is_automatic
) VALUES (
  'audiomack',
  'audiomack_haiti_weekly100',
  'Audiomack - Weekly 100 Haiti',
  'Weekly 100: Haiti officiel Audiomack',
  'HT',
  'all',
  'OFFICIAL_EXPORT',
  'https://audiomack.com/geo-charts/playlist/haiti',
  true,
  true
)
ON CONFLICT (source_key) DO UPDATE SET
  display_name = excluded.display_name,
  chart_context = excluded.chart_context,
  market_code = excluded.market_code,
  genre_id = excluded.genre_id,
  ingestion_mode = excluded.ingestion_mode,
  source_url = excluded.source_url,
  is_enabled = excluded.is_enabled,
  is_automatic = excluded.is_automatic,
  updated_at = now();


-- =========================================================
-- Migration 9: 20260707200000_add_confidence_score_to_artists.sql
-- =========================================================

ALTER TABLE artists ADD COLUMN IF NOT EXISTS confidence_score integer;


-- =========================================================
-- Migration 10: 20260708090000_admin_charts_control.sql
-- =========================================================

-- ---------- Colonnes d'édition manuelle sur chart_entries ----------
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS admin_position integer;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS display_title text;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS display_artist text;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS display_artwork_url text;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS display_url text;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS exclusion_reason text;

COMMENT ON COLUMN chart_entries.is_hidden IS 'Masqué par l''admin : conservé mais absent du classement public.';
COMMENT ON COLUMN chart_entries.is_excluded IS 'Retiré par l''admin (ex. artiste non haïtien) : ne compte pas dans les positions.';
COMMENT ON COLUMN chart_entries.admin_position IS 'Ordre manuel imposé par l''admin (null = ordre source Audiomack).';
COMMENT ON COLUMN chart_entries.display_title IS 'Titre corrigé par l''admin (override de tracks.title).';
COMMENT ON COLUMN chart_entries.display_artist IS 'Nom d''artiste corrigé par l''admin (override).';
COMMENT ON COLUMN chart_entries.display_artwork_url IS 'Cover corrigée par l''admin (override).';
COMMENT ON COLUMN chart_entries.display_url IS 'Lien Audiomack corrigé par l''admin (override).';

-- ---------- État de publication sur chart_editions ----------
ALTER TABLE chart_editions ADD COLUMN IF NOT EXISTS has_unpublished_changes boolean NOT NULL DEFAULT true;
ALTER TABLE chart_editions ADD COLUMN IF NOT EXISTS last_published_at timestamptz;

COMMENT ON COLUMN chart_editions.has_unpublished_changes IS 'Vrai si des modifications brouillon ne sont pas encore publiées.';

-- ---------- Historique simple des positions ----------
CREATE TABLE IF NOT EXISTS chart_entry_history (
  id uuid primary key default gen_random_uuid(),
  chart_edition_id uuid references chart_editions (id) on delete cascade,
  chart_entry_id uuid,
  track_id uuid,
  old_position integer,
  new_position integer,
  action text not null,
  source text not null default 'audiomack',
  is_manual boolean not null default true,
  note text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS chart_entry_history_edition_idx
  ON chart_entry_history (chart_edition_id, changed_at desc);

COMMENT ON TABLE chart_entry_history IS 'Journal simple : ancienne position, nouvelle position, date, source, manuel.';

-- ---------- Snapshots publiés ----------
CREATE TABLE IF NOT EXISTS chart_published_snapshots (
  id uuid primary key default gen_random_uuid(),
  chart_source_id uuid not null references chart_sources (id) on delete cascade,
  source_key text not null,
  edition_id uuid references chart_editions (id) on delete set null,
  platform text not null,
  period_start timestamptz,
  period_end timestamptz,
  is_stale boolean not null default false,
  payload jsonb not null,
  editable_state jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_key)
);
CREATE INDEX IF NOT EXISTS chart_published_snapshots_source_idx
  ON chart_published_snapshots (source_key);

COMMENT ON TABLE chart_published_snapshots IS 'Dernière version publiée par source. Le site public lit uniquement ceci.';

-- ---------- Trigger : marquer l'édition comme modifiée ----------
CREATE OR REPLACE FUNCTION mark_edition_dirty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_edition uuid;
BEGIN
  v_edition := coalesce(new.chart_edition_id, old.chart_edition_id);
  IF v_edition IS NOT NULL THEN
    UPDATE chart_editions
      SET has_unpublished_changes = true
      WHERE id = v_edition;
  END IF;
  RETURN coalesce(new, old);
END;
$$;

DROP TRIGGER IF EXISTS trg_chart_entries_dirty ON chart_entries;
CREATE TRIGGER trg_chart_entries_dirty
  AFTER INSERT OR UPDATE OR DELETE ON chart_entries
  FOR EACH ROW EXECUTE FUNCTION mark_edition_dirty();

-- ---------- RLS ----------
ALTER TABLE chart_entry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_published_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage chart_entry_history" ON chart_entry_history;
CREATE POLICY "admin manage chart_entry_history"
  ON chart_entry_history FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public read published snapshots" ON chart_published_snapshots;
CREATE POLICY "public read published snapshots"
  ON chart_published_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin manage published snapshots" ON chart_published_snapshots;
CREATE POLICY "admin manage published snapshots"
  ON chart_published_snapshots FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON chart_published_snapshots TO anon, authenticated;

-- ---------- API de lecture publique basée snapshot ----------

CREATE OR REPLACE FUNCTION get_published_platform_chart(p_source_key text, p_limit int default 20)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.payload IS NULL THEN NULL
    ELSE jsonb_set(
      s.payload,
      '{entries}',
      (
        SELECT coalesce(jsonb_agg(e ORDER BY (e->>'filtered_position')::int), '[]'::jsonb)
        FROM jsonb_array_elements(coalesce(s.payload->'entries','[]'::jsonb)) e
        WHERE (e->>'filtered_position')::int <= p_limit
      )
    )
  END
  FROM chart_published_snapshots s
  WHERE s.source_key = p_source_key
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_published_overview(p_limit int default 10)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(o)::jsonb ORDER BY o.ordre), '[]'::jsonb)
  FROM (
    SELECT
      cs.source_key,
      cs.platform,
      cs.display_name,
      cs.chart_context,
      cs.market_code,
      cs.ingestion_mode,
      cs.is_automatic,
      CASE cs.platform
        WHEN 'youtube' THEN 1 WHEN 'spotify' THEN 2 WHEN 'audiomack' THEN 3
        WHEN 'apple_music' THEN 4 WHEN 'tiktok' THEN 5 ELSE 6 END AS ordre,
      s.edition_id,
      s.period_start,
      s.period_end,
      s.published_at,
      (s.payload->'edition'->>'source_updated_at') AS source_updated_at,
      s.is_stale,
      coalesce(jsonb_array_length(s.payload->'entries'), 0) AS entry_count,
      (
        SELECT coalesce(jsonb_agg(e ORDER BY (e->>'filtered_position')::int), '[]'::jsonb)
        FROM jsonb_array_elements(coalesce(s.payload->'entries','[]'::jsonb)) e
        WHERE (e->>'filtered_position')::int <= p_limit
      ) AS entries
    FROM chart_sources cs
    JOIN chart_published_snapshots s ON s.source_key = cs.source_key
    WHERE cs.is_enabled = true
  ) o;
$$;

GRANT EXECUTE ON FUNCTION get_published_platform_chart(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_published_overview(int) TO anon, authenticated;


-- =========================================================
-- Migration 11: 20260708100000_add_artist_image_url.sql
-- =========================================================

ALTER TABLE artists ADD COLUMN IF NOT EXISTS image_url text;
COMMENT ON COLUMN artists.image_url IS 'Photo de profil de l''artiste (URL Audiomack ou autre plateforme).';

ALTER TABLE chart_snapshot_entries ADD COLUMN IF NOT EXISTS artist_image_url text;


-- =========================================================
-- Migration 12: 20260708110000_add_genre_to_chart_entries.sql
-- =========================================================

ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS genre text;
COMMENT ON COLUMN chart_entries.genre IS 'Étiquette de genre attribuée par l''admin (ex: afrosounds, pop, hip-hop-rap, konpa, raboday).';


-- =========================================================
-- Migration 13: 20260708120000_add_artist_tags.sql
-- =========================================================

ALTER TABLE artists ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN artists.tags IS 'Étiquettes de rôle (chanteur, rappeur, beatmaker, auteur_compositeur). Un artiste peut en avoir plusieurs.';


-- =========================================================
-- Migration 14: 20260709090000_create_tiktok_tables.sql
-- =========================================================

-- ---------- Table : tiktok_sounds ----------
CREATE TABLE IF NOT EXISTS tiktok_sounds (
  id uuid primary key default gen_random_uuid(),
  music_id text unique not null,
  sound_title text not null,
  sound_author text,
  total_videos integer not null default 0,
  total_views bigint not null default 0,
  total_likes bigint not null default 0,
  total_comments bigint not null default 0,
  total_shares bigint not null default 0,
  unique_creators integer not null default 0,
  score numeric(12,4) not null default 0,
  growth_7d numeric(8,4) not null default 0,
  previous_total_videos integer,
  previous_snapshot_at timestamptz,
  validation_status text not null default 'a_verifier'
    check (validation_status in ('a_verifier', 'valide', 'refuse')),
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  artist_id uuid references artists (id) on delete set null
);

COMMENT ON TABLE tiktok_sounds IS 'Sons TikTok agrégés avec métriques et score composite pour les classements.';
COMMENT ON COLUMN tiktok_sounds.music_id IS 'Identifiant unique du son sur TikTok.';
COMMENT ON COLUMN tiktok_sounds.validation_status IS 'Statut de validation admin : a_verifier (défaut), valide, refuse.';
COMMENT ON COLUMN tiktok_sounds.score IS 'Score composite calculé par le Score Engine (pondéré, normalisé).';
COMMENT ON COLUMN tiktok_sounds.growth_7d IS 'Croissance en pourcentage sur 7 jours du nombre de publications.';
COMMENT ON COLUMN tiktok_sounds.previous_total_videos IS 'Snapshot du total_videos il y a 7 jours pour calcul de croissance.';

-- Index sur tiktok_sounds
CREATE INDEX IF NOT EXISTS tiktok_sounds_validation_status_idx ON tiktok_sounds (validation_status);
CREATE INDEX IF NOT EXISTS tiktok_sounds_score_idx ON tiktok_sounds (score desc);
CREATE INDEX IF NOT EXISTS tiktok_sounds_growth_7d_idx ON tiktok_sounds (growth_7d desc);
CREATE INDEX IF NOT EXISTS tiktok_sounds_first_seen_at_idx ON tiktok_sounds (first_seen_at desc);
CREATE INDEX IF NOT EXISTS tiktok_sounds_artist_id_idx ON tiktok_sounds (artist_id) WHERE artist_id IS NOT NULL;

-- ---------- Table : tiktok_videos ----------
CREATE TABLE IF NOT EXISTS tiktok_videos (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,
  music_id text not null references tiktok_sounds (music_id) on delete cascade,
  username text not null,
  create_time timestamptz not null,
  region_code text,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  share_count bigint not null default 0,
  hashtag_names text[] not null default '{}',
  video_description text,
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

COMMENT ON TABLE tiktok_videos IS 'Données brutes des vidéos TikTok collectées via l''API Research.';
COMMENT ON COLUMN tiktok_videos.video_id IS 'Identifiant unique de la vidéo sur TikTok.';
COMMENT ON COLUMN tiktok_videos.music_id IS 'Référence au son utilisé dans la vidéo (FK → tiktok_sounds.music_id).';

-- Index sur tiktok_videos
CREATE INDEX IF NOT EXISTS tiktok_videos_music_id_idx ON tiktok_videos (music_id);
CREATE INDEX IF NOT EXISTS tiktok_videos_username_idx ON tiktok_videos (username);
CREATE INDEX IF NOT EXISTS tiktok_videos_create_time_idx ON tiktok_videos (create_time desc);
CREATE INDEX IF NOT EXISTS tiktok_videos_collected_at_idx ON tiktok_videos (collected_at desc);
CREATE INDEX IF NOT EXISTS tiktok_videos_region_code_idx ON tiktok_videos (region_code) WHERE region_code IS NOT NULL;

-- ---------- Table : tiktok_featured_shorts ----------
CREATE TABLE IF NOT EXISTS tiktok_featured_shorts (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references tiktok_videos (video_id) on delete cascade,
  music_id text not null references tiktok_sounds (music_id) on delete cascade,
  display_order integer not null,
  selected_at timestamptz not null default now(),
  selected_by uuid references auth.users (id) on delete set null
);

COMMENT ON TABLE tiktok_featured_shorts IS 'Vidéos TikTok mises en avant sur la homepage (section HMI Shorts, max 10).';
COMMENT ON COLUMN tiktok_featured_shorts.display_order IS 'Ordre d''affichage sur la homepage (1 = premier).';

-- Index sur tiktok_featured_shorts
CREATE INDEX IF NOT EXISTS tiktok_featured_shorts_display_order_idx ON tiktok_featured_shorts (display_order);
CREATE INDEX IF NOT EXISTS tiktok_featured_shorts_video_id_idx ON tiktok_featured_shorts (video_id);
CREATE INDEX IF NOT EXISTS tiktok_featured_shorts_music_id_idx ON tiktok_featured_shorts (music_id);

-- Trigger updated_at pour tiktok_videos
DROP TRIGGER IF EXISTS trg_tiktok_videos_updated ON tiktok_videos;
CREATE TRIGGER trg_tiktok_videos_updated BEFORE UPDATE ON tiktok_videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger last_updated_at pour tiktok_sounds
CREATE OR REPLACE FUNCTION set_last_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.last_updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_tiktok_sounds_updated ON tiktok_sounds;
CREATE TRIGGER trg_tiktok_sounds_updated BEFORE UPDATE ON tiktok_sounds
  FOR EACH ROW EXECUTE FUNCTION set_last_updated_at();

-- RLS TikTok tables
ALTER TABLE tiktok_videos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_sounds          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_featured_shorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage tiktok_videos" ON tiktok_videos;
CREATE POLICY "admin manage tiktok_videos"
  ON tiktok_videos FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin manage tiktok_sounds" ON tiktok_sounds;
CREATE POLICY "admin manage tiktok_sounds"
  ON tiktok_sounds FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin manage tiktok_featured_shorts" ON tiktok_featured_shorts;
CREATE POLICY "admin manage tiktok_featured_shorts"
  ON tiktok_featured_shorts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =========================================================
-- Migration 15: 20260709100000_seed_tiktok_chart_sources.sql
-- =========================================================

INSERT INTO chart_sources (
  platform, source_key, display_name, chart_context, market_code,
  ingestion_mode, is_enabled, is_automatic
)
VALUES
  (
    'tiktok',
    'tiktok_haiti_global',
    'Top TikTok Haiti - Global',
    'Sons populaires en Haïti — Score global',
    'HT',
    'OFFICIAL_API',
    true,
    true
  ),
  (
    'tiktok',
    'tiktok_haiti_en_montee',
    'Top TikTok Haiti - En montée',
    'Sons populaires en Haïti — Croissance 7 jours',
    'HT',
    'OFFICIAL_API',
    true,
    true
  ),
  (
    'tiktok',
    'tiktok_haiti_nouveautes',
    'Top TikTok Haiti - Nouveautés',
    'Sons populaires en Haïti — Découvertes récentes (14 jours)',
    'HT',
    'OFFICIAL_API',
    true,
    true
  )
ON CONFLICT (source_key) DO UPDATE SET
  platform       = EXCLUDED.platform,
  display_name   = EXCLUDED.display_name,
  chart_context  = EXCLUDED.chart_context,
  market_code    = EXCLUDED.market_code,
  ingestion_mode = EXCLUDED.ingestion_mode,
  is_enabled     = EXCLUDED.is_enabled,
  is_automatic   = EXCLUDED.is_automatic;

-- =========================================================
-- FIN — Toutes les migrations ont été appliquées.
-- =========================================================
