-- Fix pour les conflits de migration radio
-- Exécutez ce script si vous avez des erreurs de triggers/tables existants

-- 1. Vérifier que radio_config existe, sinon la créer
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

-- 2. Droppper le trigger s'il existe
DROP TRIGGER IF EXISTS update_radio_config_updated_at ON radio_config;

-- 3. Recréer le trigger
CREATE TRIGGER update_radio_config_updated_at BEFORE UPDATE ON radio_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. S'assurer que radio_play_history existe
CREATE TABLE IF NOT EXISTS radio_play_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES radio_tracks(id) ON DELETE CASCADE,
  played_at timestamptz DEFAULT now(),
  listener_count integer DEFAULT 0,
  completed boolean DEFAULT false
);

-- 5. S'assurer que radio_stats existe
CREATE TABLE IF NOT EXISTS radio_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_track_id uuid REFERENCES radio_tracks(id) ON DELETE SET NULL,
  listener_count integer DEFAULT 0,
  started_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- 6. Activer RLS sur radio_config si pas déjà activé
ALTER TABLE radio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_stats ENABLE ROW LEVEL SECURITY;

-- 7. Créer les politiques RLS si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'radio_config' AND policyname = 'Public read access to radio config'
  ) THEN
    CREATE POLICY "Public read access to radio config"
      ON radio_config FOR SELECT
      USING (true);
  END IF;
END $$;

-- 8. S'assurer qu'une config par défaut existe
INSERT INTO radio_config (preload_count, crossfade_duration_ms, is_live)
SELECT 3, 2000, true
WHERE NOT EXISTS (SELECT 1 FROM radio_config);

-- ✅ Vérification
SELECT 
  '✅ radio_config' as check,
  COUNT(*) as count,
  is_live,
  active_playlist_id
FROM radio_config
GROUP BY is_live, active_playlist_id
UNION ALL
SELECT 
  '✅ radio_play_history',
  COUNT(*),
  NULL,
  NULL
FROM radio_play_history
UNION ALL
SELECT 
  '✅ radio_stats',
  COUNT(*),
  NULL,
  NULL
FROM radio_stats;
