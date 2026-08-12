-- Migration pour le système de radio de Planète HMI

-- Table des pistes audio disponibles pour la radio
CREATE TABLE IF NOT EXISTS radio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist_name text NOT NULL,
  artist_id uuid REFERENCES artists(id) ON DELETE SET NULL,
  audio_url text NOT NULL,
  cover_image_url text,
  duration_seconds integer NOT NULL DEFAULT 0,
  genre text,
  source text DEFAULT 'manual', -- 'manual', 'chart', 'youtube', etc.
  source_id text, -- ID du classement ou de la vidéo source
  is_active boolean DEFAULT true,
  play_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des playlists radio
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

-- Table de liaison entre playlists et pistes
CREATE TABLE IF NOT EXISTS radio_playlist_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES radio_playlists(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES radio_tracks(id) ON DELETE CASCADE,
  track_position integer NOT NULL DEFAULT 0,
  added_at timestamptz DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);

-- Configuration de la radio (paramètres globaux)
CREATE TABLE IF NOT EXISTS radio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_playlist_id uuid REFERENCES radio_playlists(id) ON DELETE SET NULL,
  auto_switch_to_chart boolean DEFAULT false,
  chart_source_key text, -- Clé du classement à jouer automatiquement
  preload_count integer DEFAULT 3, -- Nombre de pistes à précharger
  crossfade_duration_ms integer DEFAULT 2000,
  is_live boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Historique de lecture
CREATE TABLE IF NOT EXISTS radio_play_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES radio_tracks(id) ON DELETE CASCADE,
  played_at timestamptz DEFAULT now(),
  listener_count integer DEFAULT 0,
  completed boolean DEFAULT false
);

-- Statistiques en temps réel de la radio
CREATE TABLE IF NOT EXISTS radio_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_track_id uuid REFERENCES radio_tracks(id) ON DELETE SET NULL,
  listener_count integer DEFAULT 0,
  started_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_radio_tracks_active ON radio_tracks(is_active);
CREATE INDEX IF NOT EXISTS idx_radio_tracks_artist ON radio_tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_radio_tracks_source ON radio_tracks(source, source_id);
CREATE INDEX IF NOT EXISTS idx_radio_playlist_tracks_playlist ON radio_playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_radio_playlist_tracks_position ON radio_playlist_tracks(playlist_id, track_position);
CREATE INDEX IF NOT EXISTS idx_radio_play_history_track ON radio_play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_radio_play_history_played_at ON radio_play_history(played_at DESC);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_radio_tracks_updated_at BEFORE UPDATE ON radio_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_radio_playlists_updated_at BEFORE UPDATE ON radio_playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_radio_config_updated_at BEFORE UPDATE ON radio_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour obtenir la playlist active avec toutes ses pistes
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

-- Fonction pour obtenir les pistes d'un classement
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
  -- Cette fonction doit être adaptée selon votre structure de classements
  -- Pour l'instant, un exemple basique
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

-- Insérer une configuration par défaut
INSERT INTO radio_config (preload_count, crossfade_duration_ms, is_live)
VALUES (3, 2000, true)
ON CONFLICT DO NOTHING;

-- RLS (Row Level Security) - À adapter selon vos besoins
ALTER TABLE radio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_stats ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique pour les pistes et playlists actives
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

-- Politique d'écriture réservée aux admins
-- (Vous devrez adapter selon votre système d'authentification admin)
