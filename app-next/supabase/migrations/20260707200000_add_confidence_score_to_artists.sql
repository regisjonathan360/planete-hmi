-- Ajouter la colonne confidence_score à la table artists
alter table artists add column if not exists confidence_score integer;
