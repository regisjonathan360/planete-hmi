# 🎵 Radio Planète HMI - Aide-mémoire des commandes

Commandes et requêtes rapides pour gérer votre radio.

---

## 🚀 Installation initiale

### 1. Migrations SQL (dans Supabase)
```sql
-- Migration 1 : Système de base
-- Fichier: supabase/migrations/20260811_radio_system.sql

-- Migration 2 : Synchronisation YouTube
-- Fichier: supabase/migrations/20260812_radio_youtube_sync.sql

-- Fonction manquante
CREATE OR REPLACE FUNCTION increment_track_play_count(track_id uuid)
RETURNS void AS $$ BEGIN
  UPDATE radio_tracks SET play_count = play_count + 1 WHERE id = track_id;
END; $$ LANGUAGE plpgsql;
```

### 2. Vérification de l'installation
```sql
-- Exécutez: supabase/verify-radio-setup.sql
-- Ce script affiche l'état complet de votre installation
```

### 3. Données de test
```sql
-- Exécutez: supabase/seed-radio.sql
-- Crée une playlist de test avec 5 pistes
```

---

## 📋 Gestion des playlists

### Créer une playlist
```sql
INSERT INTO radio_playlists (name, description, is_active, shuffle_enabled, repeat_enabled)
VALUES ('Ma Playlist', 'Description', true, false, true)
RETURNING id, name;
```

### Lister toutes les playlists
```sql
SELECT 
  p.id,
  p.name,
  p.description,
  COUNT(pt.id) as track_count,
  p.is_active
FROM radio_playlists p
LEFT JOIN radio_playlist_tracks pt ON pt.playlist_id = p.id
GROUP BY p.id, p.name, p.description, p.is_active
ORDER BY p.created_at DESC;
```

### Supprimer une playlist
```sql
DELETE FROM radio_playlists WHERE id = 'PLAYLIST_ID';
-- Les pistes associées sont supprimées automatiquement (CASCADE)
```

### Voir le contenu d'une playlist
```sql
SELECT 
  pt.position,
  t.title,
  t.artist_name,
  t.duration_seconds,
  t.source
FROM radio_playlist_tracks pt
JOIN radio_tracks t ON t.id = pt.track_id
WHERE pt.playlist_id = 'PLAYLIST_ID'
ORDER BY pt.position;
```

---

## 🎵 Gestion des pistes

### Ajouter une piste manuellement
```sql
INSERT INTO radio_tracks (
  title, 
  artist_name, 
  audio_url, 
  cover_image_url,
  duration_seconds, 
  source, 
  is_active
)
VALUES (
  'Titre de la chanson',
  'Nom de l''artiste',
  'https://example.com/audio.mp3',
  'https://example.com/cover.jpg',
  180,
  'manual',
  true
)
RETURNING id, title;
```

### Ajouter une piste à une playlist
```sql
-- Position automatique
INSERT INTO radio_playlist_tracks (playlist_id, track_id, position)
VALUES (
  'PLAYLIST_ID',
  'TRACK_ID',
  (SELECT COALESCE(MAX(position), 0) + 1 FROM radio_playlist_tracks WHERE playlist_id = 'PLAYLIST_ID')
);
```

### Retirer une piste d'une playlist
```sql
DELETE FROM radio_playlist_tracks 
WHERE playlist_id = 'PLAYLIST_ID' AND track_id = 'TRACK_ID';
```

### Désactiver une piste (sans la supprimer)
```sql
UPDATE radio_tracks SET is_active = false WHERE id = 'TRACK_ID';
```

### Lister toutes les pistes par source
```sql
SELECT 
  source,
  COUNT(*) as count,
  SUM(play_count) as total_plays,
  SUM(duration_seconds) as total_duration_seconds
FROM radio_tracks
WHERE is_active = true
GROUP BY source
ORDER BY count DESC;
```

---

## ⚙️ Configuration de la radio

### Voir la config actuelle
```sql
SELECT 
  is_live,
  auto_switch_to_chart,
  chart_source_key,
  preload_count,
  crossfade_duration_ms,
  (SELECT name FROM radio_playlists WHERE id = active_playlist_id) as active_playlist_name
FROM radio_config;
```

### Activer/Désactiver la radio
```sql
-- Activer
UPDATE radio_config SET is_live = true;

-- Désactiver
UPDATE radio_config SET is_live = false;
```

### Changer la playlist active
```sql
UPDATE radio_config 
SET 
  active_playlist_id = 'PLAYLIST_ID',
  auto_switch_to_chart = false,
  updated_at = NOW();
```

### Activer le mode auto-chart
```sql
UPDATE radio_config 
SET 
  auto_switch_to_chart = true,
  chart_source_key = 'youtube-week',
  updated_at = NOW();
```

### Régler le préchargement
```sql
UPDATE radio_config SET preload_count = 5; -- 1 à 10
```

### Régler le crossfade
```sql
UPDATE radio_config SET crossfade_duration_ms = 3000; -- 0 à 10000
```

---

## 🔗 Synchronisation YouTube

### Via SQL (manuel)
```sql
-- Exécutez: supabase/sync-youtube-to-radio.sql
-- Importe les vidéos approuvées et crée la playlist "Top YouTube"
```

### Via fonction RPC
```sql
SELECT * FROM sync_youtube_to_radio();
-- Retourne: synced_count, updated_count, total_count
```

### Via API (depuis votre code)
```bash
curl -X POST http://localhost:3000/api/admin/radio/sync \
  -H "Content-Type: application/json" \
  -d '{
    "playlistName": "Top YouTube",
    "limit": 50
  }'
```

### Vérifier l'état de la synchronisation
```sql
SELECT 
  (SELECT COUNT(*) FROM youtube_videos 
   WHERE review_status = 'APPROVED' AND is_eligible = true) as youtube_eligible,
  (SELECT COUNT(*) FROM radio_tracks WHERE source = 'youtube') as in_radio,
  (SELECT COUNT(*) FROM radio_playlist_tracks 
   WHERE playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Top YouTube')) as in_playlist;
```

---

## 📊 Statistiques

### Pistes les plus écoutées
```sql
SELECT 
  title,
  artist_name,
  play_count,
  source
FROM radio_tracks
WHERE is_active = true
ORDER BY play_count DESC
LIMIT 20;
```

### Historique récent
```sql
SELECT 
  h.played_at,
  t.title,
  t.artist_name,
  h.listener_count,
  h.completed
FROM radio_play_history h
JOIN radio_tracks t ON t.id = h.track_id
ORDER BY h.played_at DESC
LIMIT 50;
```

### Statistiques par source
```sql
SELECT 
  source,
  COUNT(*) as total_tracks,
  SUM(play_count) as total_plays,
  AVG(play_count)::integer as avg_plays,
  SUM(duration_seconds)/60 as total_minutes
FROM radio_tracks
WHERE is_active = true
GROUP BY source;
```

### Auditeurs actuels
```sql
SELECT 
  listener_count,
  current_track_id,
  (SELECT title || ' - ' || artist_name FROM radio_tracks WHERE id = current_track_id) as now_playing,
  started_at,
  updated_at
FROM radio_stats;
```

---

## 🛠️ Maintenance

### Réorganiser les positions d'une playlist
```sql
-- Recalculer les positions (si désordonnées)
WITH ordered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY position, created_at) as new_position
  FROM radio_playlist_tracks
  WHERE playlist_id = 'PLAYLIST_ID'
)
UPDATE radio_playlist_tracks
SET position = ordered.new_position
FROM ordered
WHERE radio_playlist_tracks.id = ordered.id;
```

### Nettoyer l'historique ancien
```sql
-- Supprimer les écoutes de plus de 90 jours
DELETE FROM radio_play_history 
WHERE played_at < NOW() - INTERVAL '90 days';
```

### Mettre à jour les métadonnées d'une piste
```sql
UPDATE radio_tracks
SET 
  title = 'Nouveau titre',
  artist_name = 'Nouvel artiste',
  cover_image_url = 'https://example.com/new-cover.jpg',
  updated_at = NOW()
WHERE id = 'TRACK_ID';
```

---

## 🐛 Dépannage

### Radio ne démarre pas
```sql
-- Vérifier qu'il y a une config
SELECT COUNT(*) FROM radio_config; -- Doit être > 0

-- Vérifier que la radio est active
SELECT is_live FROM radio_config; -- Doit être true

-- Vérifier qu'il y a des pistes
SELECT COUNT(*) FROM radio_tracks WHERE is_active = true; -- Doit être > 0

-- Vérifier la playlist active
SELECT 
  rc.active_playlist_id,
  rp.name,
  COUNT(rpt.id) as track_count
FROM radio_config rc
LEFT JOIN radio_playlists rp ON rp.id = rc.active_playlist_id
LEFT JOIN radio_playlist_tracks rpt ON rpt.playlist_id = rp.id
GROUP BY rc.active_playlist_id, rp.name;
```

### Piste ne joue pas
```sql
-- Vérifier l'URL audio
SELECT id, title, audio_url FROM radio_tracks WHERE id = 'TRACK_ID';

-- Tester l'URL dans un navigateur
-- Copier-coller l'audio_url dans Chrome/Firefox

-- Vérifier que la piste est active
SELECT is_active FROM radio_tracks WHERE id = 'TRACK_ID';
```

### Playlist vide
```sql
-- Ajouter toutes les pistes actives à une playlist
INSERT INTO radio_playlist_tracks (playlist_id, track_id, position)
SELECT 
  'PLAYLIST_ID',
  id,
  ROW_NUMBER() OVER (ORDER BY created_at)
FROM radio_tracks
WHERE is_active = true
  AND source = 'manual' -- ou autre source
ON CONFLICT DO NOTHING;
```

---

## 🔑 Commandes admin rapides

### Réinitialiser complètement la radio
```sql
-- ⚠️ ATTENTION: Supprime toutes les données radio
TRUNCATE TABLE radio_play_history;
TRUNCATE TABLE radio_playlist_tracks CASCADE;
TRUNCATE TABLE radio_playlists CASCADE;
TRUNCATE TABLE radio_tracks CASCADE;
TRUNCATE TABLE radio_stats;
DELETE FROM radio_config;

-- Puis réexécutez seed-radio.sql
```

### Dupliquer une playlist
```sql
-- 1. Créer la nouvelle playlist
INSERT INTO radio_playlists (name, description, is_active, shuffle_enabled, repeat_enabled)
SELECT 
  name || ' (copie)',
  description,
  false,
  shuffle_enabled,
  repeat_enabled
FROM radio_playlists
WHERE id = 'PLAYLIST_SOURCE_ID'
RETURNING id;

-- 2. Copier les pistes (remplacez NEW_PLAYLIST_ID)
INSERT INTO radio_playlist_tracks (playlist_id, track_id, position)
SELECT 
  'NEW_PLAYLIST_ID',
  track_id,
  position
FROM radio_playlist_tracks
WHERE playlist_id = 'PLAYLIST_SOURCE_ID';
```

### Exporter une playlist en CSV
```sql
COPY (
  SELECT 
    pt.position,
    t.title,
    t.artist_name,
    t.audio_url,
    t.duration_seconds
  FROM radio_playlist_tracks pt
  JOIN radio_tracks t ON t.id = pt.track_id
  WHERE pt.playlist_id = 'PLAYLIST_ID'
  ORDER BY pt.position
) TO '/tmp/playlist_export.csv' CSV HEADER;
```

---

## 🎯 Scénarios d'utilisation

### Créer une radio du top YouTube
```sql
-- 1. Synchroniser
SELECT * FROM sync_youtube_to_radio();

-- 2. Activer la playlist
UPDATE radio_config 
SET 
  active_playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Top YouTube'),
  is_live = true;
```

### Créer une playlist thématique
```sql
-- 1. Créer la playlist
INSERT INTO radio_playlists (name, description)
VALUES ('Konpa Hits', 'Les meilleurs hits konpa')
RETURNING id;

-- 2. Ajouter des pistes filtrées par genre ou artiste
INSERT INTO radio_playlist_tracks (playlist_id, track_id, position)
SELECT 
  'PLAYLIST_ID',
  id,
  ROW_NUMBER() OVER (ORDER BY play_count DESC)
FROM radio_tracks
WHERE artist_name ILIKE '%konpa%'
  AND is_active = true;
```

### Rotation quotidienne automatique
```sql
-- Mettre à jour la playlist avec les plus récentes vidéos
DELETE FROM radio_playlist_tracks 
WHERE playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Nouveautés');

INSERT INTO radio_playlist_tracks (playlist_id, track_id, position)
SELECT 
  (SELECT id FROM radio_playlists WHERE name = 'Nouveautés'),
  id,
  ROW_NUMBER() OVER (ORDER BY created_at DESC)
FROM radio_tracks
WHERE is_active = true
  AND created_at > NOW() - INTERVAL '7 days'
LIMIT 30;
```

---

## 📱 API REST

### GET Playlist active
```bash
curl http://localhost:3000/api/radio/playlist
```

### POST Enregistrer une écoute
```bash
curl -X POST http://localhost:3000/api/radio/play \
  -H "Content-Type: application/json" \
  -d '{"trackId": "TRACK_ID"}'
```

### GET Config (admin)
```bash
curl http://localhost:3000/api/admin/radio/config
```

### PUT Config (admin)
```bash
curl -X PUT http://localhost:3000/api/admin/radio/config \
  -H "Content-Type: application/json" \
  -d '{
    "is_live": true,
    "preload_count": 3,
    "crossfade_duration_ms": 2000
  }'
```

---

**💡 Astuce** : Sauvegardez ce fichier comme référence rapide !
