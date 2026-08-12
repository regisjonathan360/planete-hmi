-- Script pour synchroniser les vidéos YouTube vers la radio
-- À exécuter manuellement ou via un cron job

-- ========================================
-- PARTIE 1: Synchronisation des vidéos approuvées
-- ========================================

-- Créer ou mettre à jour les pistes radio depuis YouTube
-- On importe les vidéos APPROVED et éligibles avec un track_id valide
INSERT INTO radio_tracks (
  id,
  title,
  artist_name,
  artist_id,
  audio_url,
  cover_image_url,
  duration_seconds,
  genre,
  source,
  source_id,
  is_active,
  created_at,
  updated_at
)
SELECT 
  yv.id,
  COALESCE(yv.display_title, yv.source_title) as title,
  COALESCE(a.name, yc.channel_name, 'Artiste inconnu') as artist_name,
  t.artist_id,
  -- URL audio: vous devrez adapter selon votre système d'extraction
  -- Option 1: URL YouTube direct (nécessite extraction côté serveur)
  'https://www.youtube.com/watch?v=' || yv.video_id as audio_url,
  -- Option 2: Si vous avez déjà extrait l'audio
  -- COALESCE(yv.audio_stream_url, 'https://www.youtube.com/watch?v=' || yv.video_id) as audio_url,
  COALESCE(yv.display_thumbnail_url, yv.source_thumbnail_url) as cover_image_url,
  COALESCE(yv.duration_seconds, 180) as duration_seconds,
  NULL as genre,
  'youtube' as source,
  yv.video_id as source_id,
  yv.is_active,
  yv.created_at,
  NOW() as updated_at
FROM youtube_videos yv
JOIN youtube_channels yc ON yc.channel_id = yv.channel_id
LEFT JOIN tracks t ON t.id = yv.track_id
LEFT JOIN artists a ON a.id = t.artist_id
WHERE yv.review_status = 'APPROVED'
  AND yv.is_eligible = true
  AND yv.is_active = true
  AND yv.video_type IN (
    'OFFICIAL_MUSIC_VIDEO',
    'OFFICIAL_AUDIO',
    'OFFICIAL_LYRIC_VIDEO',
    'OFFICIAL_VISUALIZER',
    'SHORT'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  artist_name = EXCLUDED.artist_name,
  artist_id = EXCLUDED.artist_id,
  audio_url = EXCLUDED.audio_url,
  cover_image_url = EXCLUDED.cover_image_url,
  duration_seconds = EXCLUDED.duration_seconds,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ========================================
-- PARTIE 2: Créer une playlist "Top YouTube"
-- ========================================

-- Créer la playlist si elle n'existe pas
INSERT INTO radio_playlists (name, description, is_default, is_active, shuffle_enabled, repeat_enabled)
VALUES (
  'Top YouTube',
  'Les meilleures vidéos musicales YouTube du moment',
  false,
  true,
  false, -- Pas de shuffle pour garder l'ordre du classement
  true
)
ON CONFLICT DO NOTHING;

-- ========================================
-- PARTIE 3: Remplir la playlist avec le top 50
-- ========================================

-- Supprimer les anciennes entrées de la playlist
DELETE FROM radio_playlist_tracks
WHERE playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Top YouTube' LIMIT 1);

-- Insérer les 50 meilleures vidéos triées par vues
INSERT INTO radio_playlist_tracks (playlist_id, track_id, track_position)
SELECT 
  (SELECT id FROM radio_playlists WHERE name = 'Top YouTube' LIMIT 1),
  rt.id,
  ROW_NUMBER() OVER (ORDER BY yv.view_count DESC, yv.published_at DESC) as track_position
FROM radio_tracks rt
JOIN youtube_videos yv ON yv.id = rt.id
WHERE rt.source = 'youtube'
  AND rt.is_active = true
  AND yv.review_status = 'APPROVED'
  AND yv.is_eligible = true
ORDER BY yv.view_count DESC, yv.published_at DESC
LIMIT 50;

-- ========================================
-- PARTIE 4: Statistiques
-- ========================================

-- Afficher les résultats de la synchronisation
SELECT 
  'Pistes YouTube synchronisées' as label,
  COUNT(*) as count
FROM radio_tracks
WHERE source = 'youtube'
  AND is_active = true

UNION ALL

SELECT 
  'Pistes dans la playlist Top YouTube' as label,
  COUNT(*) as count
FROM radio_playlist_tracks
WHERE playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Top YouTube' LIMIT 1);

-- Afficher le top 10 de la playlist
SELECT 
  pt.track_position,
  rt.title,
  rt.artist_name,
  yv.view_count,
  rt.play_count as radio_plays
FROM radio_playlist_tracks pt
JOIN radio_tracks rt ON rt.id = pt.track_id
JOIN youtube_videos yv ON yv.id = rt.id
WHERE pt.playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Top YouTube' LIMIT 1)
ORDER BY pt.track_position
LIMIT 10;
