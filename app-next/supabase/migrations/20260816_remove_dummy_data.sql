-- Suppression de toutes les données fictives/de test de la radio
-- Exécutez ce script pour nettoyer complètement la radio

-- Désactiver les contraintes de clés étrangères temporairement
ALTER TABLE radio_playlist_tracks DISABLE TRIGGER ALL;
ALTER TABLE radio_play_history DISABLE TRIGGER ALL;
ALTER TABLE radio_stats DISABLE TRIGGER ALL;

-- 1. Supprimer les pistes de test
DELETE FROM radio_tracks 
WHERE source IN ('manual') 
  OR title LIKE '%test%' COLLATE utf8mb4_general_ci
  OR title LIKE '%demo%' COLLATE utf8mb4_general_ci
  OR artist_name LIKE '%test%' COLLATE utf8mb4_general_ci
  OR source_id IS NULL OR source_id = '';

-- 2. Supprimer les playlists de test (qui perdront leurs pistes en cascade)
DELETE FROM radio_playlists 
WHERE name LIKE '%test%' COLLATE utf8mb4_general_ci
  OR name LIKE '%demo%' COLLATE utf8mb4_general_ci
  OR name = 'Playlist Test'
  OR name = 'Top YouTube';

-- 3. Supprimer tout l'historique de lecture (données de test)
DELETE FROM radio_play_history;

-- 4. Réinitialiser les stats
DELETE FROM radio_stats;

-- 5. Réinitialiser la configuration radio à ses valeurs par défaut
UPDATE radio_config 
SET 
  active_playlist_id = NULL,
  auto_switch_to_chart = FALSE,
  chart_source_key = NULL,
  preload_count = 3,
  crossfade_duration_ms = 2000,
  is_live = TRUE;

-- Réactiver les triggers
ALTER TABLE radio_playlist_tracks ENABLE TRIGGER ALL;
ALTER TABLE radio_play_history ENABLE TRIGGER ALL;
ALTER TABLE radio_stats ENABLE TRIGGER ALL;

-- Vérification du nettoyage
SELECT 
  '🗑️ NETTOYAGE RADIO COMPLÉTÉ' as status,
  (SELECT COUNT(*) FROM radio_tracks) as remaining_tracks,
  (SELECT COUNT(*) FROM radio_playlists) as remaining_playlists,
  (SELECT COUNT(*) FROM radio_playlist_tracks) as remaining_associations,
  (SELECT COUNT(*) FROM radio_play_history) as remaining_history,
  (SELECT COUNT(*) FROM radio_stats) as remaining_stats;

-- Note: Les données fictives ont été supprimées.
-- La radio est maintenant vide et attend les vraies données (classements, sources, playlists)
