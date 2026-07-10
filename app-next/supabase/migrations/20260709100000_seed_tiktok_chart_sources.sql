-- =========================================================
-- Planète HMI — Module TikTok Charts : seed chart_sources
-- Insère les 3 sources de classement TikTok pour Haïti :
--   - tiktok_haiti_global (Score global)
--   - tiktok_haiti_en_montee (Croissance 7 jours)
--   - tiktok_haiti_nouveautes (Découvertes récentes 14 jours)
-- Idempotent via ON CONFLICT (source_key) DO UPDATE.
-- =========================================================

INSERT INTO chart_sources (
  platform,
  source_key,
  display_name,
  chart_context,
  market_code,
  ingestion_mode,
  is_enabled,
  is_automatic
)
VALUES
  (
    'tiktok',
    'tiktok_haiti_global',
    'Top TikTok Haiti - Global',
    'Sons populaires en Haïti — Score global',
    'HT',
    'OFFICIAL_API',
    true,
    true
  ),
  (
    'tiktok',
    'tiktok_haiti_en_montee',
    'Top TikTok Haiti - En montée',
    'Sons populaires en Haïti — Croissance 7 jours',
    'HT',
    'OFFICIAL_API',
    true,
    true
  ),
  (
    'tiktok',
    'tiktok_haiti_nouveautes',
    'Top TikTok Haiti - Nouveautés',
    'Sons populaires en Haïti — Découvertes récentes (14 jours)',
    'HT',
    'OFFICIAL_API',
    true,
    true
  )
ON CONFLICT (source_key) DO UPDATE SET
  platform       = EXCLUDED.platform,
  display_name   = EXCLUDED.display_name,
  chart_context  = EXCLUDED.chart_context,
  market_code    = EXCLUDED.market_code,
  ingestion_mode = EXCLUDED.ingestion_mode,
  is_enabled     = EXCLUDED.is_enabled,
  is_automatic   = EXCLUDED.is_automatic;
