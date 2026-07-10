-- Ajouter la photo de profil des artistes (depuis Audiomack).
ALTER TABLE artists ADD COLUMN IF NOT EXISTS image_url text;
COMMENT ON COLUMN artists.image_url IS 'Photo de profil de l''artiste (URL Audiomack ou autre plateforme).';

ALTER TABLE chart_snapshot_entries ADD COLUMN IF NOT EXISTS artist_image_url text;
