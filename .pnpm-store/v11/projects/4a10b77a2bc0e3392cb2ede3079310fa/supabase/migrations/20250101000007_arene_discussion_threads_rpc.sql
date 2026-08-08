-- ============================================================================
-- Migration: Arène communautaire — RPC get_discussion_threads
-- Description: Fonction retournant les fils de discussion actifs avec leur
--              nombre de commentaires et le dernier commentaire.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_discussion_threads(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  thread_type VARCHAR(20),
  thread_id UUID,
  title TEXT,
  comment_count BIGINT,
  latest_comment_body TEXT,
  latest_comment_date TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.thread_type,
    c.thread_id,
    -- Titre : on utilise le type + un extrait de l'ID pour l'instant
    -- (une amélioration future pourra joindre avec les tables artistes/chansons)
    CASE c.thread_type
      WHEN 'free' THEN 'Discussion libre #' || LEFT(c.thread_id::text, 8)
      WHEN 'song' THEN 'Chanson #' || LEFT(c.thread_id::text, 8)
      WHEN 'battle' THEN 'Battle #' || LEFT(c.thread_id::text, 8)
      WHEN 'challenge' THEN 'Défi #' || LEFT(c.thread_id::text, 8)
      ELSE 'Discussion #' || LEFT(c.thread_id::text, 8)
    END AS title,
    COUNT(*) AS comment_count,
    (
      SELECT body FROM comments c2
      WHERE c2.thread_type = c.thread_type
        AND c2.thread_id = c.thread_id
        AND c2.status = 'published'
      ORDER BY c2.created_at DESC
      LIMIT 1
    ) AS latest_comment_body,
    MAX(c.created_at) AS latest_comment_date
  FROM comments c
  WHERE c.status = 'published'
  GROUP BY c.thread_type, c.thread_id
  ORDER BY MAX(c.created_at) DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_discussion_threads(INTEGER) IS
  'Retourne les fils de discussion actifs avec nombre de commentaires et dernier message.';
