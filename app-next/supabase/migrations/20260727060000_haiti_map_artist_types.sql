-- =========================================================
-- Planète HMI — Carte Haïti, types d'artistes, lieux de naissance
-- =========================================================

-- Départements et communes d'Haïti
CREATE TABLE IF NOT EXISTS public.haiti_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,  -- ex: "OUEST", "NORD", "SUD"
  svg_path text,  -- Path SVG du contour du département
  center_lat numeric,
  center_lng numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.haiti_communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES haiti_departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  svg_path text,
  UNIQUE (department_id, name)
);

-- Type d'artiste (colonne sur artists)
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS artist_type text NOT NULL DEFAULT 'artist'
    CHECK (artist_type IN ('artist', 'group', 'producer', 'beatmaker', 'dj', 'musician', 'singer', 'rapper')),
  ADD COLUMN IF NOT EXISTS birth_department_id uuid REFERENCES haiti_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS birth_commune_id uuid REFERENCES haiti_communes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS birth_city text,
  ADD COLUMN IF NOT EXISTS spotify_producer_id text;

CREATE INDEX IF NOT EXISTS artists_type_idx ON artists (artist_type);
CREATE INDEX IF NOT EXISTS artists_department_idx ON artists (birth_department_id) WHERE birth_department_id IS NOT NULL;

-- Productions (lien artiste producteur → track)
CREATE TABLE IF NOT EXISTS public.artist_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'producer' CHECK (role IN ('producer', 'beatmaker', 'co-producer', 'executive_producer')),
  spotify_track_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producer_id, track_id)
);

CREATE INDEX IF NOT EXISTS productions_producer_idx ON artist_productions (producer_id);
CREATE INDEX IF NOT EXISTS productions_track_idx ON artist_productions (track_id);

-- RLS
ALTER TABLE haiti_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE haiti_communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_productions ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour carte et productions
CREATE POLICY "public_read_departments" ON haiti_departments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_communes" ON haiti_communes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_productions" ON artist_productions FOR SELECT TO anon, authenticated USING (true);
-- Admin write
CREATE POLICY "admin_all_departments" ON haiti_departments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_communes" ON haiti_communes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_productions" ON artist_productions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed: 10 départements d'Haïti
INSERT INTO haiti_departments (name, code) VALUES
  ('Artibonite', 'ARTIBONITE'),
  ('Centre', 'CENTRE'),
  ('Grand''Anse', 'GRAND_ANSE'),
  ('Nippes', 'NIPPES'),
  ('Nord', 'NORD'),
  ('Nord-Est', 'NORD_EST'),
  ('Nord-Ouest', 'NORD_OUEST'),
  ('Ouest', 'OUEST'),
  ('Sud', 'SUD'),
  ('Sud-Est', 'SUD_EST')
ON CONFLICT (name) DO NOTHING;

-- Quelques communes principales (seed minimal)
INSERT INTO haiti_communes (department_id, name) VALUES
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Port-au-Prince'),
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Pétion-Ville'),
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Delmas'),
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Carrefour'),
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Tabarre'),
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Cité Soleil'),
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Kenscoff'),
  ((SELECT id FROM haiti_departments WHERE code = 'OUEST'), 'Croix-des-Bouquets'),
  ((SELECT id FROM haiti_departments WHERE code = 'NORD'), 'Cap-Haïtien'),
  ((SELECT id FROM haiti_departments WHERE code = 'NORD'), 'Milot'),
  ((SELECT id FROM haiti_departments WHERE code = 'NORD'), 'Limonade'),
  ((SELECT id FROM haiti_departments WHERE code = 'ARTIBONITE'), 'Gonaïves'),
  ((SELECT id FROM haiti_departments WHERE code = 'ARTIBONITE'), 'Saint-Marc'),
  ((SELECT id FROM haiti_departments WHERE code = 'SUD'), 'Les Cayes'),
  ((SELECT id FROM haiti_departments WHERE code = 'SUD'), 'Jérémie'),
  ((SELECT id FROM haiti_departments WHERE code = 'CENTRE'), 'Hinche'),
  ((SELECT id FROM haiti_departments WHERE code = 'NORD_EST'), 'Fort-Liberté'),
  ((SELECT id FROM haiti_departments WHERE code = 'NORD_OUEST'), 'Port-de-Paix'),
  ((SELECT id FROM haiti_departments WHERE code = 'SUD_EST'), 'Jacmel'),
  ((SELECT id FROM haiti_departments WHERE code = 'NIPPES'), 'Miragoâne'),
  ((SELECT id FROM haiti_departments WHERE code = 'GRAND_ANSE'), 'Jérémie')
ON CONFLICT (department_id, name) DO NOTHING;
