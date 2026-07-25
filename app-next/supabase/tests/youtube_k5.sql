\set ON_ERROR_STOP on

BEGIN;

CREATE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'K5 assertion failed: %', message;
  END IF;
END;
$$;

INSERT INTO public.chart_sources (
  id, platform, source_key, display_name, ingestion_mode, is_enabled, is_automatic
) VALUES (
  '90000000-0000-0000-0000-000000000001',
  'youtube',
  'youtube_k5_test',
  'YouTube K5 Test',
  'OFFICIAL_API',
  true,
  true
);

INSERT INTO public.tracks (id, title, normalized_title)
VALUES ('90000000-0000-0000-0000-000000000010', 'K5 Track', 'k5 track');

INSERT INTO public.youtube_channels (
  id, channel_id, uploads_playlist_id, channel_title, channel_type,
  is_youtube_verified, status, is_active
) VALUES (
  '90000000-0000-0000-0000-000000000020',
  'UCK5TESTCHANNEL000000001',
  'UUK5TESTCHANNEL000000001',
  'K5 Test Channel',
  'OFFICIAL_ARTIST_CHANNEL',
  true,
  'active',
  true
);

INSERT INTO public.youtube_videos (
  id, video_id, channel_id, source_title, published_at, view_count,
  review_status, video_type, is_eligible, is_active
) VALUES
(
  '90000000-0000-0000-0000-000000000101',
  'K5Video0001',
  'UCK5TESTCHANNEL000000001',
  'K5 Video 1',
  '2098-01-01T00:00:00Z',
  0,
  'APPROVED',
  'OFFICIAL_MUSIC_VIDEO',
  true,
  true
),
(
  '90000000-0000-0000-0000-000000000102',
  'K5Video0002',
  'UCK5TESTCHANNEL000000001',
  'K5 Video 2',
  '2098-01-01T00:00:00Z',
  0,
  'APPROVED',
  'OFFICIAL_MUSIC_VIDEO',
  true,
  true
);

INSERT INTO public.youtube_track_assets (
  track_id, youtube_video_id, asset_role, priority, is_eligible, is_primary
) VALUES
(
  '90000000-0000-0000-0000-000000000010',
  '90000000-0000-0000-0000-000000000101',
  'primary', 1, true, true
),
(
  '90000000-0000-0000-0000-000000000010',
  '90000000-0000-0000-0000-000000000102',
  'primary', 2, true, false
);

CREATE TEMP TABLE k5_lease AS
SELECT *
FROM public.acquire_sync_lease(
  'youtube_k5_test',
  '2099-01-01::2099-01-08',
  'k5-owner',
  300,
  '90000000-0000-0000-0000-000000000001'
);

SELECT pg_temp.assert_true(
  (SELECT acquired FROM k5_lease),
  'lease fixture must be acquired'
);

-- 1. Valid fenced snapshot.
SELECT pg_temp.assert_true(
  (
    SELECT success AND inserted_count = 1
    FROM public.fenced_insert_youtube_snapshots(
      'youtube_k5_test',
      '2099-01-01::2099-01-08',
      'k5-owner',
      (SELECT run_id FROM k5_lease),
      jsonb_build_array(jsonb_build_object(
        'youtube_video_id', '90000000-0000-0000-0000-000000000101',
        'view_count', 100,
        'like_count', 10,
        'comment_count', 2,
        'availability_status', 'available',
        'source', 'youtube_data_api_v3',
        'observed_at', '2099-01-08T00:00:00Z'
      ))
    )
  ),
  'valid snapshot must be inserted'
);

-- 2. Same video/run is idempotent.
SELECT pg_temp.assert_true(
  (
    SELECT success AND inserted_count = 0 AND skipped_count = 1
    FROM public.fenced_insert_youtube_snapshots(
      'youtube_k5_test',
      '2099-01-01::2099-01-08',
      'k5-owner',
      (SELECT run_id FROM k5_lease),
      jsonb_build_array(jsonb_build_object(
        'youtube_video_id', '90000000-0000-0000-0000-000000000101',
        'view_count', 100,
        'like_count', 10,
        'comment_count', 2,
        'availability_status', 'available',
        'source', 'youtube_data_api_v3'
      ))
    )
  ),
  'duplicate snapshot must be skipped'
);

-- 3-4. Wrong owner and wrong run are fenced.
SELECT pg_temp.assert_true(
  NOT (
    SELECT success
    FROM public.fenced_insert_youtube_snapshots(
      'youtube_k5_test', '2099-01-01::2099-01-08', 'wrong-owner',
      (SELECT run_id FROM k5_lease), '[]'::jsonb
    )
  ),
  'wrong owner must be rejected'
);
SELECT pg_temp.assert_true(
  NOT (
    SELECT success
    FROM public.fenced_insert_youtube_snapshots(
      'youtube_k5_test', '2099-01-01::2099-01-08', 'k5-owner',
      '90000000-0000-0000-0000-000000000999', '[]'::jsonb
    )
  ),
  'wrong sync run must be rejected'
);

-- 5. The complete payload is validated before inserts.
DO $$
BEGIN
  BEGIN
    PERFORM *
    FROM public.fenced_insert_youtube_snapshots(
      'youtube_k5_test',
      '2099-01-01::2099-01-08',
      'k5-owner',
      (SELECT run_id FROM k5_lease),
      jsonb_build_array(
        jsonb_build_object(
          'youtube_video_id', '90000000-0000-0000-0000-000000000102',
          'view_count', 200, 'like_count', 20, 'comment_count', 4,
          'availability_status', 'available', 'source', 'youtube_data_api_v3'
        ),
        jsonb_build_object(
          'youtube_video_id', '90000000-0000-0000-0000-000000000101',
          'view_count', 100, 'like_count', 10, 'comment_count', -1,
          'availability_status', 'available', 'source', 'youtube_data_api_v3'
        )
      )
    );
    RAISE EXCEPTION 'expected invalid snapshot batch';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected invalid snapshot batch' THEN
      RAISE;
    END IF;
  END;
END;
$$;
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.youtube_metric_snapshots
    WHERE youtube_video_id = '90000000-0000-0000-0000-000000000102'
      AND sync_run_id = (SELECT run_id FROM k5_lease)
  ),
  'partially invalid batch must insert zero rows'
);

-- 6-8. Every counter rejects negative values.
DO $$
DECLARE
  field_name text;
  payload jsonb;
BEGIN
  FOREACH field_name IN ARRAY ARRAY['view_count', 'like_count', 'comment_count']
  LOOP
    payload := jsonb_build_object(
      'youtube_video_id', '90000000-0000-0000-0000-000000000102',
      'view_count', 1, 'like_count', 1, 'comment_count', 1,
      'availability_status', 'available', 'source', 'youtube_data_api_v3'
    ) || jsonb_build_object(field_name, -1);
    BEGIN
      PERFORM *
      FROM public.fenced_insert_youtube_snapshots(
        'youtube_k5_test', '2099-01-01::2099-01-08', 'k5-owner',
        (SELECT run_id FROM k5_lease), jsonb_build_array(payload)
      );
      RAISE EXCEPTION 'expected negative counter rejection';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM = 'expected negative counter rejection' THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;

-- Historical fixtures for boundary and availability selection.
INSERT INTO public.sync_runs (id, chart_source_id, status) VALUES
('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000001', 'COMPLETED'),
('90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000001', 'COMPLETED'),
('90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0000-000000000001', 'COMPLETED');

INSERT INTO public.youtube_metric_snapshots (
  youtube_video_id, sync_run_id, view_count, like_count, comment_count,
  availability_status, source, observed_at
) VALUES
('90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000201', 50, 5, 1, 'available', 'test', '2098-12-01T00:00:00Z'),
('90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000202', 50, 5, 1, 'unavailable', 'test', '2098-12-15T00:00:00Z'),
('90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000203', 100, 10, 2, 'available', 'test', '2099-02-01T00:00:00Z');

-- 9-11. Latest generic, latest reliable, and future exclusion.
SELECT pg_temp.assert_true(
  (
    SELECT availability_status = 'unavailable' AND view_count = 50
    FROM public.get_latest_snapshots_before(
      ARRAY['90000000-0000-0000-0000-000000000102'::uuid],
      '2099-01-01T00:00:00Z'
    )
  ),
  'generic boundary query must return latest unavailable snapshot'
);
SELECT pg_temp.assert_true(
  (
    SELECT availability_status = 'available'
      AND view_count = 50
      AND observed_at = '2098-12-01T00:00:00Z'
    FROM public.get_latest_available_snapshots_before(
      ARRAY['90000000-0000-0000-0000-000000000102'::uuid],
      '2099-01-01T00:00:00Z'
    )
  ),
  'available query must skip consecutive unavailable snapshots'
);
SELECT pg_temp.assert_true(
  (
    SELECT view_count = 50
    FROM public.get_latest_available_snapshots_before(
      ARRAY['90000000-0000-0000-0000-000000000102'::uuid],
      '2099-01-08T00:00:00Z'
    )
  ),
  'future snapshot must be ignored'
);

-- 12. Valid draft persists preview data.
SELECT pg_temp.assert_true(
  (
    SELECT success
    FROM public.fenced_upsert_youtube_draft(
      'youtube_k5_test',
      '2099-01-01::2099-01-08',
      'k5-owner',
      (SELECT run_id FROM k5_lease),
      '90000000-0000-0000-0000-000000000001',
      '2099-01-01T00:00:00Z',
      '2099-01-08T00:00:00Z',
      jsonb_build_array(jsonb_build_object(
        'track_id', '90000000-0000-0000-0000-000000000010',
        'metric_value', 100,
        'delta_views', 100,
        'delta_likes', 10,
        'delta_comments', 2,
        'total_views', 1000,
        'eligible_video_count', 2,
        'raw_artist_text', 'K5 Artist',
        'raw_track_title', 'K5 Track'
      )),
      'draft',
      NULL
    )
  ),
  'valid draft must be written'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.chart_entries AS ce
    JOIN public.chart_editions AS ed ON ed.id = ce.chart_edition_id
    WHERE ed.chart_source_id = '90000000-0000-0000-0000-000000000001'
      AND ce.total_views = 1000
      AND ce.eligible_video_count = 2
  ),
  'draft preview values must be persisted'
);

-- 13. Invalid replacement leaves the previous draft intact.
SELECT pg_temp.assert_true(
  NOT (
    SELECT success
    FROM public.fenced_upsert_youtube_draft(
      'youtube_k5_test',
      '2099-01-01::2099-01-08',
      'k5-owner',
      (SELECT run_id FROM k5_lease),
      '90000000-0000-0000-0000-000000000001',
      '2099-01-01T00:00:00Z',
      '2099-01-08T00:00:00Z',
      jsonb_build_array(jsonb_build_object(
        'track_id', '90000000-0000-0000-0000-000000000010',
        'metric_value', 100,
        'delta_views', 100,
        'delta_likes', -1,
        'delta_comments', 2,
        'total_views', 1000,
        'eligible_video_count', 2
      )),
      'draft',
      NULL
    )
  ),
  'invalid draft must be rejected'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.chart_entries
    WHERE total_views = 1000 AND eligible_video_count = 2
  ),
  'previous draft must survive invalid replacement'
);

-- 14. Published edition is immutable through the draft RPC.
UPDATE public.chart_editions
SET status = 'published'
WHERE chart_source_id = '90000000-0000-0000-0000-000000000001'
  AND period_start = '2099-01-01T00:00:00Z'
  AND period_end = '2099-01-08T00:00:00Z';
SELECT pg_temp.assert_true(
  (
    SELECT NOT success AND message = 'edition_published'
    FROM public.fenced_upsert_youtube_draft(
      'youtube_k5_test', '2099-01-01::2099-01-08', 'k5-owner',
      (SELECT run_id FROM k5_lease),
      '90000000-0000-0000-0000-000000000001',
      '2099-01-01T00:00:00Z', '2099-01-08T00:00:00Z',
      '[]'::jsonb, 'draft', NULL
    )
  ),
  'published edition must be rejected'
);
UPDATE public.chart_editions
SET status = 'draft'
WHERE chart_source_id = '90000000-0000-0000-0000-000000000001';

-- 15-17. Weekly period validation.
SELECT pg_temp.assert_true(
  (
    SELECT message = 'invalid_period'
    FROM public.fenced_upsert_youtube_draft(
      'youtube_k5_test', '2099-01-01::2099-01-07', 'k5-owner',
      (SELECT run_id FROM k5_lease),
      '90000000-0000-0000-0000-000000000001',
      '2099-01-01T00:00:00Z', '2099-01-07T00:00:00Z',
      '[]'::jsonb, 'draft', NULL
    )
  ),
  'six-day period must be rejected'
);
SELECT pg_temp.assert_true(
  (
    SELECT message = 'invalid_period'
    FROM public.fenced_upsert_youtube_draft(
      'youtube_k5_test', '2099-01-01::2099-01-09', 'k5-owner',
      (SELECT run_id FROM k5_lease),
      '90000000-0000-0000-0000-000000000001',
      '2099-01-01T00:00:00Z', '2099-01-09T00:00:00Z',
      '[]'::jsonb, 'draft', NULL
    )
  ),
  'eight-day period must be rejected'
);
SELECT pg_temp.assert_true(
  (
    SELECT message = 'invalid_period'
    FROM public.fenced_upsert_youtube_draft(
      'youtube_k5_test', '2099-01-08::2099-01-01', 'k5-owner',
      (SELECT run_id FROM k5_lease),
      '90000000-0000-0000-0000-000000000001',
      '2099-01-08T00:00:00Z', '2099-01-01T00:00:00Z',
      '[]'::jsonb, 'draft', NULL
    )
  ),
  'reversed period must be rejected'
);

-- 18-19. Expired and released leases.
UPDATE public.youtube_sync_leases
SET acquired_at = clock_timestamp() - interval '2 hours',
    expires_at = clock_timestamp() - interval '1 hour'
WHERE source_key = 'youtube_k5_test'
  AND period_key = '2099-01-01::2099-01-08';
SELECT pg_temp.assert_true(
  NOT (
    SELECT success FROM public.fenced_insert_youtube_snapshots(
      'youtube_k5_test', '2099-01-01::2099-01-08', 'k5-owner',
      (SELECT run_id FROM k5_lease), '[]'::jsonb
    )
  ),
  'expired lease must be rejected'
);
UPDATE public.youtube_sync_leases
SET acquired_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '5 minutes',
    released_at = clock_timestamp()
WHERE source_key = 'youtube_k5_test'
  AND period_key = '2099-01-01::2099-01-08';
SELECT pg_temp.assert_true(
  NOT (
    SELECT success FROM public.fenced_insert_youtube_snapshots(
      'youtube_k5_test', '2099-01-01::2099-01-08', 'k5-owner',
      (SELECT run_id FROM k5_lease), '[]'::jsonb
    )
  ),
  'released lease must be rejected'
);

-- 20. Function privileges.
SELECT pg_temp.assert_true(
  (
    SELECT bool_and(
      NOT has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
    )
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_latest_snapshots_before',
        'get_latest_available_snapshots_before',
        'fenced_insert_youtube_snapshots',
        'fenced_upsert_youtube_draft'
      )
  ),
  'K5 function privileges must be service_role only'
);

SELECT 'K5 PostgreSQL scenarios passed: 20' AS result;
ROLLBACK;
