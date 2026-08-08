-- Classement YouTube centré sur les vidéos.
-- Une chanson peut rester associée à titre documentaire, mais n'est plus requise.

ALTER TABLE public.chart_entries
  ADD COLUMN IF NOT EXISTS youtube_video_id uuid
  REFERENCES public.youtube_videos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS chart_entries_youtube_video_idx
  ON public.chart_entries (youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chart_entries_edition_youtube_video_uidx
  ON public.chart_entries (chart_edition_id, youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_youtube_video_editorial(
  p_youtube_video_id uuid, p_display_title text, p_display_thumbnail_url text,
  p_review_status text, p_video_type text, p_is_eligible boolean,
  p_track_id uuid, p_exclusion_reason text, p_review_reason text, p_reviewed_by uuid
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_youtube_video_id IS NULL THEN RETURN QUERY SELECT false, 'missing_video_id'::text; RETURN; END IF;
  PERFORM 1 FROM public.youtube_videos WHERE id = p_youtube_video_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'video_not_found'::text; RETURN; END IF;
  IF p_reviewed_by IS NULL THEN RETURN QUERY SELECT false, 'missing_reviewer'::text; RETURN; END IF;
  IF p_review_status NOT IN ('UNREVIEWED','NEEDS_INFORMATION','APPROVED','EXCLUDED','DUPLICATE','IGNORED')
    THEN RETURN QUERY SELECT false, 'invalid_review_status'::text; RETURN; END IF;
  IF p_video_type NOT IN (
    'OFFICIAL_MUSIC_VIDEO','OFFICIAL_AUDIO','OFFICIAL_LYRIC_VIDEO','OFFICIAL_VISUALIZER',
    'OFFICIAL_ANIMATION','SHORT','LIVE_PERFORMANCE','CONCERT','INTERVIEW','TEASER','TRAILER',
    'REACTION','FAN_UPLOAD','DANCE_CHALLENGE','PODCAST','COMPILATION','BEHIND_THE_SCENES','UNKNOWN'
  ) THEN RETURN QUERY SELECT false, 'invalid_video_type'::text; RETURN; END IF;
  IF p_is_eligible AND p_review_status <> 'APPROVED'
    THEN RETURN QUERY SELECT false, 'incoherent_eligibility'::text; RETURN; END IF;
  IF p_review_status = 'EXCLUDED'
    AND (p_exclusion_reason IS NULL OR length(btrim(p_exclusion_reason)) < 3)
    THEN RETURN QUERY SELECT false, 'exclusion_reason_required'::text; RETURN; END IF;

  IF p_track_id IS NULL THEN
    DELETE FROM public.youtube_track_assets WHERE youtube_video_id = p_youtube_video_id;
  ELSE
    PERFORM 1 FROM public.tracks WHERE id = p_track_id;
    IF NOT FOUND THEN RETURN QUERY SELECT false, 'track_not_found'::text; RETURN; END IF;
    DELETE FROM public.youtube_track_assets
      WHERE youtube_video_id = p_youtube_video_id AND track_id <> p_track_id;
    INSERT INTO public.youtube_track_assets
      (track_id, youtube_video_id, asset_role, is_primary, is_eligible, linked_by, linked_at)
    VALUES (p_track_id, p_youtube_video_id, 'primary', false, p_is_eligible, p_reviewed_by, clock_timestamp())
    ON CONFLICT (track_id, youtube_video_id) DO UPDATE SET
      is_eligible = EXCLUDED.is_eligible, linked_by = EXCLUDED.linked_by, linked_at = EXCLUDED.linked_at;
  END IF;

  UPDATE public.youtube_videos SET
    display_title = p_display_title,
    display_thumbnail_url = NULLIF(p_display_thumbnail_url, ''),
    review_status = p_review_status, video_type = p_video_type,
    is_eligible = p_is_eligible, track_id = p_track_id,
    exclusion_reason = NULLIF(p_exclusion_reason, ''), review_reason = p_review_reason,
    reviewed_by = p_reviewed_by, reviewed_at = clock_timestamp()
  WHERE id = p_youtube_video_id;
  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.update_youtube_video_editorial(uuid,text,text,text,text,boolean,uuid,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_youtube_video_editorial(uuid,text,text,text,text,boolean,uuid,text,text,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fenced_upsert_youtube_draft(
  p_source_key text, p_period_key text, p_owner_token text, p_sync_run_id uuid,
  p_chart_source_id uuid, p_period_start timestamptz, p_period_end timestamptz,
  p_entries jsonb, p_status text DEFAULT 'draft', p_validation_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, edition_id uuid, message text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_lease public.youtube_sync_leases%ROWTYPE;
  v_edition_id uuid; v_existing_status text; v_entry jsonb; v_entry_count integer := 0;
  v_video_id uuid; v_video_ids uuid[] := ARRAY[]::uuid[]; v_track_id uuid;
  v_source_key_check text; v_expected_period_key text; v_lock_key bigint;
BEGIN
  IF p_source_key IS NULL OR btrim(p_source_key) = '' OR p_owner_token IS NULL
    OR btrim(p_owner_token) = '' OR p_sync_run_id IS NULL OR p_chart_source_id IS NULL
    THEN RETURN QUERY SELECT false, NULL::uuid, 'invalid_params'::text; RETURN; END IF;
  IF p_status NOT IN ('draft','needs_review')
    THEN RETURN QUERY SELECT false, NULL::uuid, 'invalid_status'::text; RETURN; END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start >= p_period_end
    OR (p_period_end::date - p_period_start::date) <> 7
    THEN RETURN QUERY SELECT false, NULL::uuid, 'invalid_period'::text; RETURN; END IF;
  v_expected_period_key := to_char(p_period_start,'YYYY-MM-DD') || '::' || to_char(p_period_end,'YYYY-MM-DD');
  IF p_period_key IS NULL OR p_period_key <> v_expected_period_key
    THEN RETURN QUERY SELECT false, NULL::uuid, 'period_mismatch'::text; RETURN; END IF;
  SELECT source_key INTO v_source_key_check FROM public.chart_sources WHERE id = p_chart_source_id;
  IF NOT FOUND OR v_source_key_check <> p_source_key
    THEN RETURN QUERY SELECT false, NULL::uuid, 'source_mismatch'::text; RETURN; END IF;
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) > 20
    THEN RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text; RETURN; END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    BEGIN
      v_video_id := (v_entry->>'youtube_video_id')::uuid;
      v_track_id := NULLIF(v_entry->>'track_id','')::uuid;
      PERFORM (v_entry->>'metric_value')::numeric, (v_entry->>'delta_views')::bigint,
        (v_entry->>'delta_likes')::bigint, (v_entry->>'delta_comments')::bigint,
        (v_entry->>'total_views')::bigint;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text; RETURN;
    END;
    IF v_video_id IS NULL OR v_video_id = ANY(v_video_ids)
      OR COALESCE((v_entry->>'metric_value')::numeric, -1) < 0
      OR COALESCE((v_entry->>'delta_views')::bigint, -1) < 0
      THEN RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text; RETURN; END IF;
    PERFORM 1 FROM public.youtube_videos
      WHERE id = v_video_id AND is_active AND review_status = 'APPROVED' AND is_eligible;
    IF NOT FOUND THEN RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text; RETURN; END IF;
    IF v_track_id IS NOT NULL THEN
      PERFORM 1 FROM public.tracks WHERE id = v_track_id;
      IF NOT FOUND THEN RETURN QUERY SELECT false, NULL::uuid, 'invalid_entries'::text; RETURN; END IF;
    END IF;
    v_video_ids := array_append(v_video_ids, v_video_id);
  END LOOP;

  v_lock_key := hashtext(p_source_key || '::draft::' || p_period_key);
  PERFORM pg_advisory_xact_lock(v_lock_key);
  SELECT * INTO v_lease FROM public.youtube_sync_leases
    WHERE source_key = p_source_key AND period_key = p_period_key FOR UPDATE;
  IF NOT FOUND OR v_lease.owner_token <> p_owner_token OR v_lease.released_at IS NOT NULL
    OR v_lease.expires_at < clock_timestamp()
    THEN RETURN QUERY SELECT false, NULL::uuid, 'lease_invalid'::text; RETURN; END IF;
  IF v_lease.sync_run_id <> p_sync_run_id
    THEN RETURN QUERY SELECT false, NULL::uuid, 'sync_run_mismatch'::text; RETURN; END IF;

  SELECT id, status INTO v_edition_id, v_existing_status FROM public.chart_editions
    WHERE chart_source_id = p_chart_source_id AND period_start = p_period_start AND period_end = p_period_end;
  IF FOUND AND v_existing_status = 'published'
    THEN RETURN QUERY SELECT false, v_edition_id, 'edition_published'::text; RETURN; END IF;
  IF FOUND THEN
    DELETE FROM public.chart_entries WHERE chart_edition_id = v_edition_id;
    UPDATE public.chart_editions SET status = p_status, collected_at = clock_timestamp(),
      entry_count = jsonb_array_length(p_entries), validation_notes = p_validation_notes,
      updated_at = clock_timestamp() WHERE id = v_edition_id;
  ELSE
    INSERT INTO public.chart_editions
      (chart_source_id,period_start,period_end,status,collected_at,entry_count,validation_notes)
    VALUES (p_chart_source_id,p_period_start,p_period_end,p_status,clock_timestamp(),jsonb_array_length(p_entries),p_validation_notes)
    RETURNING id INTO v_edition_id;
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_entry_count := v_entry_count + 1;
    INSERT INTO public.chart_entries
      (chart_edition_id,youtube_video_id,track_id,source_position,filtered_position,metric_value,metric_unit,
       raw_artist_text,raw_track_title,delta_views,delta_likes,delta_comments,total_views,eligible_video_count)
    VALUES (v_edition_id,(v_entry->>'youtube_video_id')::uuid,NULLIF(v_entry->>'track_id','')::uuid,
      v_entry_count,v_entry_count,(v_entry->>'metric_value')::numeric,'views',
      v_entry->>'raw_artist_text',v_entry->>'raw_track_title',(v_entry->>'delta_views')::bigint,
      (v_entry->>'delta_likes')::bigint,(v_entry->>'delta_comments')::bigint,
      (v_entry->>'total_views')::bigint,(v_entry->>'eligible_video_count')::integer);
  END LOOP;
  RETURN QUERY SELECT true, v_edition_id, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.fenced_upsert_youtube_draft(text,text,text,uuid,uuid,timestamptz,timestamptz,jsonb,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fenced_upsert_youtube_draft(text,text,text,uuid,uuid,timestamptz,timestamptz,jsonb,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.publish_youtube_chart(
  p_edition_id uuid, p_payload jsonb, p_editable_state jsonb, p_methodology text,
  p_published_by uuid, p_restored_from_publication_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, publication_id uuid, version integer, message text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_edition public.chart_editions%ROWTYPE; v_source public.chart_sources%ROWTYPE;
  v_previous public.youtube_chart_publications%ROWTYPE; v_publication_id uuid;
  v_version integer; v_entry_count integer; v_now timestamptz := clock_timestamp(); v_state jsonb;
BEGIN
  IF p_edition_id IS NULL OR p_published_by IS NULL OR p_payload IS NULL
    OR jsonb_typeof(p_payload) <> 'object' OR p_editable_state IS NULL
    OR jsonb_typeof(p_editable_state) <> 'array' OR p_methodology IS NULL OR btrim(p_methodology) = ''
    THEN RETURN QUERY SELECT false,NULL::uuid,NULL::integer,'invalid_params'::text; RETURN; END IF;
  SELECT * INTO v_edition FROM public.chart_editions WHERE id = p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false,NULL::uuid,NULL::integer,'edition_not_found'::text; RETURN; END IF;
  SELECT * INTO v_source FROM public.chart_sources
    WHERE id = v_edition.chart_source_id AND source_key = 'youtube_hmi_weekly_delta';
  IF NOT FOUND THEN RETURN QUERY SELECT false,NULL::uuid,NULL::integer,'source_mismatch'::text; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_source.source_key || '::publish'));
  IF (p_restored_from_publication_id IS NULL AND v_edition.status NOT IN ('draft','validated','ready'))
    OR (p_restored_from_publication_id IS NOT NULL AND v_edition.status NOT IN ('published','archived'))
    THEN RETURN QUERY SELECT false,NULL::uuid,NULL::integer,'invalid_status'::text; RETURN; END IF;

  IF p_restored_from_publication_id IS NOT NULL THEN
    FOR v_state IN SELECT value FROM jsonb_array_elements(p_editable_state) LOOP
      UPDATE public.chart_entries SET admin_position = NULLIF(v_state->>'adminPosition','')::integer,
        is_hidden = COALESCE((v_state->>'isHidden')::boolean,false),
        is_excluded = COALESCE((v_state->>'isExcluded')::boolean,false),
        exclusion_reason = v_state->>'exclusionReason', display_title = v_state->>'displayTitle',
        display_artist = v_state->>'displayArtist', display_artwork_url = v_state->>'displayArtworkUrl',
        display_url = v_state->>'displayUrl'
      WHERE id = (v_state->>'entryId')::uuid AND chart_edition_id = p_edition_id;
      IF NOT FOUND THEN RETURN QUERY SELECT false,NULL::uuid,NULL::integer,'restore_state_mismatch'::text; RETURN; END IF;
    END LOOP;
  END IF;

  SELECT count(*)::integer INTO v_entry_count FROM public.chart_entries e
    WHERE e.chart_edition_id = p_edition_id AND NOT e.is_hidden AND NOT e.is_excluded;
  IF jsonb_typeof(p_payload->'entries') <> 'array' OR v_entry_count < 1 OR v_entry_count > 20
    OR jsonb_array_length(COALESCE(p_payload->'entries','[]'::jsonb)) <> v_entry_count
    THEN RETURN QUERY SELECT false,NULL::uuid,NULL::integer,'invalid_entry_count'::text; RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.chart_entries e
    LEFT JOIN public.youtube_videos yv ON yv.id = e.youtube_video_id
    WHERE e.chart_edition_id = p_edition_id AND NOT e.is_hidden AND NOT e.is_excluded
      AND (e.youtube_video_id IS NULL OR e.filtered_position IS NULL
        OR e.filtered_position NOT BETWEEN 1 AND 20 OR yv.id IS NULL
        OR yv.review_status <> 'APPROVED' OR NOT yv.is_active OR NOT yv.is_eligible)
  ) THEN RETURN QUERY SELECT false,NULL::uuid,NULL::integer,'validation_failed'::text; RETURN; END IF;

  SELECT * INTO v_previous FROM public.youtube_chart_publications
    WHERE chart_source_id = v_source.id ORDER BY version DESC LIMIT 1;
  v_version := COALESCE(v_previous.version,0) + 1;
  UPDATE public.chart_editions SET status='archived',updated_at=v_now
    WHERE chart_source_id=v_source.id AND id<>p_edition_id AND status='published';
  INSERT INTO public.youtube_chart_publications
    (chart_source_id,chart_edition_id,version,period_start,period_end,payload,editable_state,methodology,
     entry_count,published_by,replaces_publication_id,restored_from_publication_id,published_at)
  VALUES (v_source.id,p_edition_id,v_version,v_edition.period_start,v_edition.period_end,p_payload,p_editable_state,
    p_methodology,v_entry_count,p_published_by,v_previous.id,p_restored_from_publication_id,v_now)
  RETURNING id INTO v_publication_id;
  INSERT INTO public.chart_published_snapshots
    (chart_source_id,source_key,edition_id,platform,period_start,period_end,is_stale,payload,editable_state,published_at)
  VALUES (v_source.id,v_source.source_key,p_edition_id,v_source.platform,v_edition.period_start,v_edition.period_end,
    false,p_payload,p_editable_state,v_now)
  ON CONFLICT (source_key) DO UPDATE SET chart_source_id=EXCLUDED.chart_source_id,
    edition_id=EXCLUDED.edition_id,platform=EXCLUDED.platform,period_start=EXCLUDED.period_start,
    period_end=EXCLUDED.period_end,is_stale=false,payload=EXCLUDED.payload,
    editable_state=EXCLUDED.editable_state,published_at=EXCLUDED.published_at;
  UPDATE public.chart_editions SET status='published',published_at=v_now,last_published_at=v_now,
    validated_at=COALESCE(validated_at,v_now),entry_count=v_entry_count,has_unpublished_changes=false,
    scheduled_publish_at=NULL,publish_timezone=NULL,scheduled_by=NULL,updated_at=v_now WHERE id=p_edition_id;
  INSERT INTO public.chart_audit_logs(user_id,action,entity_type,entity_id,new_value,reason)
  VALUES (p_published_by,CASE WHEN p_restored_from_publication_id IS NULL THEN 'youtube_chart_publish'
    ELSE 'youtube_chart_restore' END,'chart_edition',p_edition_id,
    jsonb_build_object('publication_id',v_publication_id,'version',v_version),
    CASE WHEN p_restored_from_publication_id IS NULL THEN 'Publication manuelle' ELSE 'Restauration enregistrée' END);
  RETURN QUERY SELECT true,v_publication_id,v_version,'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_youtube_chart(uuid,jsonb,jsonb,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_youtube_chart(uuid,jsonb,jsonb,text,uuid,uuid) TO service_role;

;
