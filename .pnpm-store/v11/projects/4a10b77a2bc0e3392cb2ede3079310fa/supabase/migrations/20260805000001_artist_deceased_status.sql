-- Ajout du statut "décédé" pour les artistes
-- Permet d'afficher une section "Étoiles éteintes" et d'exclure les artistes décédés des anniversaires

-- Ajouter la colonne is_deceased
ALTER TABLE artists ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN DEFAULT FALSE;

-- Ajouter un index pour les performances
CREATE INDEX IF NOT EXISTS idx_artists_is_deceased ON artists(is_deceased);

-- Ajouter une constraint pour éviter les valeurs NULL
ALTER TABLE artists ALTER COLUMN is_deceased SET DEFAULT FALSE;
