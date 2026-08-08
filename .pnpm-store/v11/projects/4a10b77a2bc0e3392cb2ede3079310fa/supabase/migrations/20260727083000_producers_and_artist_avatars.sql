-- =========================================================
-- Planète HMI — Producteurs / Beatmakers + photos de profil de secours
--
-- 1. Complète `artist_productions` (source du crédit, vérification, auteur).
-- 2. Marque les profils créés automatiquement pour qu'ils restent cantonnés
--    à la page Producteurs / Beatmakers.
-- 3. Résout la photo de profil manquante d'un artiste depuis une plateforme
--    déjà rattachée à sa fiche (Spotify, Deezer, Audiomack, YouTube…).
-- =========================================================

-- ---------- 1. Crédits de production ----------

-- La table existait sans GRANT : la lecture publique était bloquée malgré la
-- policy `public_read_productions`.
GRANT SELECT ON public.artist_productions TO anon, authenticated;
ALTER TABLE public.artist_productions
  ADD COLUMN IF NOT EXISTS credit_source text NOT NULL DEFAULT 'manual_admin'
    CHECK (credit_source IN ('manual_admin', 'title_credit', 'spotify_sync', 'chart_collect')),
  ADD COLUMN IF NOT EXISTS credit_note text,
  ADD COLUMN IF NOT EXISTS confidence numeric(3, 2) NOT NULL DEFAULT 1.00
    CHECK (confidence >= 0 AND confidence <= 1),
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
COMMENT ON COLUMN public.artist_productions.credit_source IS
  'Origine du crédit : title_credit = extrait d''une mention « Prod. by » dans le titre, spotify_sync = confirmé via la Web API Spotify, manual_admin = saisi par un administrateur.';
CREATE INDEX IF NOT EXISTS productions_unverified_idx
  ON public.artist_productions (is_verified, created_at DESC)
  WHERE is_verified = false;
-- ---------- 2. Profils générés automatiquement ----------

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.artists.is_auto_generated IS
  'Profil créé sans validation humaine (ex. producteur détecté pendant une collecte). Exclu de la grille générale des artistes.';
CREATE INDEX IF NOT EXISTS artists_auto_generated_idx
  ON public.artists (is_auto_generated)
  WHERE is_auto_generated = true;
CREATE INDEX IF NOT EXISTS artists_producer_idx
  ON public.artists (artist_type)
  WHERE artist_type IN ('producer', 'beatmaker');
-- ---------- 3. Photo de profil de secours ----------

-- Ordre de préférence des plateformes. Modifier ici ET dans
-- src/lib/artists/avatar.ts (PLATFORM_AVATAR_PRIORITY) pour rester cohérent.
CREATE OR REPLACE FUNCTION public.artist_platform_avatar_rank(p_platform text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(COALESCE(p_platform, ''))
    WHEN 'spotify' THEN 1
    WHEN 'apple_music' THEN 2
    WHEN 'deezer' THEN 3
    WHEN 'audiomack' THEN 4
    WHEN 'youtube' THEN 5
    WHEN 'youtube_music' THEN 6
    WHEN 'tidal' THEN 7
    WHEN 'soundcloud' THEN 8
    WHEN 'tiktok' THEN 9
    ELSE 50
  END;
$$;
-- Renvoie la meilleure photo disponible dans la fiche d'un artiste, ou NULL.
CREATE OR REPLACE FUNCTION public.artist_fallback_image(p_artist_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT candidate.image_url
  FROM (
    -- Identités plateformes rattachées à la fiche
    SELECT
      identity.platform_image_url AS image_url,
      public.artist_platform_avatar_rank(identity.platform) AS rank,
      CASE WHEN identity.is_verified THEN 0 ELSE 1 END AS unverified,
      COALESCE(identity.last_seen_at, identity.created_at) AS seen_at
    FROM public.artist_platform_identities AS identity
    WHERE identity.artist_id = p_artist_id
      AND identity.platform_image_url IS NOT NULL
      AND btrim(identity.platform_image_url) <> ''

    UNION ALL

    -- Chaîne YouTube principale de l'artiste (miniature de chaîne)
    SELECT
      channel.thumbnail_url AS image_url,
      public.artist_platform_avatar_rank('youtube') AS rank,
      CASE WHEN channel.is_youtube_verified THEN 0 ELSE 1 END AS unverified,
      channel.updated_at AS seen_at
    FROM public.youtube_channels AS channel
    WHERE channel.artist_id = p_artist_id
      AND channel.is_active = true
      AND channel.thumbnail_url IS NOT NULL
      AND btrim(channel.thumbnail_url) <> ''

    UNION ALL

    -- Chaînes label / collaboratives auxquelles l'artiste est rattaché
    SELECT
      channel.thumbnail_url AS image_url,
      -- Rang volontairement dégradé : une chaîne de label n'est pas un
      -- portrait fiable de l'artiste.
      public.artist_platform_avatar_rank('youtube') + 20 AS rank,
      1 AS unverified,
      channel.updated_at AS seen_at
    FROM public.youtube_channel_artists AS link
    JOIN public.youtube_channels AS channel ON channel.id = link.youtube_channel_id
    WHERE link.artist_id = p_artist_id
      AND link.role = 'owner'
      AND channel.is_active = true
      AND channel.thumbnail_url IS NOT NULL
      AND btrim(channel.thumbnail_url) <> ''
  ) AS candidate
  ORDER BY candidate.unverified, candidate.rank, candidate.seen_at DESC NULLS LAST
  LIMIT 1;
$$;
COMMENT ON FUNCTION public.artist_fallback_image(uuid) IS
  'Photo de profil de secours : première image disponible parmi les plateformes rattachées à l''artiste, identités vérifiées d''abord.';
-- Recopie les photos de secours dans artists.image_url pour les fiches vides.
CREATE OR REPLACE FUNCTION public.backfill_artist_images(p_limit integer DEFAULT 500)
RETURNS TABLE(updated_count integer, remaining_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 5000);
  v_updated integer := 0;
BEGIN
  WITH candidates AS (
    SELECT artist.id, public.artist_fallback_image(artist.id) AS image_url
    FROM public.artists AS artist
    WHERE artist.image_url IS NULL OR btrim(artist.image_url) = ''
    ORDER BY artist.updated_at DESC
    LIMIT v_limit
  ), applied AS (
    UPDATE public.artists AS artist
    SET image_url = candidates.image_url,
        updated_at = now()
    FROM candidates
    WHERE artist.id = candidates.id
      AND candidates.image_url IS NOT NULL
    RETURNING artist.id
  )
  SELECT count(*)::integer INTO v_updated FROM applied;

  RETURN QUERY
  SELECT
    v_updated,
    (
      SELECT count(*)::integer
      FROM public.artists AS artist
      WHERE (artist.image_url IS NULL OR btrim(artist.image_url) = '')
        AND public.artist_fallback_image(artist.id) IS NOT NULL
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.backfill_artist_images(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_artist_images(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.artist_fallback_image(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.artist_platform_avatar_rank(text) TO anon, authenticated, service_role;
-- ---------- 4. Rattachement atomique d'une production ----------

-- Crée / met à jour le crédit de production en une seule instruction, et
-- reflète le crédit dans track_artists (rôle « producer ») pour rester
-- cohérent avec le reste du modèle.
CREATE OR REPLACE FUNCTION public.link_artist_production(
  p_producer_id uuid,
  p_track_id uuid,
  p_role text DEFAULT 'producer',
  p_credit_source text DEFAULT 'manual_admin',
  p_credit_note text DEFAULT NULL,
  p_confidence numeric DEFAULT 1.00,
  p_is_verified boolean DEFAULT false,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, production_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_role NOT IN ('producer', 'beatmaker', 'co-producer', 'executive_producer') THEN
    RETURN QUERY SELECT false, 'invalid_role'::text, NULL::uuid;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.artists WHERE id = p_producer_id) THEN
    RETURN QUERY SELECT false, 'producer_not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tracks WHERE id = p_track_id) THEN
    RETURN QUERY SELECT false, 'track_not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.artist_productions AS production (
    producer_id, track_id, role, credit_source, credit_note,
    confidence, is_verified, created_by
  )
  VALUES (
    p_producer_id, p_track_id, p_role, p_credit_source, p_credit_note,
    LEAST(GREATEST(COALESCE(p_confidence, 1.00), 0), 1), COALESCE(p_is_verified, false), p_created_by
  )
  ON CONFLICT (producer_id, track_id) DO UPDATE
  SET role = EXCLUDED.role,
      credit_note = COALESCE(EXCLUDED.credit_note, production.credit_note),
      -- Un crédit déjà vérifié n'est jamais rétrogradé par une collecte.
      credit_source = CASE
        WHEN production.is_verified THEN production.credit_source
        ELSE EXCLUDED.credit_source
      END,
      confidence = GREATEST(production.confidence, EXCLUDED.confidence),
      is_verified = production.is_verified OR EXCLUDED.is_verified,
      updated_at = now()
  RETURNING production.id INTO v_id;

  INSERT INTO public.track_artists (track_id, artist_id, role, billing_order)
  VALUES (p_track_id, p_producer_id, 'producer', NULL)
  ON CONFLICT (track_id, artist_id, role) DO NOTHING;

  RETURN QUERY SELECT true, 'ok'::text, v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.link_artist_production(uuid, uuid, text, text, text, numeric, boolean, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_artist_production(uuid, uuid, text, text, text, numeric, boolean, uuid)
  TO service_role;
