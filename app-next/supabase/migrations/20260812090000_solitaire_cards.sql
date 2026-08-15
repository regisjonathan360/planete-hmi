-- =========================================================
-- Planète HMI — Solitaire de l'Arène : cartes personnalisables par artiste
--
-- 1. `solitaire_rank_presets` : géométrie du masque par rang (13 lignes,
--    seed conforme à src/lib/solitaire/cards.ts CARD_MASK_PRESETS).
-- 2. `solitaire_cards` : personnalisation par carte (52 clés "KH"…) :
--    artiste + éventuels overrides de masque/cadrage.
-- Valeurs relatives (0→1) : la composition est proportionnelle quelle que
-- soit la taille de la carte. RLS : lecture publique, écriture admin.
-- =========================================================

-- ---------- Presets par rang ----------

CREATE TABLE IF NOT EXISTS public.solitaire_rank_presets (
  rank text PRIMARY KEY
    CHECK (rank IN ('ace','two','three','four','five','six','seven','eight','nine','ten','jack','queen','king')),
  mask_type text NOT NULL
    CHECK (mask_type IN ('circle','square','rounded-square')),
  mask_scale numeric(5,3) NOT NULL CHECK (mask_scale > 0 AND mask_scale <= 10),
  mask_pos_x numeric(5,3) NOT NULL DEFAULT 0.5 CHECK (mask_pos_x >= 0 AND mask_pos_x <= 1),
  mask_pos_y numeric(5,3) NOT NULL DEFAULT 0.5 CHECK (mask_pos_y >= 0 AND mask_pos_y <= 1),
  image_zoom numeric(5,3) NOT NULL DEFAULT 1 CHECK (image_zoom > 0 AND image_zoom <= 5),
  image_pos_x numeric(5,3) NOT NULL DEFAULT 0.5 CHECK (image_pos_x >= 0 AND image_pos_x <= 1),
  image_pos_y numeric(5,3) NOT NULL DEFAULT 0.35 CHECK (image_pos_y >= 0 AND image_pos_y <= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.solitaire_rank_presets IS
  'Géométrie du masque photo par rang du Solitaire de l''Arène (valeurs relatives 0→1).';
COMMENT ON COLUMN public.solitaire_rank_presets.mask_type IS
  'Forme du masque : circle (A–5), rounded-square (6–10), square (J/Q/K).';

GRANT SELECT ON public.solitaire_rank_presets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solitaire_rank_presets TO authenticated;

CREATE POLICY "public read solitaire rank presets"
  ON public.solitaire_rank_presets
  FOR SELECT USING (true);
CREATE POLICY "admin manage solitaire rank presets"
  ON public.solitaire_rank_presets
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed des presets (spécification §21 : A–5 cercle, 6–10 carré arrondi,
-- J/Q/K carré). Modifiables en admin sans toucher au code.
INSERT INTO public.solitaire_rank_presets
  (rank, mask_type, mask_scale, mask_pos_x, mask_pos_y, image_zoom, image_pos_x, image_pos_y)
VALUES
  ('ace',   'circle',        0.72, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('two',   'circle',        0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('three', 'circle',        0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('four',  'circle',        0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('five',  'circle',        0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('six',   'rounded-square',0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('seven', 'rounded-square',0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('eight', 'rounded-square',0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('nine',  'rounded-square',0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('ten',   'rounded-square',0.42, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('jack',  'square',        0.82, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('queen', 'square',        0.82, 0.5, 0.5, 1.1, 0.5, 0.35),
  ('king',  'square',        0.82, 0.5, 0.5, 1.1, 0.5, 0.35)
ON CONFLICT (rank) DO UPDATE SET
  mask_type    = EXCLUDED.mask_type,
  mask_scale   = EXCLUDED.mask_scale,
  mask_pos_x   = EXCLUDED.mask_pos_x,
  mask_pos_y   = EXCLUDED.mask_pos_y,
  image_zoom   = EXCLUDED.image_zoom,
  image_pos_x  = EXCLUDED.image_pos_x,
  image_pos_y  = EXCLUDED.image_pos_y,
  updated_at   = now();

-- ---------- Cartes personnalisées ----------

CREATE TABLE IF NOT EXISTS public.solitaire_cards (
  card_key text PRIMARY KEY
    CHECK (card_key ~ '^(A|2|3|4|5|6|7|8|9|10|J|Q|K)(H|D|C|S)$'),
  artist_id uuid REFERENCES public.artists (id) ON DELETE SET NULL,
  -- Overrides facultatifs du preset du rang (NULL = suivre le preset).
  mask_type text CHECK (mask_type IN ('circle','square','rounded-square')),
  mask_scale numeric(5,3) CHECK (mask_scale > 0 AND mask_scale <= 2),
  mask_pos_x numeric(5,3) CHECK (mask_pos_x >= 0 AND mask_pos_x <= 1),
  mask_pos_y numeric(5,3) CHECK (mask_pos_y >= 0 AND mask_pos_y <= 1),
  image_zoom numeric(5,3) CHECK (image_zoom > 0 AND image_zoom <= 5),
  image_pos_x numeric(5,3) CHECK (image_pos_x >= 0 AND image_pos_x <= 1),
  image_pos_y numeric(5,3) CHECK (image_pos_y >= 0 AND image_pos_y <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.solitaire_cards IS
  'Personnalisation par carte du Solitaire de l''Arène (clé "KH" = roi de cœur).';
COMMENT ON COLUMN public.solitaire_cards.artist_id IS
  'Artiste illustrant la carte. Suppression d''artiste → carte sans artiste (rendu classique).';

CREATE INDEX IF NOT EXISTS solitaire_cards_artist_idx
  ON public.solitaire_cards (artist_id);

GRANT SELECT ON public.solitaire_cards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solitaire_cards TO authenticated;

CREATE POLICY "public read solitaire cards"
  ON public.solitaire_cards
  FOR SELECT USING (true);
CREATE POLICY "admin manage solitaire cards"
  ON public.solitaire_cards
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Trigger updated_at ----------

CREATE OR REPLACE FUNCTION public.solitaire_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.solitaire_touch_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS solitaire_cards_touch_updated_at ON public.solitaire_cards;
CREATE TRIGGER solitaire_cards_touch_updated_at
  BEFORE UPDATE ON public.solitaire_cards
  FOR EACH ROW EXECUTE FUNCTION public.solitaire_touch_updated_at();

DROP TRIGGER IF EXISTS solitaire_rank_presets_touch_updated_at ON public.solitaire_rank_presets;
CREATE TRIGGER solitaire_rank_presets_touch_updated_at
  BEFORE UPDATE ON public.solitaire_rank_presets
  FOR EACH ROW EXECUTE FUNCTION public.solitaire_touch_updated_at();
