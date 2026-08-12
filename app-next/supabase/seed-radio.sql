-- Script de seed pour tester le système de radio
-- Exécutez ce script dans l'éditeur SQL de Supabase après avoir appliqué la migration

-- 1. Créer une playlist de test
INSERT INTO radio_playlists (id, name, description, is_default, is_active, shuffle_enabled, repeat_enabled)
VALUES 
  (gen_random_uuid(), 'Playlist Test', 'Playlist de démonstration pour tester la radio', true, true, true, true)
ON CONFLICT DO NOTHING;

-- Récupérer l'ID de la playlist (vous devrez copier cet ID)
DO $$
DECLARE
  playlist_id uuid;
BEGIN
  SELECT id INTO playlist_id FROM radio_playlists WHERE name = 'Playlist Test' LIMIT 1;
  RAISE NOTICE 'Playlist ID: %', playlist_id;
END $$;

-- 2. Créer des pistes de test avec des URLs audio de démonstration
-- NOTE: Ces URLs sont des exemples. Remplacez-les par de vraies URLs audio MP3
INSERT INTO radio_tracks (title, artist_name, audio_url, cover_image_url, duration_seconds, source, is_active)
VALUES 
  (
    'Piste de Test 1',
    'Artiste Demo',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://via.placeholder.com/300x300.png?text=Track+1',
    300,
    'manual',
    true
  ),
  (
    'Piste de Test 2',
    'Artiste Demo',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://via.placeholder.com/300x300.png?text=Track+2',
    320,
    'manual',
    true
  ),
  (
    'Piste de Test 3',
    'Artiste Demo',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://via.placeholder.com/300x300.png?text=Track+3',
    280,
    'manual',
    true
  ),
  (
    'Piste de Test 4',
    'Artiste Demo',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://via.placeholder.com/300x300.png?text=Track+4',
    310,
    'manual',
    true
  ),
  (
    'Piste de Test 5',
    'Artiste Demo',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://via.placeholder.com/300x300.png?text=Track+5',
    290,
    'manual',
    true
  )
ON CONFLICT DO NOTHING;

-- 3. Lier les pistes à la playlist
-- Exécutez cette requête APRÈS avoir vérifié que les pistes et la playlist existent
INSERT INTO radio_playlist_tracks (playlist_id, track_id, track_position)
SELECT 
  (SELECT id FROM radio_playlists WHERE name = 'Playlist Test' LIMIT 1),
  t.id,
  ROW_NUMBER() OVER (ORDER BY t.created_at)
FROM radio_tracks t
WHERE t.source = 'manual'
  AND t.title LIKE 'Piste de Test%'
ON CONFLICT DO NOTHING;

-- 4. Configurer la radio pour utiliser cette playlist
UPDATE radio_config
SET 
  active_playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Playlist Test' LIMIT 1),
  auto_switch_to_chart = false,
  is_live = true,
  preload_count = 3,
  crossfade_duration_ms = 2000
WHERE id = (SELECT id FROM radio_config LIMIT 1);

-- Si aucune config n'existe, en créer une
INSERT INTO radio_config (active_playlist_id, auto_switch_to_chart, is_live, preload_count, crossfade_duration_ms)
SELECT 
  (SELECT id FROM radio_playlists WHERE name = 'Playlist Test' LIMIT 1),
  false,
  true,
  3,
  2000
WHERE NOT EXISTS (SELECT 1 FROM radio_config);

-- 5. Initialiser les stats radio
INSERT INTO radio_stats (current_track_id, listener_count, started_at)
SELECT 
  (SELECT id FROM radio_tracks WHERE source = 'manual' ORDER BY created_at LIMIT 1),
  0,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM radio_stats);

-- Vérification : afficher la configuration
SELECT 
  rc.is_live,
  rc.auto_switch_to_chart,
  rc.preload_count,
  rc.crossfade_duration_ms,
  rp.name as playlist_name,
  COUNT(rpt.id) as track_count
FROM radio_config rc
LEFT JOIN radio_playlists rp ON rp.id = rc.active_playlist_id
LEFT JOIN radio_playlist_tracks rpt ON rpt.playlist_id = rp.id
GROUP BY rc.id, rc.is_live, rc.auto_switch_to_chart, rc.preload_count, rc.crossfade_duration_ms, rp.name;

-- Afficher les pistes de la playlist active
SELECT 
  t.title,
  t.artist_name,
  t.duration_seconds,
  t.audio_url,
  pt.track_position
FROM radio_playlist_tracks pt
JOIN radio_tracks t ON t.id = pt.track_id
JOIN radio_playlists p ON p.id = pt.playlist_id
WHERE p.name = 'Playlist Test'
ORDER BY pt.track_position;
