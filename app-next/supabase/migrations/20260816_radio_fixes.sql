-- Fixes finales pour le système de radio
-- Corrige les problèmes de trigger existants et ajoute les fonctions manquantes
-- NOTE: Uses IF EXISTS to prevent errors on system triggers

-- 1. Supprimer les anciens triggers problématiques s'ils existent
DROP TRIGGER IF EXISTS update_radio_tracks_updated_at ON radio_tracks CASCADE;
DROP TRIGGER IF EXISTS update_radio_playlists_updated_at ON radio_playlists CASCADE;
DROP TRIGGER IF EXISTS update_radio_config_updated_at ON radio_config CASCADE;

-- 2. Recréer les triggers correctement
CREATE TRIGGER update_radio_tracks_updated_at BEFORE UPDATE ON radio_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_radio_playlists_updated_at BEFORE UPDATE ON radio_playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_radio_config_updated_at BEFORE UPDATE ON radio_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Vérifier/Créer la fonction increment_track_play_count
CREATE OR REPLACE FUNCTION increment_track_play_count(track_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE radio_tracks SET play_count = play_count + 1 WHERE id = track_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Ajouter le CHECK constraint sur la colonne source (s'il n'existe pas)
ALTER TABLE radio_tracks
  DROP CONSTRAINT IF EXISTS radio_tracks_source_check;

ALTER TABLE radio_tracks
  ADD CONSTRAINT radio_tracks_source_check 
  CHECK (source IN ('manual', 'chart', 'youtube', 'audiomack', 'spotify', 'deezer', 'soundcloud'));

-- 5. Vérifier qu'une config par défaut existe
INSERT INTO radio_config (preload_count, crossfade_duration_ms, is_live)
SELECT 3, 2000, true
WHERE NOT EXISTS (SELECT 1 FROM radio_config)
ON CONFLICT DO NOTHING;

-- ✅ Vérification finale
SELECT 
  'Radio System Status' as status,
  COUNT(*) as config_count,
  COALESCE(is_live, false) as is_live
FROM radio_config
GROUP BY is_live;