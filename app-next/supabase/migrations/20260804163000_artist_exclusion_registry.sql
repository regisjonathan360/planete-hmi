-- Registre global et persistant des artistes exclus.
-- Une exclusion s'applique à toutes les plateformes et survit aux collectes.

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusion_reason text,
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS excluded_by uuid,
  ADD COLUMN IF NOT EXISTS was_active_before_exclusion boolean;

CREATE INDEX IF NOT EXISTS artists_excluded_idx
  ON public.artists (is_excluded, name)
  WHERE is_excluded;

-- Les décisions historiques « rejected » deviennent des exclusions globales.
UPDATE public.artists
SET is_excluded = true,
    exclusion_reason = COALESCE(exclusion_reason, 'Décision historique : artiste refusé.'),
    excluded_at = COALESCE(excluded_at, updated_at, now()),
    was_active_before_exclusion = COALESCE(was_active_before_exclusion, is_active),
    is_active = false
WHERE haitian_status = 'rejected' AND NOT is_excluded;

CREATE OR REPLACE FUNCTION public.enforce_artist_exclusion_on_chart_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_artist_id uuid;
BEGIN
  IF NEW.track_id IS NULL THEN RETURN NEW; END IF;

  SELECT a.id INTO v_artist_id
  FROM public.track_artists ta
  JOIN public.artists a ON a.id = ta.artist_id
  WHERE ta.track_id = NEW.track_id AND a.is_excluded
  ORDER BY ta.billing_order NULLS LAST, a.id
  LIMIT 1;

  IF v_artist_id IS NOT NULL THEN
    NEW.is_excluded := true;
    NEW.exclusion_reason := 'artist_exclusion:' || v_artist_id::text;
    NEW.filtered_position := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chart_entry_artist_exclusion ON public.chart_entries;
CREATE TRIGGER trg_chart_entry_artist_exclusion
BEFORE INSERT OR UPDATE OF track_id, is_excluded ON public.chart_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_artist_exclusion_on_chart_entry();

-- Applique immédiatement le registre aux brouillons déjà présents.
UPDATE public.chart_entries ce
SET is_excluded = true,
    exclusion_reason = 'artist_exclusion:' || excluded.artist_id::text,
    filtered_position = NULL
FROM (
  SELECT DISTINCT ON (ta.track_id) ta.track_id, a.id AS artist_id
  FROM public.track_artists ta
  JOIN public.artists a ON a.id = ta.artist_id
  WHERE a.is_excluded
  ORDER BY ta.track_id, ta.billing_order NULLS LAST, a.id
) excluded
WHERE ce.track_id = excluded.track_id;

CREATE OR REPLACE FUNCTION public.set_artist_exclusion(
  p_artist_id uuid,
  p_excluded boolean,
  p_reason text,
  p_changed_by uuid
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_artist public.artists%ROWTYPE;
  v_marker text := 'artist_exclusion:' || p_artist_id::text;
BEGIN
  IF p_artist_id IS NULL OR p_changed_by IS NULL OR p_excluded IS NULL THEN
    RETURN QUERY SELECT false, 'missing_params'::text; RETURN;
  END IF;
  IF p_excluded AND (p_reason IS NULL OR length(btrim(p_reason)) < 3) THEN
    RETURN QUERY SELECT false, 'reason_required'::text; RETURN;
  END IF;

  SELECT * INTO v_artist FROM public.artists WHERE id = p_artist_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'artist_not_found'::text; RETURN; END IF;

  IF p_excluded THEN
    UPDATE public.artists SET
      is_excluded = true,
      exclusion_reason = btrim(p_reason),
      excluded_at = clock_timestamp(),
      excluded_by = p_changed_by,
      was_active_before_exclusion = CASE
        WHEN v_artist.is_excluded THEN v_artist.was_active_before_exclusion
        ELSE v_artist.is_active
      END,
      is_active = false
    WHERE id = p_artist_id;

    UPDATE public.chart_entries ce SET
      is_excluded = true,
      exclusion_reason = v_marker,
      filtered_position = NULL
    WHERE ce.track_id IN (
      SELECT ta.track_id FROM public.track_artists ta WHERE ta.artist_id = p_artist_id
    );
  ELSE
    UPDATE public.artists SET
      is_excluded = false,
      exclusion_reason = NULL,
      excluded_at = NULL,
      excluded_by = NULL,
      is_active = COALESCE(was_active_before_exclusion, true),
      was_active_before_exclusion = NULL
    WHERE id = p_artist_id;

    UPDATE public.chart_entries ce SET
      is_excluded = false,
      exclusion_reason = NULL
    WHERE ce.exclusion_reason = v_marker;
  END IF;

  UPDATE public.chart_editions edition SET has_unpublished_changes = true
  WHERE edition.id IN (
    SELECT DISTINCT ce.chart_edition_id
    FROM public.chart_entries ce
    JOIN public.track_artists ta ON ta.track_id = ce.track_id
    WHERE ta.artist_id = p_artist_id
  );

  INSERT INTO public.chart_audit_logs
    (user_id, action, entity_type, entity_id, old_value, new_value, reason)
  VALUES (
    p_changed_by,
    CASE WHEN p_excluded THEN 'artist_exclude_global' ELSE 'artist_reinclude_global' END,
    'artist',
    p_artist_id,
    jsonb_build_object('is_excluded', v_artist.is_excluded, 'is_active', v_artist.is_active),
    jsonb_build_object('is_excluded', p_excluded, 'is_active', CASE WHEN p_excluded THEN false ELSE COALESCE(v_artist.was_active_before_exclusion, true) END),
    NULLIF(btrim(COALESCE(p_reason, '')), '')
  );

  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.set_artist_exclusion(uuid,boolean,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_artist_exclusion(uuid,boolean,text,uuid)
  TO service_role;

COMMENT ON COLUMN public.artists.is_excluded IS
  'Exclusion globale persistante : l’artiste est ignoré par toutes les collectes et tous les compteurs.';
