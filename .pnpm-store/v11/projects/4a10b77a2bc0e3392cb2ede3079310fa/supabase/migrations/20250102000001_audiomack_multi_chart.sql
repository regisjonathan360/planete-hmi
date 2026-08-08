-- =========================================================
-- Planète HMI — Module Multi-Chart Audiomack
-- Migration : extensions schéma pour classement composite,
-- extraction de statistiques et reclassement automatique.
-- =========================================================

-- ==========================================================
-- 1.1 — Nouvelles colonnes sur chart_sources
-- Poids de pondération, ordre d'affichage, marqueur composite
-- ==========================================================

ALTER TABLE chart_sources
  ADD COLUMN IF NOT EXISTS weight numeric(3,2) DEFAULT 1.0
    CHECK (weight >= 0 AND weight <= 5.0);

ALTER TABLE chart_sources
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

ALTER TABLE chart_sources
  ADD COLUMN IF NOT EXISTS is_composite_source boolean DEFAULT false;

-- Activation des genres par défaut pour le multi-chart
-- (all, afrosounds, hip-hop-rap, caribbean, latin, r-b, gospel, pop)
UPDATE chart_sources
SET is_enabled = true, updated_at = now()
WHERE platform = 'audiomack'
  AND genre_id IN ('all', 'afrosounds', 'hip-hop-rap', 'caribbean', 'latin', 'r-b', 'gospel', 'pop');

-- ==========================================================
-- 1.2 — Nouvelles colonnes sur chart_entries
-- Score composite, score stats, statut d'extraction
-- ==========================================================

ALTER TABLE chart_entries
  ADD COLUMN IF NOT EXISTS score_composite numeric(12,2);

ALTER TABLE chart_entries
  ADD COLUMN IF NOT EXISTS score_stats numeric(14,2);

ALTER TABLE chart_entries
  ADD COLUMN IF NOT EXISTS stats_extracted_at timestamptz;

ALTER TABLE chart_entries
  ADD COLUMN IF NOT EXISTS stats_status text DEFAULT 'pending'
    CHECK (stats_status IN ('pending', 'extracted', 'failed', 'unavailable'));

-- ==========================================================
-- 1.3 — Table chart_entry_metrics
-- Métriques détaillées par entrée (plays, likes, reposts, etc.)
-- ==========================================================

CREATE TABLE IF NOT EXISTS chart_entry_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_entry_id uuid NOT NULL REFERENCES chart_entries(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  metric_value bigint NOT NULL DEFAULT 0,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chart_entry_id, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_entry_metrics_entry
  ON chart_entry_metrics(chart_entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_metrics_type
  ON chart_entry_metrics(metric_type);

-- ==========================================================
-- 1.4 — Table composite_contributions
-- Détail des contributions genre au score composite
-- ==========================================================

CREATE TABLE IF NOT EXISTS composite_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_entry_id uuid NOT NULL REFERENCES chart_entries(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  genre_id text NOT NULL,
  source_position integer NOT NULL,
  weight numeric(3,2) NOT NULL,
  contribution numeric(10,2) NOT NULL,
  UNIQUE(composite_entry_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_composite_contrib_entry
  ON composite_contributions(composite_entry_id);

-- ==========================================================
-- 1.5 — Table reclassification_history
-- Historique des reclassements par statistiques
-- ==========================================================

CREATE TABLE IF NOT EXISTS reclassification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_edition_id uuid NOT NULL REFERENCES chart_editions(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text,
  coefficients jsonb NOT NULL,
  previous_order jsonb NOT NULL,
  new_order jsonb NOT NULL,
  CONSTRAINT valid_coefficients CHECK (
    coefficients ? 'plays' AND coefficients ? 'likes' AND coefficients ? 'reposts'
  )
);

CREATE INDEX IF NOT EXISTS idx_reclass_history_edition
  ON reclassification_history(chart_edition_id);

-- ==========================================================
-- 1.6 — Politiques RLS pour les nouvelles tables
-- Lecture publique sur metrics et contributions,
-- écriture admin uniquement. reclassification_history admin seul.
-- ==========================================================

-- Activer la RLS sur les nouvelles tables
ALTER TABLE chart_entry_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE composite_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclassification_history ENABLE ROW LEVEL SECURITY;

-- ---- chart_entry_metrics : lecture publique, écriture admin ----

CREATE POLICY "public read chart_entry_metrics"
  ON chart_entry_metrics FOR SELECT
  USING (true);

CREATE POLICY "admin insert chart_entry_metrics"
  ON chart_entry_metrics FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "admin update chart_entry_metrics"
  ON chart_entry_metrics FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin delete chart_entry_metrics"
  ON chart_entry_metrics FOR DELETE
  USING (public.is_admin());

-- ---- composite_contributions : lecture publique, écriture admin ----

CREATE POLICY "public read composite_contributions"
  ON composite_contributions FOR SELECT
  USING (true);

CREATE POLICY "admin insert composite_contributions"
  ON composite_contributions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "admin update composite_contributions"
  ON composite_contributions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin delete composite_contributions"
  ON composite_contributions FOR DELETE
  USING (public.is_admin());

-- ---- reclassification_history : admin uniquement (SELECT + INSERT) ----

CREATE POLICY "admin select reclassification_history"
  ON reclassification_history FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admin insert reclassification_history"
  ON reclassification_history FOR INSERT
  WITH CHECK (public.is_admin());

-- ==========================================================
-- Grants pour anon/authenticated sur les tables publiques
-- ==========================================================

GRANT SELECT ON chart_entry_metrics TO anon, authenticated;
GRANT SELECT ON composite_contributions TO anon, authenticated;

-- Fin de la migration multi-chart Audiomack
