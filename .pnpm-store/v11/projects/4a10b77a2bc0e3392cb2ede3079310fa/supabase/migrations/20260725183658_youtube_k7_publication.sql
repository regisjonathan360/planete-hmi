-- K7 â€” publication, rÃ©vision et restauration atomiques du classement YouTube.

ALTER TABLE public.chart_editions
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_timezone text,
  ADD COLUMN IF NOT EXISTS scheduled_by uuid;

CREATE TABLE IF NOT EXISTS public.youtube_chart_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_source_id uuid NOT NULL REFERENCES public.chart_sources(id) ON DELETE RESTRICT,
  chart_edition_id uuid NOT NULL REFERENCES public.chart_editions(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  editable_state jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(editable_state) = 'array'),
  methodology text NOT NULL CHECK (btrim(methodology) <> ''),
  entry_count integer NOT NULL CHECK (entry_count BETWEEN 1 AND 20),
  published_by uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  replaces_publication_id uuid REFERENCES public.youtube_chart_publications(id) ON DELETE RESTRICT,
  restored_from_publication_id uuid REFERENCES public.youtube_chart_publications(id) ON DELETE RESTRICT,
  UNIQUE (chart_source_id, version)
);

CREATE INDEX IF NOT EXISTS youtube_chart_publications_source_date_idx
  ON public.youtube_chart_publications(chart_source_id, published_at DESC);

ALTER TABLE public.youtube_chart_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.youtube_chart_publications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.youtube_chart_publications TO service_role;

-- Les RPC K3â€“K7 sont SECURITY INVOKER : le rÃ´le serveur doit possÃ©der les
-- privilÃ¨ges de table correspondants. anon/authenticated restent soumis aux
-- restrictions et rÃ©vocations existantes.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.chart_sources,
  public.chart_editions,
  public.chart_entries,
  public.chart_published_snapshots,
  public.chart_audit_logs,
  public.chart_entry_history,
  public.sync_runs,
  public.tracks,
  public.artists,
  public.track_artists,
  public.platform_tracks,
  public.youtube_channels,
  public.youtube_channel_artists,
  public.youtube_videos,
  public.youtube_track_assets
TO service_role;
GRANT SELECT, INSERT ON public.youtube_metric_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.publish_youtube_chart(
  p_edition_id uuid,
  p_payload jsonb,
  p_editable_state jsonb,
  p_methodology text,
  p_published_by uuid,
  p_restored_from_publication_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, publication_id uuid, version integer, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_edition public.chart_editions%ROWTYPE;
  v_source public.chart_sources%ROWTYPE;
  v_previous public.youtube_chart_publications%ROWTYPE;
  v_publication_id uuid;
  v_version integer;
  v_entry_count integer;
  v_now timestamptz := clock_timestamp();
  v_state jsonb;
BEGIN
  IF p_edition_id IS NULL OR p_published_by IS NULL
    OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
    OR p_editable_state IS NULL OR jsonb_typeof(p_editable_state) <> 'array'
    OR p_methodology IS NULL OR btrim(p_methodology) = ''
  THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer, 'invalid_params'::text;
    RETURN;
  END IF;

  SELECT * INTO v_edition FROM public.chart_editions
  WHERE id = p_edition_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer, 'edition_not_found'::text;
    RETURN;
  END IF;

  SELECT * INTO v_source FROM public.chart_sources
  WHERE id = v_edition.chart_source_id AND source_key = 'youtube_hmi_weekly_delta';
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer, 'source_mismatch'::text;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_source.source_key || '::publish'));

  IF (p_restored_from_publication_id IS NULL
      AND v_edition.status NOT IN ('draft', 'validated', 'ready'))
    OR (p_restored_from_publication_id IS NOT NULL
      AND v_edition.status NOT IN ('published', 'archived'))
  THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer, 'invalid_status'::text;
    RETURN;
  END IF;

  IF p_restored_from_publication_id IS NOT NULL THEN
    FOR v_state IN SELECT value FROM jsonb_array_elements(p_editable_state)
    LOOP
      UPDATE public.chart_entries SET
        admin_position = NULLIF(v_state->>'adminPosition', '')::integer,
        is_hidden = COALESCE((v_state->>'isHidden')::boolean, false),
        is_excluded = COALESCE((v_state->>'isExcluded')::boolean, false),
        exclusion_reason = v_state->>'exclusionReason',
        display_title = v_state->>'displayTitle',
        display_artist = v_state->>'displayArtist',
        display_artwork_url = v_state->>'displayArtworkUrl',
        display_url = v_state->>'displayUrl'
      WHERE id = (v_state->>'entryId')::uuid
        AND chart_edition_id = p_edition_id;
      IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::integer,
          'restore_state_mismatch'::text;
        RETURN;
      END IF;
    END LOOP;
  END IF;

  SELECT count(*)::integer INTO v_entry_count
  FROM public.chart_entries e
  WHERE e.chart_edition_id = p_edition_id
    AND NOT e.is_hidden AND NOT e.is_excluded;

  IF jsonb_typeof(p_payload->'entries') <> 'array'
    OR v_entry_count < 1 OR v_entry_count > 20
    OR jsonb_array_length(COALESCE(p_payload->'entries', '[]'::jsonb)) <> v_entry_count
  THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer, 'invalid_entry_count'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chart_entries e
    WHERE e.chart_edition_id = p_edition_id
      AND NOT e.is_hidden AND NOT e.is_excluded
      AND (
        e.track_id IS NULL OR e.filtered_position IS NULL
        OR e.filtered_position NOT BETWEEN 1 AND 20
        OR NOT EXISTS (
          SELECT 1 FROM public.track_artists ta WHERE ta.track_id = e.track_id
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.youtube_track_assets a
          JOIN public.youtube_videos yv ON yv.id = a.youtube_video_id
          WHERE a.track_id = e.track_id
            AND yv.review_status = 'APPROVED'
            AND yv.is_active AND yv.is_eligible
            AND yv.video_type IN (
              'OFFICIAL_MUSIC_VIDEO', 'OFFICIAL_AUDIO',
              'OFFICIAL_LYRIC_VIDEO', 'OFFICIAL_VISUALIZER',
              'OFFICIAL_PERFORMANCE_VIDEO'
            )
        )
      )
  ) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer, 'validation_failed'::text;
    RETURN;
  END IF;

  SELECT * INTO v_previous
  FROM public.youtube_chart_publications
  WHERE chart_source_id = v_source.id
  ORDER BY version DESC LIMIT 1;
  v_version := COALESCE(v_previous.version, 0) + 1;

  UPDATE public.chart_editions
  SET status = 'archived', updated_at = v_now
  WHERE chart_source_id = v_source.id
    AND id <> p_edition_id AND status = 'published';

  INSERT INTO public.youtube_chart_publications (
    chart_source_id, chart_edition_id, version, period_start, period_end,
    payload, editable_state, methodology, entry_count, published_by,
    replaces_publication_id, restored_from_publication_id, published_at
  ) VALUES (
    v_source.id, p_edition_id, v_version, v_edition.period_start, v_edition.period_end,
    p_payload, p_editable_state, p_methodology, v_entry_count, p_published_by,
    v_previous.id, p_restored_from_publication_id, v_now
  ) RETURNING id INTO v_publication_id;

  INSERT INTO public.chart_published_snapshots (
    chart_source_id, source_key, edition_id, platform, period_start, period_end,
    is_stale, payload, editable_state, published_at
  ) VALUES (
    v_source.id, v_source.source_key, p_edition_id, v_source.platform,
    v_edition.period_start, v_edition.period_end, false, p_payload,
    p_editable_state, v_now
  )
  ON CONFLICT (source_key) DO UPDATE SET
    chart_source_id = EXCLUDED.chart_source_id,
    edition_id = EXCLUDED.edition_id,
    platform = EXCLUDED.platform,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    is_stale = false,
    payload = EXCLUDED.payload,
    editable_state = EXCLUDED.editable_state,
    published_at = EXCLUDED.published_at;

  UPDATE public.chart_editions SET
    status = 'published', published_at = v_now, last_published_at = v_now,
    validated_at = COALESCE(validated_at, v_now), entry_count = v_entry_count,
    has_unpublished_changes = false, scheduled_publish_at = NULL,
    publish_timezone = NULL, scheduled_by = NULL, updated_at = v_now
  WHERE id = p_edition_id;

  INSERT INTO public.chart_audit_logs(
    user_id, action, entity_type, entity_id, new_value, reason
  ) VALUES (
    p_published_by,
    CASE WHEN p_restored_from_publication_id IS NULL THEN 'youtube_chart_publish'
         ELSE 'youtube_chart_restore' END,
    'chart_edition', p_edition_id,
    jsonb_build_object('publication_id', v_publication_id, 'version', v_version),
    CASE WHEN p_restored_from_publication_id IS NULL THEN 'Publication manuelle'
         ELSE 'Restauration enregistrÃ©e' END
  );

  RETURN QUERY SELECT true, v_publication_id, v_version, 'ok'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_youtube_chart_revision(
  p_edition_id uuid, p_user_id uuid, p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RETURN false;
  END IF;
  UPDATE public.chart_editions e SET
    status = 'draft', has_unpublished_changes = true, updated_at = clock_timestamp()
  FROM public.chart_sources cs
  WHERE e.id = p_edition_id AND cs.id = e.chart_source_id
    AND cs.source_key = 'youtube_hmi_weekly_delta' AND e.status = 'published';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.chart_audit_logs(user_id, action, entity_type, entity_id, reason)
  VALUES (p_user_id, 'youtube_chart_revision_create', 'chart_edition', p_edition_id, p_reason);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_youtube_chart_publication(
  p_edition_id uuid, p_publish_at timestamptz, p_timezone text, p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_publish_at <= clock_timestamp() OR p_user_id IS NULL
    OR p_timezone IS NULL OR btrim(p_timezone) = '' THEN RETURN false; END IF;
  UPDATE public.chart_editions e SET scheduled_publish_at = p_publish_at,
    publish_timezone = p_timezone, scheduled_by = p_user_id, updated_at = clock_timestamp()
  FROM public.chart_sources cs WHERE e.id = p_edition_id
    AND cs.id = e.chart_source_id AND cs.source_key = 'youtube_hmi_weekly_delta'
    AND e.status IN ('draft','validated','ready');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_youtube_chart_publication(
  p_edition_id uuid, p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  UPDATE public.chart_editions e SET scheduled_publish_at = NULL,
    publish_timezone = NULL, scheduled_by = NULL, updated_at = clock_timestamp()
  FROM public.chart_sources cs WHERE e.id = p_edition_id
    AND cs.id = e.chart_source_id AND cs.source_key = 'youtube_hmi_weekly_delta'
    AND e.scheduled_publish_at IS NOT NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_youtube_chart(uuid,jsonb,jsonb,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_youtube_chart_revision(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.schedule_youtube_chart_publication(uuid,timestamptz,text,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_youtube_chart_publication(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_youtube_chart(uuid,jsonb,jsonb,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_youtube_chart_revision(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_youtube_chart_publication(uuid,timestamptz,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_youtube_chart_publication(uuid,uuid) TO service_role;

;
