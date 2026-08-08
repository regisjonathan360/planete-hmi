-- Planete HMI - K5 v4: immutable snapshots and fenced Top 20 draft.

ALTER TABLE public.chart_entries
  ADD COLUMN IF NOT EXISTS total_views bigint
    CHECK (total_views IS NULL OR total_views >= 0),
  ADD COLUMN IF NOT EXISTS eligible_video_count integer
    CHECK (eligible_video_count IS NULL OR eligible_video_count >= 0);

CREATE OR REPLACE FUNCTION public.get_latest_snapshots_before(
  p_video_ids uuid[],
  p_before_or_at timestamptz
)
RETURNS TABLE(
  youtube_video_id uuid,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  availability_status text,
  observed_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_video_ids IS NULL OR array_length(p_video_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  IF p_before_or_at IS NULL THEN
    RAISE EXCEPTION 'p_before_or_at is required';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (s.youtube_video_id)
    s.youtube_video_id,
    s.view_count,
    s.like_count,
    s.comment_count,
    s.availability_status,
    s.observed_at
  FROM public.youtube_metric_snapshots AS s
  WHERE s.youtube_video_id = ANY(p_video_ids)
    AND s.observed_at <= p_before_or_at
  ORDER BY s.youtube_video_id, s.observed_at DESC, s.id DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_latest_snapshots_before FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_snapshots_before TO service_role;

CREATE OR REPLACE FUNCTION public.get_latest_available_snapshots_before(
  p_video_ids uuid[],
  p_before_or_at timestamptz
)
RETURNS TABLE(
  youtube_video_id uuid,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  availability_status text,
  observed_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_video_ids IS NULL OR array_length(p_video_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  IF p_before_or_at IS NULL THEN
    RAISE EXCEPTION 'p_before_or_at is required';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (s.youtube_video_id)
    s.youtube_video_id,
    s.view_count,
    s.like_count,
    s.comment_count,
    s.availability_status,
    s.observed_at
  FROM public.youtube_metric_snapshots AS s
  WHERE s.youtube_video_id = ANY(p_video_ids)
    AND s.availability_status = 'available'
    AND s.observed_at <= p_before_or_at
  ORDER BY s.youtube_video_id, s.observed_at DESC, s.id DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_latest_available_snapshots_before FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_available_snapshots_before TO service_role;

CREATE OR REPLACE FUNCTION public.fenced_insert_youtube_snapshots(
  p_source_key text,
  p_period_key text,
  p_owner_token text,
  p_sync_run_id uuid,
  p_snapshots jsonb
)
RETURNS TABLE(success boolean, inserted_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lease public.youtube_sync_leases%ROWTYPE;
  v_snap jsonb;
  v_total integer;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_video_id uuid;
  v_video_ids uuid[] := ARRAY[]::uuid[];
  v_view_count bigint;
  v_like_count bigint;
  v_comment_count bigint;
  v_availability text;
  v_source text;
BEGIN
  IF p_source_key IS NULL OR btrim(p_source_key) = ''
    OR p_period_key IS NULL OR btrim(p_period_key) = ''
    OR p_owner_token IS NULL OR btrim(p_owner_token) = ''
    OR p_sync_run_id IS NULL
  THEN
    RAISE EXCEPTION 'snapshot fencing parameters are required';
  END IF;
  IF p_snapshots IS NULL OR jsonb_typeof(p_snapshots) <> 'array' THEN
    RAISE EXCEPTION 'p_snapshots must be a JSON array';
  END IF;

  v_total := jsonb_array_length(p_snapshots);
  IF v_total > 500 THEN
    RAISE EXCEPTION 'p_snapshots cannot contain more than 500 items';
  END IF;

  SELECT * INTO v_lease
  FROM public.youtube_sync_leases
  WHERE source_key = p_source_key
    AND period_key = p_period_key
  FOR UPDATE;

  IF NOT FOUND
    OR v_lease.owner_token <> p_owner_token
    OR v_lease.released_at IS NOT NULL
    OR v_lease.expires_at < clock_timestamp()
  THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;
  IF v_lease.sync_run_id <> p_sync_run_id THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  -- Validate the whole payload before the first write.
  FOR v_snap IN SELECT * FROM jsonb_array_elements(p_snapshots)
  LOOP
    IF jsonb_typeof(v_snap) <> 'object' THEN
      RAISE EXCEPTION 'each snapshot must be a JSON object';
    END IF;

    BEGIN
      v_video_id := (v_snap->>'youtube_video_id')::uuid;
      v_view_count := (v_snap->>'view_count')::bigint;
      v_like_count := NULLIF(v_snap->>'like_count', '')::bigint;
      v_comment_count := NULLIF(v_snap->>'comment_count', '')::bigint;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid snapshot field';
    END;

    IF v_video_id IS NULL OR v_video_id = ANY(v_video_ids) THEN
      RAISE EXCEPTION 'missing or duplicate youtube_video_id';
    END IF;
    v_video_ids := array_append(v_video_ids, v_video_id);

    PERFORM 1 FROM public.youtube_videos WHERE id = v_video_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unknown youtube_video_id: %', v_video_id;
    END IF;
    IF v_view_count IS NULL OR v_view_count < 0 THEN
      RAISE EXCEPTION 'invalid view_count for video %', v_video_id;
    END IF;
    IF v_like_count IS NOT NULL AND v_like_count < 0 THEN
      RAISE EXCEPTION 'invalid like_count for video %', v_video_id;
    END IF;
    IF v_comment_count IS NOT NULL AND v_comment_count < 0 THEN
      RAISE EXCEPTION 'invalid comment_count for video %', v_video_id;
    END IF;

    v_availability := COALESCE(v_snap->>'availability_status', 'available');
    IF v_availability NOT IN (
      'available', 'unavailable', 'private', 'deleted',
      'age_restricted', 'region_blocked'
    ) THEN
      RAISE EXCEPTION 'invalid availability_status: %', v_availability;
    END IF;
    v_source := btrim(COALESCE(v_snap->>'source', ''));
    IF v_source = '' THEN
      RAISE EXCEPTION 'snapshot source is required';
    END IF;
  END LOOP;

  FOR v_snap IN SELECT * FROM jsonb_array_elements(p_snapshots)
  LOOP
    BEGIN
      INSERT INTO public.youtube_metric_snapshots (
        youtube_video_id,
        sync_run_id,
        view_count,
        like_count,
        comment_count,
        availability_status,
        source,
        error,
        observed_at
      ) VALUES (
        (v_snap->>'youtube_video_id')::uuid,
        p_sync_run_id,
        (v_snap->>'view_count')::bigint,
        NULLIF(v_snap->>'like_count', '')::bigint,
        NULLIF(v_snap->>'comment_count', '')::bigint,
        COALESCE(v_snap->>'availability_status', 'available'),
        btrim(v_snap->>'source'),
        NULLIF(v_snap->>'error', ''),
        COALESCE((v_snap->>'observed_at')::timestamptz, clock_timestamp())
      );
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT true, v_inserted, v_skipped;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fenced_insert_youtube_snapshots FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fenced_insert_youtube_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.fenced_upsert_youtube_draft(
  p_source_key text,
  p_period_key text,
  p_owner_token text,
  p_sync_run_id uuid,
  p_chart_source_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_entries jsonb,
  p_status text DEFAULT 'draft',
  p_validation_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, edition_id uuid, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lease public.youtube_sync_leases%ROWTYPE;
  v_edition_id uuid;
  v_existing_status text;
  v_entry jsonb;
  v_entry_count integer := 0;
  v_source_key_check text;
  v_expected_period_key text;
  v_track_ids uuid[] := ARRAY[]::uuid[];
  v_track_id uuid;
  v_metric_value numeric;
  v_delta_views bigint;
  v_delta_likes bigint;
  v_delta_comments bigint;
  v_total_views bigint;
  v_eligible_video_count integer;
  v_lock_key bigint;
BEGIN
  IF p_source_key IS NULL OR btrim(p_source_key) = ''
    OR p_owner_token IS NULL OR btrim(p_owner_token) = ''
    OR p_sync_run_id IS NULL
    OR p_chart_source_id IS NULL
  THEN
    RETURN QUERY SELECT false, NULL::uuid, 'invalid_params'::text;
    RETURN;
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'needs_review') THEN
    RETURN QUERY SELECT false, NULL::uuid, 'invalid_status'::text;
    RETURN;
  END IF;
  IF p_period_start IS NULL
    OR p_period_end IS NULL
    OR p_period_start >= p_period_end
    OR (p_period_end::date - p_period_start::date) <> 7
  THEN
    RETURN QUERY SELECT false, NULL::uuid, 'invalid_period'::text;
    RETURN;
  END IF;

  v_expected_period_key :=
    to_char(p_period_start, 'YYYY-MM-DD') || '::' ||
    to_char(p_period_end, 'YYYY-MM-DD');
  IF p_period_key IS NULL OR p_period_key <> v_expected_period_key THEN
    RETURN QUERY SELECT false, NULL::uuid, 'period_mismatch'::text;
    RETURN;
  END IF;

  SELECT cs.source_key INTO v_source_key_check
  FROM public.chart_sources AS cs
  WHERE cs.id = p_chart_source_id;
  IF NOT FOUND OR v_source_key_check <> p_source_key THEN
    RETURN QUERY SELECT false, NULL::uuid, 'source_mismatch'::text;
    RETURN;
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array'
    OR jsonb_array_length(p_entries) > 20
  THEN
    RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text;
    RETURN;
  END IF;

  -- Validate every entry before deleting an existing draft.
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    IF jsonb_typeof(v_entry) <> 'object'
      OR NOT (v_entry ? 'track_id')
      OR NOT (v_entry ? 'metric_value')
      OR NOT (v_entry ? 'delta_views')
      OR NOT (v_entry ? 'delta_likes')
      OR NOT (v_entry ? 'delta_comments')
      OR NOT (v_entry ? 'total_views')
      OR NOT (v_entry ? 'eligible_video_count')
    THEN
      RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text;
      RETURN;
    END IF;

    BEGIN
      v_track_id := (v_entry->>'track_id')::uuid;
      v_metric_value := (v_entry->>'metric_value')::numeric;
      v_delta_views := (v_entry->>'delta_views')::bigint;
      v_delta_likes := (v_entry->>'delta_likes')::bigint;
      v_delta_comments := (v_entry->>'delta_comments')::bigint;
      v_total_views := (v_entry->>'total_views')::bigint;
      v_eligible_video_count := (v_entry->>'eligible_video_count')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text;
      RETURN;
    END;

    IF v_track_id IS NULL OR v_track_id = ANY(v_track_ids)
      OR v_metric_value IS NULL OR v_metric_value < 0
      OR v_delta_views IS NULL OR v_delta_views < 0
      OR v_delta_likes IS NULL OR v_delta_likes < 0
      OR v_delta_comments IS NULL OR v_delta_comments < 0
      OR v_total_views IS NULL OR v_total_views < 0
      OR v_eligible_video_count IS NULL OR v_eligible_video_count < 1
    THEN
      RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text;
      RETURN;
    END IF;

    PERFORM 1 FROM public.tracks WHERE id = v_track_id;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text;
      RETURN;
    END IF;
    v_track_ids := array_append(v_track_ids, v_track_id);
  END LOOP;

  v_lock_key := hashtext(p_source_key || '::draft::' || p_period_key);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT * INTO v_lease
  FROM public.youtube_sync_leases
  WHERE source_key = p_source_key
    AND period_key = p_period_key
  FOR UPDATE;

  IF NOT FOUND
    OR v_lease.owner_token <> p_owner_token
    OR v_lease.released_at IS NOT NULL
    OR v_lease.expires_at < clock_timestamp()
  THEN
    RETURN QUERY SELECT false, NULL::uuid, 'lease_invalid'::text;
    RETURN;
  END IF;
  IF v_lease.sync_run_id <> p_sync_run_id THEN
    RETURN QUERY SELECT false, NULL::uuid, 'sync_run_mismatch'::text;
    RETURN;
  END IF;

  SELECT id, status INTO v_edition_id, v_existing_status
  FROM public.chart_editions
  WHERE chart_source_id = p_chart_source_id
    AND period_start = p_period_start
    AND period_end = p_period_end;

  IF FOUND AND v_existing_status = 'published' THEN
    RETURN QUERY SELECT false, v_edition_id, 'edition_published'::text;
    RETURN;
  END IF;

  IF FOUND THEN
    DELETE FROM public.chart_entries WHERE chart_edition_id = v_edition_id;
    UPDATE public.chart_editions
    SET status = p_status,
        collected_at = clock_timestamp(),
        entry_count = jsonb_array_length(p_entries),
        validation_notes = p_validation_notes,
        updated_at = clock_timestamp()
    WHERE id = v_edition_id;
  ELSE
    INSERT INTO public.chart_editions (
      chart_source_id,
      period_start,
      period_end,
      status,
      collected_at,
      entry_count,
      validation_notes
    ) VALUES (
      p_chart_source_id,
      p_period_start,
      p_period_end,
      p_status,
      clock_timestamp(),
      jsonb_array_length(p_entries),
      p_validation_notes
    )
    RETURNING id INTO v_edition_id;
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_entry_count := v_entry_count + 1;
    INSERT INTO public.chart_entries (
      chart_edition_id,
      track_id,
      source_position,
      filtered_position,
      metric_value,
      metric_unit,
      raw_artist_text,
      raw_track_title,
      delta_views,
      delta_likes,
      delta_comments,
      total_views,
      eligible_video_count
    ) VALUES (
      v_edition_id,
      (v_entry->>'track_id')::uuid,
      v_entry_count,
      v_entry_count,
      (v_entry->>'metric_value')::numeric,
      'views',
      v_entry->>'raw_artist_text',
      v_entry->>'raw_track_title',
      (v_entry->>'delta_views')::bigint,
      (v_entry->>'delta_likes')::bigint,
      (v_entry->>'delta_comments')::bigint,
      (v_entry->>'total_views')::bigint,
      (v_entry->>'eligible_video_count')::integer
    );
  END LOOP;

  RETURN QUERY SELECT true, v_edition_id, 'ok'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fenced_upsert_youtube_draft FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fenced_upsert_youtube_draft TO service_role;

;
