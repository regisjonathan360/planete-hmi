-- Lieu de naissance distinct de la ville ou localisation actuelle.
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS birth_place text;
COMMENT ON COLUMN public.artists.birth_place IS
  'Lieu de naissance public de l artiste, distinct de sa ville actuelle.';
