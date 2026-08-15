-- Vérification que la radio est propre (aucune donnée fictive)
-- Exécutez ce script pour vérifier l'état de nettoyage

SELECT 
  '📊 RAPPORT DE NETTOYAGE RADIO' as section
UNION ALL
SELECT ''
UNION ALL
SELECT '🗑️ DONNÉES FICTIVES (DEVRAIT ÊTRE 0)'
UNION ALL
SELECT '================================'
UNION ALL
SELECT 
  CONCAT(
    'Pistes manuelles de test: ',
    (SELECT COUNT(*) FROM radio_tracks WHERE source = 'manual' OR title LIKE '%test%'),
    ' ❌ (devrait être 0)'
  )
UNION ALL
SELECT 
  CONCAT(
    'Playlists de test: ',
    (SELECT COUNT(*) FROM radio_playlists WHERE name LIKE '%test%' OR name LIKE '%demo%'),
    ' ❌ (devrait être 0)'
  )
UNION ALL
SELECT 
  CONCAT(
    'Associations test: ',
    (SELECT COUNT(*) FROM radio_playlist_tracks 
     WHERE playlist_id IN (SELECT id FROM radio_playlists WHERE name LIKE '%test%')),
    ' ❌ (devrait être 0)'
  )
UNION ALL
SELECT ''
UNION ALL
SELECT '✅ DONNÉES RÉELLES (DEVRAIT ÊTRE > 0)'
UNION ALL
SELECT '================================'
UNION ALL
SELECT 
  CONCAT(
    'Classements publiés: ',
    (SELECT COUNT(*) FROM chart_editions WHERE status = 'published'),
    ' ✅'
  )
UNION ALL
SELECT 
  CONCAT(
    'Classements avec pistes: ',
    (SELECT COUNT(*) FROM chart_editions ce WHERE EXISTS (SELECT 1 FROM chart_entries ce2 WHERE ce2.chart_edition_id = ce.id)),
    ' ✅'
  )
UNION ALL
SELECT 
  CONCAT(
    'Chansons du catalogue: ',
    (SELECT COUNT(*) FROM tracks),
    ' ✅'
  )
UNION ALL
SELECT 
  CONCAT(
    'Vidéos YouTube approuvées: ',
    (SELECT COUNT(*) FROM youtube_videos WHERE review_status = 'APPROVED' AND is_eligible = true),
    ' ✅'
  )
UNION ALL
SELECT 
  CONCAT(
    'Pistes Spotify/Audiomack: ',
    (SELECT COUNT(*) FROM platform_tracks WHERE external_url IS NOT NULL),
    ' ✅'
  )
UNION ALL
SELECT ''
UNION ALL
SELECT '⚙️ CONFIGURATION RADIO'
UNION ALL
SELECT '================================'
UNION ALL
SELECT 
  CONCAT(
    'Config active: ',
    (CASE WHEN EXISTS(SELECT 1 FROM radio_config) THEN 'OUI ✅' ELSE 'NON ❌' END)
  )
UNION ALL
SELECT 
  CONCAT(
    'Playlist active: ',
    COALESCE((SELECT name FROM radio_playlists WHERE id = (SELECT active_playlist_id FROM radio_config LIMIT 1)), 'Aucune (normal)')
  )
UNION ALL
SELECT 
  CONCAT(
    'Mode auto-chart: ',
    (CASE WHEN (SELECT auto_switch_to_chart FROM radio_config LIMIT 1) = true THEN 'ACTIVÉ' ELSE 'Désactivé (normal)' END)
  )
UNION ALL
SELECT 
  CONCAT(
    'Radio en direct: ',
    (CASE WHEN (SELECT is_live FROM radio_config LIMIT 1) = true THEN 'OUI ✅' ELSE 'NON' END)
  )
UNION ALL
SELECT ''
UNION ALL
SELECT '📝 RECOMMANDATIONS'
UNION ALL
SELECT '================================'
UNION ALL
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM radio_tracks WHERE source = 'manual') > 0 
      THEN '❌ Il reste des pistes de test - exécutez 20260816_remove_dummy_data.sql'
    WHEN (SELECT COUNT(*) FROM chart_editions WHERE status = 'published') = 0
      THEN '⚠️ Aucun classement publié - créez un classement ou importez des données'
    WHEN (SELECT COUNT(*) FROM platform_tracks WHERE external_url IS NOT NULL) = 0
      THEN '⚠️ Aucune URL audio trouvée - les pistes ne joueront pas'
    ELSE '✅ RADIO PRÊTE - Configurez-la dans /admin/radio'
  END
UNION ALL
SELECT '';

-- Message récapitulatif final
DO $$
DECLARE
  dummy_count INT;
  chart_count INT;
BEGIN
  SELECT COUNT(*) INTO dummy_count FROM radio_tracks WHERE source = 'manual' OR title LIKE '%test%';
  SELECT COUNT(*) INTO chart_count FROM chart_editions WHERE status = 'published';
  
  IF dummy_count > 0 THEN
    RAISE WARNING '🚨 ATTENTION: Données fictives trouvées. Exécutez 20260816_remove_dummy_data.sql';
  END IF;
  
  IF dummy_count = 0 AND chart_count > 0 THEN
    RAISE NOTICE '✅ Radio nettoyée et prête pour vraies données';
  END IF;
END $$;
