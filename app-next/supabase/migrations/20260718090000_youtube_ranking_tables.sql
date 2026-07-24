-- =========================================================
-- Planète HMI — Top YouTube HMI : tables spécialisées (K1 v3)
--
-- Réutilise : chart_sources, chart_editions, chart_entries,
--             sync_runs, chart_audit_logs, artists, tracks,
--             track_artists, platform_tracks.
--
-- Principes :
-- • Aucune lecture publique. Le public lit via chart_published_snapshots.
-- • youtube_metric_snapshots est IMMUABLE (INSERT + SELECT uniquement).
-- • Désactivation logique — jamais de suppression physique.
-- • FK RESTRICT pour préserver l'historique.
-- • Moindre privilège : REVOKE ALL pour anon, grants minimaux.
-- =========================================================

-- ==========================================================
-- 1. youtube_channels — Sources YouTube approuvées
-- ==========================================================
CREATE TABLE IF NOT EXISTS youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identifiants YouTube
  channel_id text NOT NULL UNIQUE,
  uploads_playlist_id text,
  -- Métadonnées
  channel_title text NOT NULL,
  channel_handle text,
  channel_url text,
  thumbnail_url text,
  subscriber_count bigint CHECK (subscriber_count IS NULL OR subscriber_count >= 0),
  video_count integer CHECK (video_count IS NULL OR video_count >= 0),
  -- Type de chaîne (aligné sur le cahier)
  channel_type text NOT NULL DEFAULT 'OFFICIAL_ARTIST_CHANNEL'
    CHECK (channel_type IN (
      'OFFICIAL_ARTIST_CHANNEL',
      'TOPIC_CHANNEL',
      'VEVO_CHANNEL',
      'LABEL_CHANNEL',
      'DISTRIBUTOR_CHANNEL',
      'COLLABORATOR_CHANNEL',
      'OTHER_APPROVED_CHANNEL'
    )),
  -- Vérification YouTube
  is_youtube_verified boolean NOT NULL DEFAULT false,
  -- Rattachement Planète HMI principal (nullable pour labels multi-artistes)
  artist_id uuid REFERENCES artists(id) ON DELETE SET NULL,
  -- Statut éditorial
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('active', 'paused', 'rejected', 'pending_review')),
  is_active boolean NOT NULL DEFAULT true,
  approval_reason text,
  approved_by uuid,
  approved_at timestamptz,
  -- Distribution
  known_distributor text,
  -- Méta
  notes text,
  last_scanned_at timestamptz,
  last_scan_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yt_channels_artist_idx ON youtube_channels (artist_id) WHERE artist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS yt_channels_status_idx ON youtube_channels (status);
CREATE INDEX IF NOT EXISTS yt_channels_type_idx ON youtube_channels (channel_type);

COMMENT ON TABLE youtube_channels IS 'Chaînes YouTube approuvées comme sources pour le Top YouTube HMI.';
COMMENT ON COLUMN youtube_channels.channel_type IS 'Type aligné sur le cahier. LABEL/DISTRIBUTOR/COLLABORATOR = multi-artistes via youtube_channel_artists.';

-- ==========================================================
-- 1b. youtube_channel_artists — Association N artistes → 1 chaîne
-- Pour labels, distributeurs et chaînes collaboratives.
-- ==========================================================
CREATE TABLE IF NOT EXISTS youtube_channel_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id uuid NOT NULL REFERENCES youtube_channels(id) ON DELETE RESTRICT,
  artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE RESTRICT,
  -- Rôle de l'artiste sur cette chaîne
  role text NOT NULL DEFAULT 'signed_artist'
    CHECK (role IN ('signed_artist', 'featured', 'collaborator', 'owner', 'other')),
  notes text,
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (youtube_channel_id, artist_id)
);

CREATE INDEX IF NOT EXISTS yt_ch_artists_channel_idx ON youtube_channel_artists (youtube_channel_id);
CREATE INDEX IF NOT EXISTS yt_ch_artists_artist_idx ON youtube_channel_artists (artist_id);

COMMENT ON TABLE youtube_channel_artists IS 'Associe plusieurs artistes à une chaîne label/distributeur/collaborative. Pas d''attribution automatique.';

-- ==========================================================
-- 2. youtube_videos — Vidéos sources + état éditorial séparé
-- ==========================================================
CREATE TABLE IF NOT EXISTS youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL UNIQUE,
  channel_id text NOT NULL REFERENCES youtube_channels(channel_id) ON DELETE RESTRICT,
  -- Métadonnées sources (immuables sauf refresh)
  source_title text NOT NULL,
  source_description text,
  source_thumbnail_url text,
  published_at timestamptz NOT NULL,
  duration_iso text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  category_id text,
  tags text[] DEFAULT '{}',
  -- Compteurs sources (dernière valeur connue)
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  like_count bigint CHECK (like_count IS NULL OR like_count >= 0),
  comment_count bigint CHECK (comment_count IS NULL OR comment_count >= 0),
  -- État éditorial
  review_status text NOT NULL DEFAULT 'UNREVIEWED'
    CHECK (review_status IN (
      'UNREVIEWED', 'NEEDS_INFORMATION', 'APPROVED', 'EXCLUDED', 'DUPLICATE', 'IGNORED'
    )),
  review_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  -- Type vidéo (aligné cahier)
  video_type text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (video_type IN (
      'OFFICIAL_MUSIC_VIDEO', 'OFFICIAL_AUDIO', 'OFFICIAL_LYRIC_VIDEO',
      'OFFICIAL_VISUALIZER', 'OFFICIAL_ANIMATION', 'SHORT',
      'LIVE_PERFORMANCE', 'CONCERT', 'INTERVIEW', 'TEASER', 'TRAILER',
      'REACTION', 'FAN_UPLOAD', 'DANCE_CHALLENGE', 'PODCAST',
      'COMPILATION', 'BEHIND_THE_SCENES', 'UNKNOWN'
    )),
  -- Éligibilité : UNREVIEWED + non éligible par défaut
  is_eligible boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  -- Champs éditoriaux
  display_title text,
  display_thumbnail_url text,
  -- Rattachement
  track_id uuid REFERENCES tracks(id) ON DELETE SET NULL,
  platform_track_id uuid REFERENCES platform_tracks(id) ON DELETE SET NULL,
  -- Activation logique
  is_active boolean NOT NULL DEFAULT true,
  -- Méta
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yt_videos_channel_idx ON youtube_videos (channel_id);
CREATE INDEX IF NOT EXISTS yt_videos_review_idx ON youtube_videos (review_status) WHERE review_status = 'UNREVIEWED';
CREATE INDEX IF NOT EXISTS yt_videos_track_idx ON youtube_videos (track_id) WHERE track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS yt_videos_published_idx ON youtube_videos (published_at DESC);
CREATE INDEX IF NOT EXISTS yt_videos_eligible_idx ON youtube_videos (is_eligible) WHERE is_eligible = true AND review_status = 'APPROVED';
CREATE INDEX IF NOT EXISTS yt_videos_active_idx ON youtube_videos (is_active) WHERE is_active = true;

COMMENT ON TABLE youtube_videos IS 'Vidéos suivies. Nouvelle vidéo = UNREVIEWED + non éligible. Vérification humaine obligatoire.';

-- ==========================================================
-- 3. youtube_track_assets — Association N vidéos → 1 chanson
-- ==========================================================
CREATE TABLE IF NOT EXISTS youtube_track_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE RESTRICT,
  youtube_video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE RESTRICT,
  asset_role text NOT NULL DEFAULT 'primary'
    CHECK (asset_role IN ('primary', 'lyric', 'visualizer', 'live', 'audio', 'remix', 'other')),
  -- Priorité affichage uniquement (jamais pondération)
  priority integer NOT NULL DEFAULT 1 CHECK (priority >= 1 AND priority <= 100),
  is_eligible boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (track_id, youtube_video_id)
);

CREATE INDEX IF NOT EXISTS yt_assets_track_idx ON youtube_track_assets (track_id);
CREATE INDEX IF NOT EXISTS yt_assets_video_idx ON youtube_track_assets (youtube_video_id);

COMMENT ON TABLE youtube_track_assets IS 'N vidéos → 1 chanson. priority = affichage uniquement.';

-- ==========================================================
-- 4. youtube_metric_snapshots — IMMUABLE (INSERT + SELECT)
-- ==========================================================
CREATE TABLE IF NOT EXISTS youtube_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE RESTRICT,
  sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE RESTRICT,
  view_count bigint NOT NULL CHECK (view_count >= 0),
  like_count bigint CHECK (like_count IS NULL OR like_count >= 0),
  comment_count bigint CHECK (comment_count IS NULL OR comment_count >= 0),
  availability_status text NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'unavailable', 'private', 'deleted', 'age_restricted', 'region_blocked')),
  raw_statistics jsonb,
  source text NOT NULL DEFAULT 'youtube_data_api_v3',
  error text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (youtube_video_id, sync_run_id)
);

CREATE INDEX IF NOT EXISTS yt_snapshots_video_idx ON youtube_metric_snapshots (youtube_video_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS yt_snapshots_run_idx ON youtube_metric_snapshots (sync_run_id);

COMMENT ON TABLE youtube_metric_snapshots IS 'Relevés IMMUABLES. INSERT + SELECT uniquement. Ni UPDATE ni DELETE autorisé.';

-- ==========================================================
-- 5. Extension de chart_entries pour YouTube (delta)
-- ==========================================================
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS delta_views bigint;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS delta_likes bigint;
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS delta_comments bigint;

-- ==========================================================
-- 6. Source YouTube (mondiale, pas territoriale)
-- ==========================================================
INSERT INTO chart_sources (platform, source_key, display_name, chart_context, market_code, genre_id, ingestion_mode, source_url, is_enabled, is_automatic)
VALUES (
  'youtube',
  'youtube_hmi_weekly_delta',
  'Top YouTube HMI',
  'Nouvelles vues mondiales des vidéos officielles suivies par Planet HMI (delta hebdomadaire)',
  NULL, 'all', 'OFFICIAL_API', 'https://www.youtube.com', true, false
)
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  chart_context = EXCLUDED.chart_context,
  market_code = EXCLUDED.market_code;

-- ==========================================================
-- 7. Triggers updated_at
-- ==========================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_yt_channels_updated') THEN
    CREATE TRIGGER trg_yt_channels_updated BEFORE UPDATE ON youtube_channels
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_yt_videos_updated') THEN
    CREATE TRIGGER trg_yt_videos_updated BEFORE UPDATE ON youtube_videos
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ==========================================================
-- 8. Row Level Security + Moindre privilège
-- ==========================================================

-- Activer RLS
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_channel_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_track_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_metric_snapshots ENABLE ROW LEVEL SECURITY;

-- REVOKE ALL pour anon (moindre privilège)
REVOKE ALL ON youtube_channels FROM anon;
REVOKE ALL ON youtube_channel_artists FROM anon;
REVOKE ALL ON youtube_videos FROM anon;
REVOKE ALL ON youtube_track_assets FROM anon;
REVOKE ALL ON youtube_metric_snapshots FROM anon;

-- authenticated : uniquement SELECT (la RLS vérifie is_admin)
REVOKE ALL ON youtube_channels FROM authenticated;
REVOKE ALL ON youtube_channel_artists FROM authenticated;
REVOKE ALL ON youtube_videos FROM authenticated;
REVOKE ALL ON youtube_track_assets FROM authenticated;
REVOKE ALL ON youtube_metric_snapshots FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON youtube_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON youtube_channel_artists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON youtube_videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON youtube_track_assets TO authenticated;
-- Snapshots : INSERT + SELECT uniquement (immuable, pas d'UPDATE/DELETE)
GRANT SELECT, INSERT ON youtube_metric_snapshots TO authenticated;

-- Policies admin pour toutes les tables
CREATE POLICY "admin_all_channels" ON youtube_channels
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_channel_artists" ON youtube_channel_artists
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_videos" ON youtube_videos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_assets" ON youtube_track_assets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Snapshots : policies séparées INSERT et SELECT (pas UPDATE/DELETE)
CREATE POLICY "admin_read_snapshots" ON youtube_metric_snapshots
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_insert_snapshots" ON youtube_metric_snapshots
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
-- Pas de policy UPDATE ni DELETE → impossible même pour admin via RLS.
-- (Le service_role bypass la RLS mais ne devrait jamais UPDATE/DELETE les snapshots.)

-- ==========================================================
-- 9. Règle pour empêcher UPDATE/DELETE sur snapshots
-- (Couche supplémentaire — même le service_role est averti)
-- ==========================================================
CREATE OR REPLACE RULE "prevent_snapshot_update" AS ON UPDATE TO youtube_metric_snapshots
  DO INSTEAD NOTHING;
CREATE OR REPLACE RULE "prevent_snapshot_delete" AS ON DELETE TO youtube_metric_snapshots
  DO INSTEAD NOTHING;
