-- Étiquette de genre sur les entrées de classement (attribuée par l'admin).
ALTER TABLE chart_entries ADD COLUMN IF NOT EXISTS genre text;
COMMENT ON COLUMN chart_entries.genre IS 'Étiquette de genre attribuée par l''admin (ex: afrosounds, pop, hip-hop-rap, konpa, raboday).';
