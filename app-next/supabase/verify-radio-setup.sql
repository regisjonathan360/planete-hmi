-- Script de vérification de l'installation de la radio
-- Exécutez ce script pour vérifier que tout est correctement configuré

-- ========================================
-- 1. VÉRIFICATION DES TABLES
-- ========================================

SELECT 
  '✅ TABLES' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 6 THEN '✅ Toutes les tables existent'
    ELSE '❌ Manque ' || (6 - COUNT(*))::text || ' table(s)'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'radio_tracks',
    'radio_playlists',
    'radio_playlist_tracks',
    'radio_config',
    'radio_play_history',
    'radio_stats'
  );

-- ========================================
-- 2. VÉRIFICATION DES FONCTIONS
-- ========================================

SELECT 
  '✅ FONCTIONS' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Fonctions SQL OK'
    ELSE '❌ Manque des fonctions'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'sync_youtube_to_radio',
    'get_chart_radio_tracks',
    'increment_track_play_count'
  );

-- ========================================
-- 3. VÉRIFICATION DE LA CONFIGURATION
-- ========================================

SELECT 
  '⚙️ CONFIGURATION' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM radio_config) THEN '✅ Config existe'
    ELSE '❌ Aucune config trouvée'
  END as status,
  (SELECT is_live FROM radio_config LIMIT 1) as is_live,
  (SELECT CASE WHEN auto_switch_to_chart THEN 'Auto-chart: ' || chart_source_key ELSE 'Playlist manuelle' END FROM radio_config LIMIT 1) as mode,
  (SELECT preload_count FROM radio_config LIMIT 1) as preload_count,
  (SELECT crossfade_duration_ms FROM radio_config LIMIT 1) as crossfade_ms;

-- ========================================
-- 4. VÉRIFICATION DES PISTES
-- ========================================

SELECT 
  '🎵 PISTES' as check_type,
  source,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ ' || COUNT(*)::text || ' piste(s)'
    ELSE '⚠️ Aucune piste'
  END as status
FROM radio_tracks
WHERE is_active = true
GROUP BY source

UNION ALL

SELECT 
  '🎵 PISTES' as check_type,
  'TOTAL' as source,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Radio prête'
    ELSE '❌ Ajoutez des pistes'
  END as status
FROM radio_tracks
WHERE is_active = true;

-- ========================================
-- 5. VÉRIFICATION DES PLAYLISTS
-- ========================================

SELECT 
  '📋 PLAYLISTS' as check_type,
  p.name,
  COUNT(pt.id) as track_count,
  CASE 
    WHEN COUNT(pt.id) > 0 THEN '✅ ' || COUNT(pt.id)::text || ' piste(s)'
    ELSE '⚠️ Playlist vide'
  END as status,
  p.is_active,
  CASE WHEN p.id = (SELECT active_playlist_id FROM radio_config LIMIT 1) THEN '🔴 ACTIVE' ELSE '' END as is_current
FROM radio_playlists p
LEFT JOIN radio_playlist_tracks pt ON pt.playlist_id = p.id
GROUP BY p.id, p.name, p.is_active
ORDER BY p.created_at DESC;

-- ========================================
-- 6. VÉRIFICATION DE L'INTÉGRATION YOUTUBE
-- ========================================

SELECT 
  '🔗 YOUTUBE' as check_type,
  COUNT(*) as youtube_approved,
  (SELECT COUNT(*) FROM radio_tracks WHERE source = 'youtube') as in_radio,
  CASE 
    WHEN (SELECT COUNT(*) FROM radio_tracks WHERE source = 'youtube') > 0 
      THEN '✅ Synchronisation active'
    WHEN COUNT(*) > 0 
      THEN '⚠️ Vidéos disponibles, exécutez sync'
    ELSE '⚠️ Aucune vidéo YouTube'
  END as status
FROM youtube_videos
WHERE review_status = 'APPROVED'
  AND is_eligible = true
  AND is_active = true;

-- ========================================
-- 7. VÉRIFICATION DES STATISTICS
-- ========================================

SELECT 
  '📊 STATISTIQUES' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM radio_stats) THEN '✅ Stats initialisées'
    ELSE '⚠️ Pas encore de stats'
  END as status,
  (SELECT listener_count FROM radio_stats LIMIT 1) as listeners,
  (SELECT COUNT(*) FROM radio_play_history) as play_history_count;

-- ========================================
-- 8. RÉSUMÉ GLOBAL
-- ========================================

SELECT 
  '🎯 RÉSUMÉ GLOBAL' as section,
  'État de la radio' as item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM radio_config WHERE is_live = true)
      AND EXISTS (SELECT 1 FROM radio_tracks WHERE is_active = true)
      AND EXISTS (SELECT 1 FROM radio_playlists WHERE is_active = true)
    THEN '✅ RADIO OPÉRATIONNELLE'
    WHEN EXISTS (SELECT 1 FROM radio_config)
      AND EXISTS (SELECT 1 FROM radio_tracks WHERE is_active = true)
    THEN '⚠️ PRESQUE PRÊTE - Configurez la playlist active'
    WHEN EXISTS (SELECT 1 FROM radio_config)
    THEN '❌ PAS PRÊTE - Ajoutez des pistes'
    ELSE '❌ PAS INSTALLÉE - Exécutez les migrations'
  END as status;

-- ========================================
-- 9. ACTIONS RECOMMANDÉES
-- ========================================

SELECT 
  '💡 ACTIONS' as section,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM radio_config) 
      THEN 'Exécutez la migration 20260811_radio_system.sql'
    WHEN NOT EXISTS (SELECT 1 FROM radio_tracks WHERE is_active = true)
      THEN 'Exécutez seed-radio.sql OU sync-youtube-to-radio.sql'
    WHEN NOT EXISTS (
      SELECT 1 FROM radio_playlists p
      JOIN radio_playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.is_active = true
    )
      THEN 'Créez une playlist et ajoutez-y des pistes'
    WHEN (SELECT is_live FROM radio_config LIMIT 1) = false
      THEN 'Activez la radio depuis /admin/radio'
    ELSE '✅ Tout est prêt ! Visitez votre site et cliquez sur Play ▶️'
  END as action_recommandee;

-- ========================================
-- 10. APERÇU DE LA PLAYLIST ACTIVE
-- ========================================

SELECT 
  '🎧 PLAYLIST EN COURS' as section,
  pt.track_position,
  t.title,
  t.artist_name,
  t.duration_seconds || 's' as duration,
  t.source,
  t.play_count as plays
FROM radio_config rc
JOIN radio_playlists p ON p.id = rc.active_playlist_id
JOIN radio_playlist_tracks pt ON pt.playlist_id = p.id
JOIN radio_tracks t ON t.id = pt.track_id
WHERE t.is_active = true
ORDER BY pt.track_position
LIMIT 10;
