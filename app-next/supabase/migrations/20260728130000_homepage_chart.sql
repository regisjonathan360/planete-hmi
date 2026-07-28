-- =========================================================
-- Planète HMI — Classement planétaire de la page d'accueil
--
-- Moyenne des positions de chaque titre à travers toutes les plateformes
-- publiées. Le top 5 est sélectionné automatiquement, puis validé et publié
-- par l'administrateur.
--
-- Calcul :
--   Pour chaque `track_id` présent dans au moins 1 classement publié, on
--   relève sa `filtered_position` dans chaque snapshot actif. La note finale
--   est la MOYENNE de ces positions (plus elle est basse, mieux c'est).
--   Un titre absent d'un classement n'est pas pénalisé : on ne moyenne que
--   les classements où il figure.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.homepage_chart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Données calculées automatiquement
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES artists(id) ON DELETE SET NULL,
  title text NOT NULL,
  artist_name text NOT NULL,
  artist_slug text,
  artwork_url text,
  platform_url text,
  -- Résultat du calcul
  avg_position numeric(6, 2) NOT NULL,
  platforms_count integer NOT NULL DEFAULT 1,
  platforms_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Position finale décidée par l'admin (1 à 5)
  display_position integer NOT NULL UNIQUE CHECK (display_position BETWEEN 1 AND 10),
  -- Mouvements (calculés lors de la publication)
  movement integer,            -- variation vs dernière publication
  previous_position integer,
  -- Validation
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homepage_chart_position_idx
  ON homepage_chart (display_position)
  WHERE is_published = true;

COMMENT ON TABLE public.homepage_chart IS
  'Top 5 (jusqu''à 10) affiché sur la page d''accueil : moyenne des classements publiés.';

-- RLS : lecture publique, écriture admin
ALTER TABLE homepage_chart ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_homepage_chart" ON homepage_chart
  FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "admin_all_homepage_chart" ON homepage_chart
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON homepage_chart TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON homepage_chart TO service_role;

-- =========================================================
-- Fonction de calcul : construit le classement moyen depuis les snapshots
-- publiés. Renvoie les titres triés par position moyenne croissante.
-- =========================================================

CREATE OR REPLACE FUNCTION public.compute_homepage_chart(p_limit integer DEFAULT 20)
RETURNS TABLE(
  track_id uuid,
  artist_id uuid,
  title text,
  artist_name text,
  artist_slug text,
  artwork_url text,
  platform_url text,
  avg_position numeric,
  platforms_count integer,
  platforms_detail jsonb
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH snapshot_entries AS (
    -- Déplier les entrées de chaque snapshot publié
    SELECT
      s.source_key,
      cs.platform,
      cs.display_name,
      (entry->>'track_id')::uuid AS track_id,
      (entry->>'filtered_position')::integer AS position,
      entry->>'track_title' AS track_title,
      entry->>'artists_text' AS artists_text,
      entry->>'artwork_url' AS artwork_url,
      entry->>'platform_url' AS platform_url
    FROM chart_published_snapshots s
    JOIN chart_sources cs ON cs.source_key = s.source_key
    CROSS JOIN LATERAL jsonb_array_elements(s.payload->'entries') AS entry
    WHERE cs.is_enabled = true
      AND (entry->>'track_id') IS NOT NULL
      AND (entry->>'track_id') <> ''
  ),
  -- Moyenne par track_id
  aggregated AS (
    SELECT
      se.track_id,
      round(avg(se.position), 2) AS avg_position,
      count(DISTINCT se.source_key)::integer AS platforms_count,
      jsonb_agg(
        jsonb_build_object(
          'source_key', se.source_key,
          'platform', se.platform,
          'display_name', se.display_name,
          'position', se.position
        ) ORDER BY se.position
      ) AS platforms_detail,
      -- Meilleur titre et artiste (celui positionné le plus haut)
      (array_agg(se.track_title ORDER BY se.position))[1] AS best_title,
      (array_agg(se.artists_text ORDER BY se.position))[1] AS best_artists,
      (array_agg(se.artwork_url ORDER BY se.position))[1] AS best_artwork,
      (array_agg(se.platform_url ORDER BY se.position))[1] AS best_url
    FROM snapshot_entries se
    GROUP BY se.track_id
  )
  SELECT
    a.track_id,
    t_artist.artist_id,
    COALESCE(t.title, a.best_title) AS title,
    COALESCE(artist.name, a.best_artists) AS artist_name,
    artist.slug AS artist_slug,
    COALESCE(t.default_artwork_url, a.best_artwork) AS artwork_url,
    a.best_url AS platform_url,
    a.avg_position,
    a.platforms_count,
    a.platforms_detail
  FROM aggregated a
  LEFT JOIN tracks t ON t.id = a.track_id
  LEFT JOIN LATERAL (
    SELECT ta.artist_id
    FROM track_artists ta
    WHERE ta.track_id = a.track_id
      AND ta.role IN ('primary', 'co_primary')
    ORDER BY ta.billing_order NULLS LAST
    LIMIT 1
  ) t_artist ON true
  LEFT JOIN artists artist ON artist.id = t_artist.artist_id
  ORDER BY a.avg_position ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.compute_homepage_chart(integer) TO service_role;
