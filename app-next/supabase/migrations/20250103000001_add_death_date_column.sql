-- Ajout de la colonne death_date à la table artists
-- Permet de stocker la date de décès d'un artiste pour la page "Étoiles éteintes"

ALTER TABLE artists ADD COLUMN IF NOT EXISTS death_date DATE;

CREATE INDEX IF NOT EXISTS idx_artists_death_date ON artists(death_date) WHERE death_date IS NOT NULL;
