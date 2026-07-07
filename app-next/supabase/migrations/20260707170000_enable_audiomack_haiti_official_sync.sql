-- =========================================================
-- Planete HMI - Audiomack Haiti official page sync
-- The "all" Weekly 100 Haiti source is collected from the official
-- Audiomack Haiti page, then filtered by admin Haitian artist status.
-- =========================================================

insert into chart_sources (
  platform,
  source_key,
  display_name,
  chart_context,
  market_code,
  genre_id,
  ingestion_mode,
  source_url,
  is_enabled,
  is_automatic
) values (
  'audiomack',
  'audiomack_haiti_weekly100',
  'Audiomack - Weekly 100 Haiti',
  'Weekly 100: Haiti officiel Audiomack',
  'HT',
  'all',
  'OFFICIAL_EXPORT',
  'https://audiomack.com/geo-charts/playlist/haiti',
  true,
  true
)
on conflict (source_key) do update set
  display_name = excluded.display_name,
  chart_context = excluded.chart_context,
  market_code = excluded.market_code,
  genre_id = excluded.genre_id,
  ingestion_mode = excluded.ingestion_mode,
  source_url = excluded.source_url,
  is_enabled = excluded.is_enabled,
  is_automatic = excluded.is_automatic,
  updated_at = now();
