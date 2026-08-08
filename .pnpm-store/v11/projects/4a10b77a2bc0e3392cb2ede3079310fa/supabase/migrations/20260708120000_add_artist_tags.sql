-- Étiquettes de rôle des artistes : chanteur, rappeur, beatmaker/producteur, auteur/compositeur.
-- Stockées comme tableau text[] car un artiste peut cumuler plusieurs rôles.
ALTER TABLE artists ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN artists.tags IS 'Étiquettes de rôle (chanteur, rappeur, beatmaker, auteur_compositeur). Un artiste peut en avoir plusieurs.';
