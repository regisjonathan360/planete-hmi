CREATE OR REPLACE FUNCTION public.synchronize_artist_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tag text;
  v_key text;
  v_normalized text;
  v_tags text[] := '{}'::text[];
  v_required_tag text;
BEGIN
  FOREACH v_tag IN ARRAY COALESCE(NEW.tags, '{}'::text[])
  LOOP
    v_key := replace(replace(lower(trim(v_tag)), '-', '_'), ' ', '_');
    v_normalized := CASE v_key
      WHEN 'chanteuse' THEN 'chanteur'
      WHEN 'singer' THEN 'chanteur'
      WHEN 'vocalist' THEN 'chanteur'
      WHEN 'rappeuse' THEN 'rappeur'
      WHEN 'rapper' THEN 'rappeur'
      WHEN 'producteur' THEN 'beatmaker'
      WHEN 'productrice' THEN 'beatmaker'
      WHEN 'producer' THEN 'beatmaker'
      WHEN 'co_producer' THEN 'beatmaker'
      WHEN 'executive_producer' THEN 'beatmaker'
      WHEN 'group' THEN 'groupe'
      WHEN 'orchestre' THEN 'groupe'
      WHEN 'musicienne' THEN 'musicien'
      WHEN 'musician' THEN 'musicien'
      WHEN 'instrumentiste' THEN 'musicien'
      WHEN 'auteur' THEN 'auteur_compositeur'
      WHEN 'autrice' THEN 'auteur_compositeur'
      WHEN 'compositeur' THEN 'auteur_compositeur'
      WHEN 'compositrice' THEN 'auteur_compositeur'
      ELSE v_key
    END;

    IF v_normalized <> '' AND NOT v_normalized = ANY(v_tags) THEN
      v_tags := array_append(v_tags, v_normalized);
    END IF;
  END LOOP;

  v_required_tag := CASE NEW.artist_type
    WHEN 'group' THEN 'groupe'
    WHEN 'producer' THEN 'beatmaker'
    WHEN 'beatmaker' THEN 'beatmaker'
    WHEN 'dj' THEN 'dj'
    WHEN 'musician' THEN 'musicien'
    WHEN 'singer' THEN 'chanteur'
    WHEN 'rapper' THEN 'rappeur'
    ELSE NULL
  END;

  IF v_required_tag IS NOT NULL AND NOT v_required_tag = ANY(v_tags) THEN
    v_tags := array_append(v_tags, v_required_tag);
  END IF;

  IF NEW.artist_type = 'artist' THEN
    NEW.artist_type := CASE
      WHEN 'groupe' = ANY(v_tags) THEN 'group'
      WHEN 'beatmaker' = ANY(v_tags) THEN 'producer'
      WHEN 'dj' = ANY(v_tags) THEN 'dj'
      WHEN 'musicien' = ANY(v_tags) THEN 'musician'
      WHEN 'rappeur' = ANY(v_tags) THEN 'rapper'
      WHEN 'chanteur' = ANY(v_tags) THEN 'singer'
      ELSE 'artist'
    END;
  END IF;

  NEW.tags := v_tags;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.synchronize_artist_roles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.synchronize_artist_roles() TO service_role;

DROP TRIGGER IF EXISTS artists_synchronize_roles ON public.artists;
CREATE TRIGGER artists_synchronize_roles
BEFORE INSERT OR UPDATE OF tags, artist_type ON public.artists
FOR EACH ROW
EXECUTE FUNCTION public.synchronize_artist_roles();

UPDATE public.artists
SET tags = tags
WHERE COALESCE(cardinality(tags), 0) > 0;

UPDATE public.artists
SET artist_type = 'group',
    tags = array_append(COALESCE(tags, '{}'::text[]), 'groupe')
WHERE haitian_status = 'verified_haitian_group'
  AND NOT ('groupe' = ANY(COALESCE(tags, '{}'::text[])));

UPDATE public.artists AS artist
SET artist_type = CASE
      WHEN artist.artist_type = 'beatmaker' THEN 'beatmaker'
      ELSE 'producer'
    END,
    tags = array_append(COALESCE(artist.tags, '{}'::text[]), 'beatmaker')
WHERE (
    EXISTS (
      SELECT 1
      FROM public.artist_productions production
      WHERE production.producer_id = artist.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.track_artists credit
      WHERE credit.artist_id = artist.id
        AND credit.role = 'producer'
    )
  )
  AND NOT ('beatmaker' = ANY(COALESCE(artist.tags, '{}'::text[])));

COMMENT ON FUNCTION public.synchronize_artist_roles() IS
  'Normalise les rôles artistes et maintient artist_type aligné avec les catégories publiques.';;
