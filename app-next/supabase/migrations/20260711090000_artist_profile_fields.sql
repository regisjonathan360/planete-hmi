-- =========================================================
-- Planète HMI — Champs profil artiste enrichi
-- Personnalisation du profil, plateformes, réseaux, anniversaires.
-- =========================================================

-- Photo bannière (header du profil public)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS banner_url text;

-- Biographie courte (affichée sur le profil public)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio text;

-- Ville / localisation (ex: Port-au-Prince, Miami, Montréal)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS city text;

-- Date de naissance (privée, utilisée pour la section Anniversaires)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS birth_date date;

-- Genre musical principal (konpa, raboday, hip-hop, etc.)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS primary_genre text;

-- Nom réel (privé, visible seulement dans l'espace compte)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS real_name text;

-- Année de début de carrière
ALTER TABLE artists ADD COLUMN IF NOT EXISTS career_start_year integer;

-- Label / collectif
ALTER TABLE artists ADD COLUMN IF NOT EXISTS label text;

-- Plateformes musicales (URLs)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_spotify text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_apple_music text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_youtube_music text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_audiomack text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_deezer text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_soundcloud text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_tidal text;

-- Réseaux sociaux (URLs)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_instagram text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_tiktok text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_twitter text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_facebook text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_youtube text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_threads text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS url_website text;

-- Lien entre l'artiste et un user Supabase (pour l'espace compte artiste)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Index pour retrouver l'artiste d'un user connecté
CREATE INDEX IF NOT EXISTS artists_user_id_idx ON artists (user_id) WHERE user_id IS NOT NULL;

-- Index pour la section anniversaires (mois+jour)
CREATE INDEX IF NOT EXISTS artists_birth_date_idx ON artists (birth_date) WHERE birth_date IS NOT NULL;

-- RLS : un artiste peut modifier son propre profil
CREATE POLICY "artist update own profile" ON artists
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS : lecture publique des artistes actifs
-- (déjà existante normalement, on la recrée en sécurité)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'artists' AND policyname = 'public read active artists'
  ) THEN
    CREATE POLICY "public read active artists" ON artists
      FOR SELECT USING (is_active = true);
  END IF;
END $$;
