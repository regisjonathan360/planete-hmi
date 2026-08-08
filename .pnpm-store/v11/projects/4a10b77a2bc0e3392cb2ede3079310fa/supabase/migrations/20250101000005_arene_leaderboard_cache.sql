-- ============================================================================
-- Migration: Arène communautaire — Vue matérialisée leaderboard_cache
-- Description: Crée une vue matérialisée pour le classement des 50 meilleurs
--              membres, avec fonction de rafraîchissement et index.
-- Requirements: 7.3, 13.4
-- ============================================================================

-- ==========================================================================
-- Materialized View: leaderboard_cache
-- Top 50 membres classés par points_cosmiques DESC, created_at ASC (départage)
-- ==========================================================================
CREATE MATERIALIZED VIEW leaderboard_cache AS
SELECT
  ROW_NUMBER() OVER (ORDER BY points_cosmiques DESC, created_at ASC) AS rank,
  id,
  member_id,
  pseudo,
  avatar_url,
  niveau,
  points_cosmiques,
  created_at
FROM community_profiles
ORDER BY points_cosmiques DESC, created_at ASC
LIMIT 50;

-- ==========================================================================
-- Index unique pour permettre REFRESH MATERIALIZED VIEW CONCURRENTLY
-- (CONCURRENTLY requiert au moins un index unique sur la vue)
-- ==========================================================================
CREATE UNIQUE INDEX idx_leaderboard_cache_rank ON leaderboard_cache(rank);

-- ==========================================================================
-- Fonction: refresh_leaderboard_cache()
-- Rafraîchit la vue matérialisée de manière concurrente (sans bloquer les lectures)
-- SECURITY DEFINER pour permettre l'appel depuis les RPC sans privilèges superuser
-- ==========================================================================
CREATE OR REPLACE FUNCTION refresh_leaderboard_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_cache;
END;
$$;
