-- Ajout de la colonne death_date à la table artists
-- Permet de stocker la date de décès d'un artiste pour la page "Étoiles éteintes"

-- La table artists est créée par 20260706044049_create_charts_schema.sql,
-- appliquée APRÈS cette migration lors d'un reset from scratch.
DO $$
BEGIN
  IF to_regclass('public.artists') IS NOT NULL THEN
    ALTER TABLE artists ADD COLUMN IF NOT EXISTS death_date DATE;

    CREATE INDEX IF NOT EXISTS idx_artists_death_date ON artists(death_date) WHERE death_date IS NOT NULL;
  END IF;
END
$$;
