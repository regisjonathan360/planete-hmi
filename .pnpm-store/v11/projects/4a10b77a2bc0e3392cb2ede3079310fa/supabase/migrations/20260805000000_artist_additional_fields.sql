-- =========================================================
-- Planète HMI — Champs additionnels artistes
-- Wiki, Chartmetric, Shazam, Sexe, Animateur
-- =========================================================

-- URLs des services additionnels
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS url_wikipedia text;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS url_chartmetric text;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS url_shazam text;

-- Sexe de l'artiste (pour filtrage)
-- m=masculin, f=féminin, g=groupe, o=autre/non-binaire
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS gender text 
  CHECK (gender IN ('m', 'f', 'g', 'o') OR gender IS NULL);

-- Index pour faciliter le filtrage par sexe
CREATE INDEX IF NOT EXISTS artists_gender_idx ON public.artists (gender) 
  WHERE gender IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN public.artists.url_wikipedia IS 'URL de la page Wikipedia (fr ou en) de l''artiste';
COMMENT ON COLUMN public.artists.url_chartmetric IS 'URL du profil Chartmetric de l''artiste';
COMMENT ON COLUMN public.artists.url_shazam IS 'URL du profil Shazam de l''artiste';
COMMENT ON COLUMN public.artists.gender IS 'Sexe: m=masculin, f=féminin, g=groupe, o=autre/non-binaire';
