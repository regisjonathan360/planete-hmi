-- Script pour mettre à jour les battles existantes avec les URLs audio
-- À exécuter après avoir appliqué la migration 20260813_add_audio_to_battles.sql

-- Mettre à jour les battles de type 'song' avec les URLs audio
UPDATE battles
SET 
  side_a_audio_url = get_track_audio_url(side_a_id),
  side_b_audio_url = get_track_audio_url(side_b_id)
WHERE side_a_type = 'song' OR side_b_type = 'song';

-- Afficher un résumé des mises à jour
SELECT 
  COUNT(*) FILTER (WHERE side_a_audio_url IS NOT NULL) as battles_with_audio_a,
  COUNT(*) FILTER (WHERE side_b_audio_url IS NOT NULL) as battles_with_audio_b,
  COUNT(*) FILTER (WHERE side_a_audio_url IS NOT NULL AND side_b_audio_url IS NOT NULL) as battles_with_both_audio,
  COUNT(*) as total_battles
FROM battles
WHERE side_a_type = 'song' OR side_b_type = 'song';

-- Afficher les battles sans audio (pour investigation)
SELECT 
  id,
  title,
  side_a_label,
  side_a_id,
  side_a_audio_url IS NOT NULL as has_audio_a,
  side_b_label,
  side_b_id,
  side_b_audio_url IS NOT NULL as has_audio_b
FROM battles
WHERE (side_a_type = 'song' OR side_b_type = 'song')
  AND (side_a_audio_url IS NULL OR side_b_audio_url IS NULL)
ORDER BY created_at DESC
LIMIT 10;
