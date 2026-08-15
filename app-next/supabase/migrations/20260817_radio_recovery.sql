-- Radio System Recovery Migration
-- Use this if previous migrations failed due to existing triggers or constraints
-- This script safely handles already-existing objects

-- 1. Check if tables exist and create if missing
CREATE TABLE IF NOT EXISTS radio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist_name text NOT NULL,
  artist_id uuid REFERENCES artists(id) ON DELETE SET NULL,
  audio_url text NOT NULL,
  cover_image_url text,
  duration_seconds integer NOT NULL DEFAULT 0,
  genre text,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'chart', 'youtube', 'audiomack', 'spotify', 'deezer', 'soundcloud')),
  source_id text,
  is_active boolean DEFAULT true,
  play_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS radio_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  shuffle_enabled boolean DEFAULT true,
  repeat_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS radio_playlist_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES radio_playlists(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES radio_tracks(id) ON DELETE CASCADE,
  track_position integer NOT NULL DEFAULT 0,
  added_at timestamptz DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS radio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_playlist_id uuid REFERENCES radio_playlists(id) ON DELETE SET NULL,
  auto_switch_to_chart boolean DEFAULT false,
  chart_source_key text,
  preload_count integer DEFAULT 3,
  crossfade_duration_ms integer DEFAULT 2000,
  is_live boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS radio_play_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES radio_tracks(id) ON DELETE CASCADE,
  played_at timestamptz DEFAULT now(),
  listener_count integer DEFAULT 0,
  completed boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS radio_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_track_id uuid REFERENCES radio_tracks(id) ON DELETE SET NULL,
  listener_count integer DEFAULT 0,
  started_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_radio_tracks_active ON radio_tracks(is_active);
CREATE INDEX IF NOT EXISTS idx_radio_tracks_artist ON radio_tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_radio_tracks_source ON radio_tracks(source, source_id);
CREATE INDEX IF NOT EXISTS idx_radio_playlist_tracks_playlist ON radio_playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_radio_playlist_tracks_position ON radio_playlist_tracks(playlist_id, track_position);
CREATE INDEX IF NOT EXISTS idx_radio_play_history_track ON radio_play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_radio_play_history_played_at ON radio_play_history(played_at DESC);

-- 3. Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Safely recreate triggers - drop first if exists
DROP TRIGGER IF EXISTS update_radio_tracks_updated_at ON radio_tracks CASCADE;
DROP TRIGGER IF EXISTS update_radio_playlists_updated_at ON radio_playlists CASCADE;
DROP TRIGGER IF EXISTS update_radio_config_updated_at ON radio_config CASCADE;

-- Create the triggers
CREATE TRIGGER update_radio_tracks_updated_at BEFORE UPDATE ON radio_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_radio_playlists_updated_at BEFORE UPDATE ON radio_playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_radio_config_updated_at BEFORE UPDATE ON radio_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Create RPC functions if they don't exist
CREATE OR REPLACE FUNCTION increment_track_play_count(track_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE radio_tracks SET play_count = play_count + 1 WHERE id = track_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_radio_playlist()
RETURNS TABLE (
  playlist_id uuid,
  playlist_name text,
  track_id uuid,
  track_title text,
  artist_name text,
  audio_url text,
  cover_image_url text,
  duration_seconds integer,
  track_position integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    t.id,
    t.title,
    t.artist_name,
    t.audio_url,
    t.cover_image_url,
    t.duration_seconds,
    pt.track_position
  FROM radio_config rc
  JOIN radio_playlists p ON p.id = rc.active_playlist_id
  JOIN radio_playlist_tracks pt ON pt.playlist_id = p.id
  JOIN radio_tracks t ON t.id = pt.track_id
  WHERE t.is_active = true
  ORDER BY pt.track_position;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_chart_radio_tracks(chart_key text)
RETURNS TABLE (
  track_id uuid,
  track_title text,
  artist_name text,
  audio_url text,
  cover_image_url text,
  duration_seconds integer,
  chart_position integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.artist_name,
    t.audio_url,
    t.cover_image_url,
    t.duration_seconds,
    0 as chart_position
  FROM radio_tracks t
  WHERE t.source = 'chart' 
    AND t.source_id = chart_key
    AND t.is_active = true
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. Enable RLS and create policies
ALTER TABLE radio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access to active radio tracks" ON radio_tracks;
DROP POLICY IF EXISTS "Public read access to active playlists" ON radio_playlists;
DROP POLICY IF EXISTS "Public read access to playlist tracks" ON radio_playlist_tracks;
DROP POLICY IF EXISTS "Public read access to radio config" ON radio_config;
DROP POLICY IF EXISTS "Public read access to radio stats" ON radio_stats;

-- Create new policies
CREATE POLICY "Public read access to active radio tracks"
  ON radio_tracks FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public read access to active playlists"
  ON radio_playlists FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public read access to playlist tracks"
  ON radio_playlist_tracks FOR SELECT
  USING (true);

CREATE POLICY "Public read access to radio config"
  ON radio_config FOR SELECT
  USING (true);

CREATE POLICY "Public read access to radio stats"
  ON radio_stats FOR SELECT
  USING (true);

-- 7. Ensure a default config exists
INSERT INTO radio_config (preload_count, crossfade_duration_ms, is_live)
SELECT 3, 2000, true
WHERE NOT EXISTS (SELECT 1 FROM radio_config);

-- 8. Final verification
SELECT 
  'Radio System Recovery' as status,
  COUNT(*) as config_count,
  (SELECT is_live FROM radio_config LIMIT 1) as is_live
FROM radio_config;

SELECT 
  'Tables Created' as status,
  COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'radio_%';

SELECT 
  'RPC Functions' as status,
  COUNT(*) as function_count
FROM pg_proc 
WHERE proname IN ('increment_track_play_count', 'get_active_radio_playlist', 'get_chart_radio_tracks');
