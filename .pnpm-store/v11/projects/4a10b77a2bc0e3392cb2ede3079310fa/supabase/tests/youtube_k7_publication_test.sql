\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_source uuid;
  v_track uuid;
  v_video uuid;
  v_ed1 uuid;
  v_ed2 uuid;
  v_pub1 uuid;
  v_result record;
  v_payload jsonb;
  v_user uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_count integer;
  v_ok boolean;
BEGIN
  SELECT id INTO v_source FROM public.chart_sources
  WHERE source_key = 'youtube_hmi_weekly_delta';
  SELECT t.id INTO v_track FROM public.tracks t
  WHERE EXISTS (SELECT 1 FROM public.track_artists ta WHERE ta.track_id = t.id)
  LIMIT 1;

  INSERT INTO public.youtube_channels(
    channel_id, channel_title, is_youtube_verified, status, is_active,
    approval_reason, approved_by, approved_at
  ) VALUES (
    'UCK7xxxxxxxxxxxxxxxxxxxxx', 'K7 test', true, 'active', true,
    'test', v_user, clock_timestamp()
  );

  INSERT INTO public.youtube_videos(
    video_id, channel_id, source_title, published_at, review_status,
    reviewed_by, reviewed_at, video_type, is_eligible, is_active, track_id
  ) VALUES (
    'K7video0001', 'UCK7xxxxxxxxxxxxxxxxxxxxx', 'K7 video', '2026-07-01',
    'APPROVED', v_user, clock_timestamp(), 'OFFICIAL_MUSIC_VIDEO',
    true, true, v_track
  ) RETURNING id INTO v_video;
  INSERT INTO public.youtube_track_assets(track_id, youtube_video_id, asset_role, is_eligible)
  VALUES (v_track, v_video, 'primary', true);

  INSERT INTO public.chart_editions(chart_source_id, period_start, period_end, status)
  VALUES (v_source, '2026-07-01', '2026-07-08', 'ready') RETURNING id INTO v_ed1;
  INSERT INTO public.chart_entries(
    chart_edition_id, track_id, source_position, filtered_position,
    metric_value, metric_unit, delta_views, delta_likes, delta_comments,
    total_views, eligible_video_count
  ) VALUES (v_ed1, v_track, 1, 1, 100, 'views', 100, 10, 2, 1000, 1);

  v_payload := jsonb_build_object(
    'source_key', 'youtube_hmi_weekly_delta',
    'methodology', 'test methodology',
    'entries', jsonb_build_array(jsonb_build_object(
      'filtered_position', 1, 'track_id', v_track, 'metric_value', 100
    ))
  );
  SELECT * INTO v_result FROM public.publish_youtube_chart(
    v_ed1, v_payload, '[]', 'test methodology', v_user, NULL
  );
  IF NOT v_result.success OR v_result.version <> 1 THEN
    RAISE EXCEPTION 'K7 publish v1 failed: %', v_result.message;
  END IF;
  v_pub1 := v_result.publication_id;
  IF (SELECT status FROM public.chart_editions WHERE id = v_ed1) <> 'published'
    OR (SELECT edition_id FROM public.chart_published_snapshots
        WHERE source_key = 'youtube_hmi_weekly_delta') <> v_ed1 THEN
    RAISE EXCEPTION 'K7 publication not atomically visible';
  END IF;

  INSERT INTO public.chart_editions(chart_source_id, period_start, period_end, status)
  VALUES (v_source, '2026-07-08', '2026-07-15', 'ready') RETURNING id INTO v_ed2;
  INSERT INTO public.chart_entries(
    chart_edition_id, track_id, source_position, filtered_position,
    metric_value, metric_unit, delta_views, delta_likes, delta_comments,
    total_views, eligible_video_count
  ) VALUES (v_ed2, v_track, 1, 1, 150, 'views', 150, 12, 3, 1150, 1);
  SELECT * INTO v_result FROM public.publish_youtube_chart(
    v_ed2, v_payload, '[]', 'test methodology', v_user, NULL
  );
  IF NOT v_result.success OR v_result.version <> 2
    OR (SELECT status FROM public.chart_editions WHERE id = v_ed1) <> 'archived' THEN
    RAISE EXCEPTION 'K7 archive/publish v2 failed';
  END IF;

  v_ok := public.create_youtube_chart_revision(v_ed2, v_user, 'correction test');
  IF NOT v_ok OR (SELECT status FROM public.chart_editions WHERE id = v_ed2) <> 'draft' THEN
    RAISE EXCEPTION 'K7 explicit revision failed: ok %, status %',
      v_ok, (SELECT status FROM public.chart_editions WHERE id = v_ed2);
  END IF;
  SELECT * INTO v_result FROM public.publish_youtube_chart(
    v_ed2, v_payload, '[]', 'test methodology', v_user, NULL
  );
  IF NOT v_result.success OR v_result.version <> 3 THEN
    RAISE EXCEPTION 'K7 republish revision failed';
  END IF;

  SELECT * INTO v_result FROM public.publish_youtube_chart(
    v_ed1, v_payload, '[]', 'test methodology', v_user, v_pub1
  );
  IF NOT v_result.success OR v_result.version <> 4
    OR (SELECT status FROM public.chart_editions WHERE id = v_ed1) <> 'published'
    OR (SELECT restored_from_publication_id FROM public.youtube_chart_publications
        WHERE id = v_result.publication_id) <> v_pub1 THEN
    RAISE EXCEPTION 'K7 restore failed';
  END IF;

  IF NOT public.create_youtube_chart_revision(v_ed1, v_user, 'programmer test')
    OR NOT public.schedule_youtube_chart_publication(
      v_ed1, clock_timestamp() + interval '1 day', 'America/Port-au-Prince', v_user
    )
    OR NOT public.cancel_youtube_chart_publication(v_ed1, v_user) THEN
    RAISE EXCEPTION 'K7 schedule/cancel failed';
  END IF;

  SELECT count(*) INTO v_count FROM public.youtube_chart_publications;
  SELECT * INTO v_result FROM public.publish_youtube_chart(
    v_ed1, '{"entries":[]}', '[]', 'test methodology', v_user, NULL
  );
  IF v_result.success OR (SELECT count(*) FROM public.youtube_chart_publications) <> v_count THEN
    RAISE EXCEPTION 'K7 invalid publication changed public state';
  END IF;

  IF has_function_privilege('anon', 'public.publish_youtube_chart(uuid,jsonb,jsonb,text,uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.publish_youtube_chart(uuid,jsonb,jsonb,text,uuid,uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.publish_youtube_chart(uuid,jsonb,jsonb,text,uuid,uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'K7 RPC permissions invalid';
  END IF;
END;
$$;

ROLLBACK;
\echo 'K7 publication tests passed'
