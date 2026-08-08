-- =========================================================
-- Planète HMI — Classements alimentés par une playlist Spotify
--
-- 1. Spotify : le classement « Spotify — Populaire en Haïti » n'avait aucune
--    source de collecte. Il est désormais construit depuis la playlist
--    « Top 50 GlobHaitian ».
-- 2. TikTok : deuxième source, indépendante de l'API Research, depuis la
--    playlist « TikTok Viral Haiti ».
--
-- Ces playlists donnent un ORDRE éditorial, pas des métriques d'écoute : le
-- mode d'ingestion reste VERIFIED_ADMIN_IMPORT (chaque édition est vérifiée
-- puis publiée à la main).
-- =========================================================

UPDATE public.chart_sources
SET display_name = 'Spotify — Top 50 GlobHaitian',
    chart_context = 'Top 50 GlobHaitian (playlist Spotify)',
    source_url = 'https://open.spotify.com/playlist/1cXIKrbi0PwJkNQgrzOokU',
    market_code = 'HT',
    ingestion_mode = 'VERIFIED_ADMIN_IMPORT',
    is_enabled = true,
    is_automatic = false,
    updated_at = now()
WHERE source_key = 'spotify_haiti_popular';
-- Filet si la source Spotify n'existait pas encore (base sans seed de démo).
INSERT INTO public.chart_sources (
  platform, source_key, display_name, chart_context, market_code, genre_id,
  ingestion_mode, source_url, is_enabled, is_automatic
)
VALUES (
  'spotify',
  'spotify_haiti_popular',
  'Spotify — Top 50 GlobHaitian',
  'Top 50 GlobHaitian (playlist Spotify)',
  'HT',
  'all',
  'VERIFIED_ADMIN_IMPORT',
  'https://open.spotify.com/playlist/1cXIKrbi0PwJkNQgrzOokU',
  true,
  false
)
ON CONFLICT (source_key) DO NOTHING;
INSERT INTO public.chart_sources (
  platform, source_key, display_name, chart_context, market_code, genre_id,
  ingestion_mode, source_url, is_enabled, is_automatic
)
VALUES (
  'tiktok',
  'tiktok_haiti_viral_playlist',
  'Top TikTok Haiti — Viral (playlist)',
  'TikTok Viral Haiti (playlist Spotify)',
  'HT',
  'all',
  'VERIFIED_ADMIN_IMPORT',
  'https://open.spotify.com/playlist/4SRJiaVoFWqcVLKvsvd5dH',
  true,
  false
)
ON CONFLICT (source_key) DO UPDATE SET
  platform       = EXCLUDED.platform,
  display_name   = EXCLUDED.display_name,
  chart_context  = EXCLUDED.chart_context,
  market_code    = EXCLUDED.market_code,
  ingestion_mode = EXCLUDED.ingestion_mode,
  source_url     = EXCLUDED.source_url,
  is_enabled     = EXCLUDED.is_enabled,
  updated_at     = now();
COMMENT ON COLUMN public.chart_sources.source_url IS
  'URL de collecte. Pour les classements issus d''une playlist, l''administrateur peut la changer depuis l''admin.';
