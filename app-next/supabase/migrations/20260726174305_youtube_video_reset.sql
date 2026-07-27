-- Réinitialisation administrative des listes de vidéos YouTube.
-- Les snapshots restent immuables: une vidéo qui en possède est archivée,
-- tandis qu'une vidéo sans historique peut être supprimée.

CREATE OR REPLACE FUNCTION public.reset_youtube_collected_videos(
  p_scope text,
  p_confirmation text
)
RETURNS TABLE(
  success boolean,
  message text,
  affected_count integer,
  deleted_count integer,
  archived_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_expected_confirmation text;
  v_video_ids uuid[];
  v_affected_count integer := 0;
  v_deleted_count integer := 0;
  v_archived_count integer := 0;
BEGIN
  v_expected_confirmation := CASE p_scope
    WHEN 'pending' THEN 'VIDER LA FILE'
    WHEN 'rejected' THEN 'NETTOYER LES ECARTEES'
    WHEN 'all' THEN 'REINITIALISER YOUTUBE'
    ELSE NULL
  END;

  IF v_expected_confirmation IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_scope'::text, 0, 0, 0;
    RETURN;
  END IF;

  IF btrim(COALESCE(p_confirmation, '')) <> v_expected_confirmation THEN
    RETURN QUERY SELECT false, 'invalid_confirmation'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- Sérialise les réinitialisations et évite une collision avec une collecte.
  PERFORM pg_advisory_xact_lock(
    hashtext('youtube_hmi_weekly_delta::video_reset')
  );

  -- Bloque une nouvelle acquisition de lease pendant cette courte transaction.
  LOCK TABLE public.youtube_sync_leases IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.youtube_sync_leases AS lease
    WHERE lease.source_key = 'youtube_hmi_weekly_delta'
      AND lease.released_at IS NULL
      AND lease.expires_at >= clock_timestamp()
  ) THEN
    RETURN QUERY SELECT false, 'collection_in_progress'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- Empêche une découverte concurrente d'insérer pendant la remise à zéro.
  LOCK TABLE public.youtube_videos IN SHARE ROW EXCLUSIVE MODE;

  SELECT array_agg(video.id ORDER BY video.id)
  INTO v_video_ids
  FROM public.youtube_videos AS video
  WHERE video.is_active = true
    AND (
      p_scope = 'all'
      OR (
        p_scope = 'pending'
        AND video.review_status IN ('UNREVIEWED', 'NEEDS_INFORMATION')
      )
      OR (
        p_scope = 'rejected'
        AND video.review_status IN ('EXCLUDED', 'DUPLICATE', 'IGNORED')
      )
    );

  v_affected_count := COALESCE(cardinality(v_video_ids), 0);
  IF v_affected_count = 0 THEN
    RETURN QUERY SELECT true, 'nothing_to_reset'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- Détache les chansons avant suppression ou archivage.
  DELETE FROM public.youtube_track_assets
  WHERE youtube_video_id = ANY(v_video_ids);

  -- Les vidéos sans snapshot historique peuvent être supprimées.
  DELETE FROM public.youtube_videos AS video
  WHERE video.id = ANY(v_video_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM public.youtube_metric_snapshots AS snapshot
      WHERE snapshot.youtube_video_id = video.id
    );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Les snapshots sont immuables. Leurs vidéos sont donc archivées.
  UPDATE public.youtube_videos AS video
  SET review_status = 'IGNORED',
      review_reason = 'Réinitialisation administrative de la liste',
      reviewed_by = NULL,
      reviewed_at = clock_timestamp(),
      video_type = 'UNKNOWN',
      is_eligible = false,
      exclusion_reason = 'Liste réinitialisée par un administrateur',
      display_title = NULL,
      display_thumbnail_url = NULL,
      track_id = NULL,
      platform_track_id = NULL,
      is_active = false,
      updated_at = clock_timestamp()
  WHERE video.id = ANY(v_video_ids)
    AND EXISTS (
      SELECT 1
      FROM public.youtube_metric_snapshots AS snapshot
      WHERE snapshot.youtube_video_id = video.id
    );
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  RETURN QUERY
  SELECT
    true,
    'ok'::text,
    v_affected_count,
    v_deleted_count,
    v_archived_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_youtube_collected_videos(text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_youtube_collected_videos(text, text)
TO service_role;
