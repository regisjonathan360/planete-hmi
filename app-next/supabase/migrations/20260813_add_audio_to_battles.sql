-- Migration pour ajouter les URLs audio aux battles
-- Permet la preview audio au survol dans l'interface

-- Ajouter les colonnes pour les URLs audio
ALTER TABLE battles 
  ADD COLUMN IF NOT EXISTS side_a_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS side_b_audio_url TEXT;

-- Index pour optimiser les requêtes avec audio
CREATE INDEX IF NOT EXISTS idx_battles_with_audio ON battles(id) 
  WHERE side_a_audio_url IS NOT NULL OR side_b_audio_url IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN battles.side_a_audio_url IS 'URL de preview audio pour le côté A (chanson)';
COMMENT ON COLUMN battles.side_b_audio_url IS 'URL de preview audio pour le côté B (chanson)';

-- Fonction helper pour récupérer automatiquement les URLs audio depuis les tracks
-- Utile lors de la création de battles de type 'song'
CREATE OR REPLACE FUNCTION get_track_audio_url(track_id uuid)
RETURNS TEXT AS $$
DECLARE
  audio_url TEXT;
BEGIN
  -- Essayer d'abord depuis platform_tracks
  SELECT pt.preview_url INTO audio_url
  FROM platform_tracks pt
  WHERE pt.track_id = track_id
    AND pt.preview_url IS NOT NULL
  LIMIT 1;
  
  -- Si pas trouvé, essayer depuis les vidéos YouTube
  IF audio_url IS NULL THEN
    SELECT 'https://www.youtube.com/watch?v=' || yv.video_id INTO audio_url
    FROM youtube_videos yv
    WHERE yv.track_id = track_id
      AND yv.is_active = true
      AND yv.review_status = 'APPROVED'
    ORDER BY yv.view_count DESC
    LIMIT 1;
  END IF;
  
  RETURN audio_url;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_track_audio_url IS 'Récupère une URL audio pour une track depuis platform_tracks ou YouTube';
