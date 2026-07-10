-- Publication manuelle du classement TikTok Global
INSERT INTO chart_published_snapshots (
  chart_source_id, source_key, edition_id, platform,
  period_start, period_end, is_stale, published_at,
  payload
)
SELECT
  cs.id,
  'tiktok_haiti_global',
  ce.id,
  'tiktok',
  ce.period_start,
  ce.period_end,
  false,
  now(),
  jsonb_build_object(
    'source_key', 'tiktok_haiti_global',
    'platform', 'tiktok',
    'display_name', 'Top TikTok Haiti - Global',
    'chart_context', 'Sons populaires en Haïti — Score global',
    'market_code', 'HT',
    'edition', jsonb_build_object(
      'edition_id', ce.id,
      'period_start', ce.period_start,
      'period_end', ce.period_end,
      'published_at', now(),
      'entry_count', ce.entry_count
    ),
    'entries', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'filtered_position', e.source_position,
          'source_position', e.source_position,
          'track_title', e.raw_track_title,
          'artists_text', e.raw_artist_text,
          'metric_value', e.metric_value,
          'metric_unit', 'posts_count',
          'entry_status', 'new'
        ) ORDER BY e.source_position
      )
      FROM chart_entries e
      WHERE e.chart_edition_id = ce.id
    )
  )
FROM chart_sources cs
JOIN chart_editions ce ON ce.chart_source_id = cs.id
WHERE cs.source_key = 'tiktok_haiti_global'
ORDER BY ce.period_end DESC
LIMIT 1
ON CONFLICT (source_key) DO UPDATE SET
  payload = EXCLUDED.payload,
  published_at = EXCLUDED.published_at,
  is_stale = false;
