-- =========================================================
-- K6 v3 — RPCs transactionnelles pour les routes administratives YouTube
--
-- 1. link_youtube_video_to_track : association atomique vidéo–chanson
--    - Verrouille la vidéo avec SELECT ... FOR UPDATE
--    - Supprime TOUTES les anciennes associations (pas seulement l'ancienne canonique)
--    - Garantit une seule chanson canonique par vidéo
--
-- 2. approve_youtube_video : approbation atomique complète
--    - Une seule transaction pour tout le processus d'approbation
--    - Aucun état partiel possible
--
-- 3. acquire_recalculate_lease : acquisition de lease pour le recalcul
--    - Même clé advisory que acquire_sync_lease
--
-- Conventions : SECURITY INVOKER, SET search_path = public,
-- REVOKE PUBLIC/anon/authenticated, GRANT service_role uniquement.
-- Migration locale UNIQUEMENT.
-- =========================================================

-- =========================================================
-- link_youtube_video_to_track
-- =========================================================
CREATE OR REPLACE FUNCTION public.link_youtube_video_to_track(
  p_youtube_video_id uuid,
  p_track_id uuid,
  p_asset_role text DEFAULT 'primary',
  p_is_primary boolean DEFAULT false,
  p_linked_by uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, asset_id uuid, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asset_id uuid;
BEGIN
  IF p_youtube_video_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'missing_video_id'::text; RETURN;
  END IF;
  IF p_track_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'missing_track_id'::text; RETURN;
  END IF;
  IF p_asset_role IS NULL OR p_asset_role NOT IN (
    'primary', 'lyric', 'visualizer', 'live', 'audio', 'remix', 'other'
  ) THEN
    RETURN QUERY SELECT false, NULL::uuid, 'invalid_asset_role'::text; RETURN;
  END IF;

  -- Lock the video row to prevent concurrent changes
  PERFORM 1 FROM public.youtube_videos
  WHERE id = p_youtube_video_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'video_not_found'::text; RETURN;
  END IF;

  -- Verify track exists
  PERFORM 1 FROM public.tracks WHERE id = p_track_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'track_not_found'::text; RETURN;
  END IF;

  -- Remove ALL existing associations for this video (ensures single canonical track)
  DELETE FROM public.youtube_track_assets
  WHERE youtube_video_id = p_youtube_video_id
    AND track_id <> p_track_id;

  -- Upsert the canonical association
  INSERT INTO public.youtube_track_assets (
    track_id, youtube_video_id, asset_role, is_primary, linked_by, linked_at
  ) VALUES (
    p_track_id, p_youtube_video_id, p_asset_role, p_is_primary, p_linked_by, clock_timestamp()
  )
  ON CONFLICT (track_id, youtube_video_id) DO UPDATE SET
    asset_role = EXCLUDED.asset_role,
    is_primary = EXCLUDED.is_primary,
    linked_by = EXCLUDED.linked_by,
    linked_at = EXCLUDED.linked_at
  RETURNING id INTO v_asset_id;

  -- Update canonical track_id on youtube_videos
  UPDATE public.youtube_videos SET track_id = p_track_id WHERE id = p_youtube_video_id;

  RETURN QUERY SELECT true, v_asset_id, 'ok'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_youtube_video_to_track FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_youtube_video_to_track TO service_role;

-- Une vidéo possède une seule chanson canonique, tandis qu'une chanson peut
-- toujours agréger plusieurs vidéos.
CREATE UNIQUE INDEX IF NOT EXISTS yt_assets_one_track_per_video_idx
  ON public.youtube_track_assets (youtube_video_id);

-- =========================================================
-- approve_youtube_video : approbation atomique complète
--
-- Réalise dans une seule transaction :
-- 1. Verrouillage de la vidéo
-- 2. Vérification vidéo + chanson + type éligible
-- 3. Suppression associations contradictoires
-- 4. Création/mise à jour de l'association canonique
-- 5. Mise à jour youtube_videos (track_id, review_status, etc.)
-- =========================================================
CREATE OR REPLACE FUNCTION public.approve_youtube_video(
  p_youtube_video_id uuid,
  p_track_id uuid,
  p_video_type text,
  p_review_reason text,
  p_reviewed_by uuid
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_video_exists boolean;
  v_track_exists boolean;
BEGIN
  -- Validate parameters
  IF p_youtube_video_id IS NULL OR p_track_id IS NULL OR p_video_type IS NULL THEN
    RETURN QUERY SELECT false, 'missing_params'::text; RETURN;
  END IF;
  IF p_reviewed_by IS NULL THEN
    RETURN QUERY SELECT false, 'missing_reviewer'::text; RETURN;
  END IF;
  IF p_review_reason IS NULL OR length(btrim(p_review_reason)) < 10 THEN
    RETURN QUERY SELECT false, 'review_reason_too_short'::text; RETURN;
  END IF;

  -- Check video type is eligible
  IF p_video_type NOT IN (
    'OFFICIAL_MUSIC_VIDEO', 'OFFICIAL_AUDIO', 'OFFICIAL_LYRIC_VIDEO',
    'OFFICIAL_VISUALIZER', 'OFFICIAL_ANIMATION'
  ) THEN
    RETURN QUERY SELECT false, 'ineligible_video_type'::text; RETURN;
  END IF;

  -- Lock and verify video
  SELECT EXISTS(
    SELECT 1 FROM public.youtube_videos WHERE id = p_youtube_video_id FOR UPDATE
  ) INTO v_video_exists;
  IF NOT v_video_exists THEN
    RETURN QUERY SELECT false, 'video_not_found'::text; RETURN;
  END IF;

  -- Verify track
  SELECT EXISTS(
    SELECT 1 FROM public.tracks WHERE id = p_track_id
  ) INTO v_track_exists;
  IF NOT v_track_exists THEN
    RETURN QUERY SELECT false, 'track_not_found'::text; RETURN;
  END IF;

  -- Remove ALL contradictory associations for this video
  DELETE FROM public.youtube_track_assets
  WHERE youtube_video_id = p_youtube_video_id
    AND track_id <> p_track_id;

  -- Create or update the canonical association
  INSERT INTO public.youtube_track_assets (
    track_id, youtube_video_id, asset_role, is_primary, is_eligible, linked_by, linked_at
  ) VALUES (
    p_track_id, p_youtube_video_id, 'primary', true, true, p_reviewed_by, clock_timestamp()
  )
  ON CONFLICT (track_id, youtube_video_id) DO UPDATE SET
    asset_role = 'primary',
    is_primary = true,
    is_eligible = true,
    linked_by = EXCLUDED.linked_by,
    linked_at = EXCLUDED.linked_at;

  -- Atomically update the video editorial state
  UPDATE public.youtube_videos
  SET track_id = p_track_id,
      review_status = 'APPROVED',
      video_type = p_video_type,
      is_eligible = true,
      review_reason = p_review_reason,
      reviewed_by = p_reviewed_by,
      reviewed_at = clock_timestamp()
  WHERE id = p_youtube_video_id;

  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_youtube_video FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_youtube_video TO service_role;

-- =========================================================
-- acquire_recalculate_lease
-- Same advisory lock key as acquire_sync_lease
-- =========================================================
CREATE OR REPLACE FUNCTION public.acquire_recalculate_lease(
  p_source_key text,
  p_period_key text,
  p_owner_token text,
  p_lease_duration_seconds integer DEFAULT 300,
  p_chart_source_id uuid DEFAULT NULL
)
RETURNS TABLE(acquired boolean, run_id uuid, owner_token text, lease_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lease public.youtube_sync_leases%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz;
  v_run_id uuid;
  v_lock_key bigint;
BEGIN
  IF p_source_key IS NULL OR btrim(p_source_key) = '' THEN
    RAISE EXCEPTION 'p_source_key ne peut pas être vide';
  END IF;
  IF p_period_key IS NULL OR btrim(p_period_key) = '' THEN
    RAISE EXCEPTION 'p_period_key ne peut pas être vide';
  END IF;
  IF p_owner_token IS NULL OR btrim(p_owner_token) = '' THEN
    RAISE EXCEPTION 'p_owner_token ne peut pas être vide';
  END IF;
  IF p_lease_duration_seconds IS NULL OR p_lease_duration_seconds < 10 OR p_lease_duration_seconds > 3600 THEN
    RAISE EXCEPTION 'p_lease_duration_seconds doit être entre 10 et 3600';
  END IF;
  IF p_chart_source_id IS NULL THEN
    RAISE EXCEPTION 'p_chart_source_id requis';
  END IF;

  v_expires := v_now + make_interval(secs => p_lease_duration_seconds);

  -- SAME advisory lock key as acquire_sync_lease
  v_lock_key := hashtext(p_source_key || '::' || p_period_key);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT * INTO v_lease
  FROM public.youtube_sync_leases
  WHERE youtube_sync_leases.source_key = p_source_key
    AND youtube_sync_leases.period_key = p_period_key
  FOR UPDATE;

  IF FOUND THEN
    -- Active lease held by another owner → refuse
    IF v_lease.released_at IS NULL AND v_lease.expires_at >= v_now
       AND v_lease.owner_token <> p_owner_token THEN
      RETURN QUERY SELECT false, NULL::uuid, ''::text, NULL::timestamptz;
      RETURN;
    END IF;

    -- Expired/released or same owner → take over
    INSERT INTO public.sync_runs (chart_source_id, run_type, started_at, status, metadata)
    VALUES (p_chart_source_id, 'youtube_recalculate', v_now, 'RUNNING',
      jsonb_build_object('sourceKey', p_source_key, 'periodKey', p_period_key, 'type', 'recalculate'))
    RETURNING id INTO v_run_id;

    UPDATE public.youtube_sync_leases
    SET owner_token = p_owner_token, acquired_at = v_now, expires_at = v_expires,
        released_at = NULL, sync_run_id = v_run_id, cancel_requested = false
    WHERE youtube_sync_leases.id = v_lease.id;

    RETURN QUERY SELECT true, v_run_id, p_owner_token, v_expires;
    RETURN;
  END IF;

  -- No existing lease
  INSERT INTO public.sync_runs (chart_source_id, run_type, started_at, status, metadata)
  VALUES (p_chart_source_id, 'youtube_recalculate', v_now, 'RUNNING',
    jsonb_build_object('sourceKey', p_source_key, 'periodKey', p_period_key, 'type', 'recalculate'))
  RETURNING id INTO v_run_id;

  INSERT INTO public.youtube_sync_leases (source_key, period_key, owner_token, acquired_at, expires_at, sync_run_id)
  VALUES (p_source_key, p_period_key, p_owner_token, v_now, v_expires, v_run_id);

  RETURN QUERY SELECT true, v_run_id, p_owner_token, v_expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_recalculate_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_recalculate_lease TO service_role;


-- =========================================================
-- update_youtube_video_editorial : mise à jour atomique des champs éditoriaux
--
-- Réalise dans une seule transaction :
-- 1. Verrouillage de la vidéo
-- 2. Validation chanson si fournie
-- 3. Validation cohérence statut/type/éligibilité/chanson
-- 4. Mise à jour association si la chanson change
-- 5. Mise à jour champs éditoriaux
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_youtube_video_editorial(
  p_youtube_video_id uuid,
  p_display_title text,
  p_display_thumbnail_url text,
  p_review_status text,
  p_video_type text,
  p_is_eligible boolean,
  p_track_id uuid,
  p_exclusion_reason text,
  p_review_reason text,
  p_reviewed_by uuid
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_youtube_video_id IS NULL THEN
    RETURN QUERY SELECT false, 'missing_video_id'::text; RETURN;
  END IF;

  -- Lock the video
  PERFORM 1 FROM public.youtube_videos
  WHERE id = p_youtube_video_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'video_not_found'::text; RETURN;
  END IF;

  IF p_reviewed_by IS NULL THEN
    RETURN QUERY SELECT false, 'missing_reviewer'::text; RETURN;
  END IF;
  IF p_review_status NOT IN (
    'UNREVIEWED', 'NEEDS_INFORMATION', 'APPROVED',
    'EXCLUDED', 'DUPLICATE', 'IGNORED'
  ) THEN
    RETURN QUERY SELECT false, 'invalid_review_status'::text; RETURN;
  END IF;
  IF p_video_type NOT IN (
    'OFFICIAL_MUSIC_VIDEO', 'OFFICIAL_AUDIO', 'OFFICIAL_LYRIC_VIDEO',
    'OFFICIAL_VISUALIZER', 'OFFICIAL_ANIMATION', 'SHORT',
    'LIVE_PERFORMANCE', 'CONCERT', 'INTERVIEW', 'TEASER', 'TRAILER',
    'REACTION', 'FAN_UPLOAD', 'DANCE_CHALLENGE', 'PODCAST',
    'COMPILATION', 'BEHIND_THE_SCENES', 'UNKNOWN'
  ) THEN
    RETURN QUERY SELECT false, 'invalid_video_type'::text; RETURN;
  END IF;
  IF p_is_eligible AND (
    p_review_status <> 'APPROVED'
    OR p_track_id IS NULL
    OR p_video_type NOT IN (
      'OFFICIAL_MUSIC_VIDEO', 'OFFICIAL_AUDIO', 'OFFICIAL_LYRIC_VIDEO',
      'OFFICIAL_VISUALIZER', 'OFFICIAL_ANIMATION'
    )
  ) THEN
    RETURN QUERY SELECT false, 'incoherent_eligibility'::text; RETURN;
  END IF;
  IF (p_review_status = 'EXCLUDED' OR (p_review_status = 'APPROVED' AND NOT p_is_eligible))
     AND (p_exclusion_reason IS NULL OR length(btrim(p_exclusion_reason)) < 3) THEN
    RETURN QUERY SELECT false, 'exclusion_reason_required'::text; RETURN;
  END IF;

  -- A null track explicitly detaches the video and removes every asset.
  IF p_track_id IS NULL THEN
    DELETE FROM public.youtube_track_assets
    WHERE youtube_video_id = p_youtube_video_id;
  ELSE
    PERFORM 1 FROM public.tracks WHERE id = p_track_id;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 'track_not_found'::text; RETURN;
    END IF;

    -- Remove all old associations for this video
    DELETE FROM public.youtube_track_assets
    WHERE youtube_video_id = p_youtube_video_id
      AND track_id <> p_track_id;

    -- Upsert canonical association
    INSERT INTO public.youtube_track_assets (
      track_id, youtube_video_id, asset_role, is_primary, is_eligible, linked_by, linked_at
    ) VALUES (
      p_track_id, p_youtube_video_id, 'primary', false, p_is_eligible, p_reviewed_by, clock_timestamp()
    )
    ON CONFLICT (track_id, youtube_video_id) DO UPDATE SET
      is_eligible = EXCLUDED.is_eligible,
      linked_by = EXCLUDED.linked_by,
      linked_at = EXCLUDED.linked_at;
  END IF;

  -- Update editorial fields atomically
  UPDATE public.youtube_videos
  SET display_title = p_display_title,
      display_thumbnail_url = NULLIF(p_display_thumbnail_url, ''),
      review_status = p_review_status,
      video_type = p_video_type,
      is_eligible = p_is_eligible,
      track_id = p_track_id,
      exclusion_reason = NULLIF(p_exclusion_reason, ''),
      review_reason = p_review_reason,
      reviewed_by = p_reviewed_by,
      reviewed_at = clock_timestamp()
  WHERE id = p_youtube_video_id;

  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_youtube_video_editorial FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_youtube_video_editorial TO service_role;
