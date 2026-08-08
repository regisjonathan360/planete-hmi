-- Supprimer l'ancienne source TikTok (seed de démo)
DELETE FROM chart_published_snapshots WHERE source_key = 'tiktok_haiti_sounds';
DELETE FROM chart_entries WHERE chart_edition_id IN (
  SELECT id FROM chart_editions WHERE chart_source_id = (
    SELECT id FROM chart_sources WHERE source_key = 'tiktok_haiti_sounds'
  )
);
DELETE FROM chart_editions WHERE chart_source_id = (
  SELECT id FROM chart_sources WHERE source_key = 'tiktok_haiti_sounds'
);
DELETE FROM chart_sources WHERE source_key = 'tiktok_haiti_sounds';
