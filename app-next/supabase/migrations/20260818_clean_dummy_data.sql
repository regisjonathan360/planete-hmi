-- Clean Dummy Data - PostgreSQL Version
-- Removes all test/dummy radio data

-- 1. Disable triggers temporarily (optional but safer)
ALTER TABLE radio_playlist_tracks DISABLE TRIGGER ALL;
ALTER TABLE radio_play_history DISABLE TRIGGER ALL;
ALTER TABLE radio_stats DISABLE TRIGGER ALL;

-- 2. Delete test tracks
DELETE FROM radio_tracks 
WHERE 
  source = 'manual'
  OR title ILIKE '%test%'
  OR title ILIKE '%demo%'
  OR title ILIKE '%soundhelix%'
  OR artist_name ILIKE '%test%'
  OR artist_name ILIKE '%demo%'
  OR source_id IS NULL 
  OR source_id = '';

-- 3. Delete test playlists
DELETE FROM radio_playlists 
WHERE 
  name ILIKE '%test%'
  OR name ILIKE '%demo%'
  OR name = 'Playlist Test'
  OR name = 'Top YouTube'
  OR name ILIKE '%soundhelix%';

-- 4. Clear play history (test data)
DELETE FROM radio_play_history;

-- 5. Reset stats
DELETE FROM radio_stats;

-- 6. Reset configuration to defaults
UPDATE radio_config 
SET 
  active_playlist_id = NULL,
  auto_switch_to_chart = FALSE,
  chart_source_key = NULL,
  preload_count = 3,
  crossfade_duration_ms = 2000,
  is_live = TRUE;

-- Re-enable triggers
ALTER TABLE radio_playlist_tracks ENABLE TRIGGER ALL;
ALTER TABLE radio_play_history ENABLE TRIGGER ALL;
ALTER TABLE radio_stats ENABLE TRIGGER ALL;

-- Verification
SELECT 
  'CLEANUP COMPLETE' as status,
  (SELECT COUNT(*) FROM radio_tracks) as remaining_tracks,
  (SELECT COUNT(*) FROM radio_playlists) as remaining_playlists,
  (SELECT COUNT(*) FROM radio_playlist_tracks) as track_associations,
  (SELECT COUNT(*) FROM radio_play_history) as play_history_records,
  (SELECT COUNT(*) FROM radio_stats) as stats_records;

-- Show what's left (should be empty or only real data)
SELECT 
  'Remaining Tracks' as type,
  COUNT(*) as count,
  STRING_AGG(DISTINCT source, ', ') as sources
FROM radio_tracks
GROUP BY type

UNION ALL

SELECT 
  'Remaining Playlists' as type,
  COUNT(*) as count,
  STRING_AGG(name, ', ') as details
FROM radio_playlists
GROUP BY type;
