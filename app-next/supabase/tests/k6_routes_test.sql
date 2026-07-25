-- K6 v3 PostgreSQL Tests (local only)
-- Tests: RPCs atomiques, permissions, rollback, fencing

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== K6 PostgreSQL Tests START ==='; END $$;

-- Setup
INSERT INTO artists (id, name, slug) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Artiste Test K6', 'artiste-test-k6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tracks (id, title, normalized_title) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Chanson Test K6', 'chanson test k6'),
  ('10000000-0000-4000-8000-000000000002', 'Chanson Test K6 Bis', 'chanson test k6 bis')
ON CONFLICT (id) DO NOTHING;

INSERT INTO track_artists (track_id, artist_id, role) VALUES
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'primary')
ON CONFLICT DO NOTHING;

INSERT INTO youtube_channels (id, channel_id, channel_title, channel_type, is_active, status, is_youtube_verified) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'UCk6TestChannel0000000001', 'Test Channel K6', 'OFFICIAL_ARTIST_CHANNEL', true, 'active', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO youtube_videos (id, video_id, channel_id, source_title, published_at, review_status, is_eligible, video_type) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'K6TestVid001', 'UCk6TestChannel0000000001', 'Video Test K6', '2026-07-01T00:00:00Z', 'UNREVIEWED', false, 'UNKNOWN'),
  ('d0000000-0000-4000-8000-000000000002', 'K6TestVid002', 'UCk6TestChannel0000000001', 'Video Test K6 2', '2026-07-01T00:00:00Z', 'APPROVED', true, 'OFFICIAL_AUDIO')
ON CONFLICT (id) DO NOTHING;

-- Test 1: link_youtube_video_to_track success
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.link_youtube_video_to_track(
    'd0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'primary', true, NULL
  );
  ASSERT v_result.success = true, 'should succeed';
  ASSERT v_result.message = 'ok', 'message should be ok';
  PERFORM 1 FROM youtube_videos WHERE id = 'd0000000-0000-4000-8000-000000000001' AND track_id = '10000000-0000-4000-8000-000000000001';
  ASSERT FOUND, 'track_id should be updated';
  RAISE NOTICE 'TEST 1 PASS: link_youtube_video_to_track success';
END $$;

-- Test 2: track change removes ALL old associations
DO $$
DECLARE v_result RECORD; v_count integer;
BEGIN
  SELECT * INTO v_result FROM public.link_youtube_video_to_track(
    'd0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid,
    'primary', true, NULL
  );
  ASSERT v_result.success = true, 'track change should succeed';
  SELECT count(*) INTO v_count FROM youtube_track_assets
    WHERE youtube_video_id = 'd0000000-0000-4000-8000-000000000001' AND track_id = '10000000-0000-4000-8000-000000000001';
  ASSERT v_count = 0, 'old association should be deleted';
  PERFORM 1 FROM youtube_videos WHERE id = 'd0000000-0000-4000-8000-000000000001' AND track_id = '10000000-0000-4000-8000-000000000002';
  ASSERT FOUND, 'track_id should point to new track';
  RAISE NOTICE 'TEST 2 PASS: track change cleans old associations';
END $$;

-- Test 3: link - video not found
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.link_youtube_video_to_track('f0000000-0000-4000-8000-ffffffffffff'::uuid, '10000000-0000-4000-8000-000000000001'::uuid);
  ASSERT v_result.success = false AND v_result.message = 'video_not_found';
  RAISE NOTICE 'TEST 3 PASS: missing video rejected';
END $$;

-- Test 4: link - track not found
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.link_youtube_video_to_track('d0000000-0000-4000-8000-000000000001'::uuid, 'f0000000-0000-4000-8000-ffffffffffff'::uuid);
  ASSERT v_result.success = false AND v_result.message = 'track_not_found';
  RAISE NOTICE 'TEST 4 PASS: missing track rejected';
END $$;

-- Test 5: approve_youtube_video success
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.approve_youtube_video(
    'd0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'OFFICIAL_MUSIC_VIDEO',
    'Justification suffisante pour test.',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = true, 'approve should succeed';
  -- Verify all fields updated atomically
  PERFORM 1 FROM youtube_videos
    WHERE id = 'd0000000-0000-4000-8000-000000000001'
    AND review_status = 'APPROVED'
    AND video_type = 'OFFICIAL_MUSIC_VIDEO'
    AND is_eligible = true
    AND track_id = '10000000-0000-4000-8000-000000000001';
  ASSERT FOUND, 'all editorial fields should be updated';
  -- Verify association created
  PERFORM 1 FROM youtube_track_assets
    WHERE youtube_video_id = 'd0000000-0000-4000-8000-000000000001'
    AND track_id = '10000000-0000-4000-8000-000000000001';
  ASSERT FOUND, 'track asset should exist';
  RAISE NOTICE 'TEST 5 PASS: approve_youtube_video success';
END $$;

-- Test 6: approve - video not found
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.approve_youtube_video(
    'f0000000-0000-4000-8000-ffffffffffff'::uuid, '10000000-0000-4000-8000-000000000001'::uuid,
    'OFFICIAL_MUSIC_VIDEO', 'Justification suffisante.',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = false AND v_result.message = 'video_not_found';
  RAISE NOTICE 'TEST 6 PASS: approve video not found';
END $$;

-- Test 7: approve - track not found
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.approve_youtube_video(
    'd0000000-0000-4000-8000-000000000001'::uuid, 'f0000000-0000-4000-8000-ffffffffffff'::uuid,
    'OFFICIAL_MUSIC_VIDEO', 'Justification suffisante.',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = false AND v_result.message = 'track_not_found';
  RAISE NOTICE 'TEST 7 PASS: approve track not found';
END $$;

-- Test 8: approve - ineligible type (SHORT)
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.approve_youtube_video(
    'd0000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid,
    'SHORT', 'Justification suffisante.',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = false AND v_result.message = 'ineligible_video_type';
  RAISE NOTICE 'TEST 8 PASS: approve SHORT refused';
END $$;

-- Test 9: approve - review reason too short
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.approve_youtube_video(
    'd0000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid,
    'OFFICIAL_MUSIC_VIDEO', 'court',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = false AND v_result.message = 'review_reason_too_short';
  RAISE NOTICE 'TEST 9 PASS: approve reason too short';
END $$;

-- Test 10: update_youtube_video_editorial success
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.update_youtube_video_editorial(
    'd0000000-0000-4000-8000-000000000002'::uuid,
    'Titre editorial', '', 'APPROVED', 'OFFICIAL_AUDIO', true,
    '10000000-0000-4000-8000-000000000001'::uuid,
    '', 'Justification de mise a jour editoriale.',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = true, 'editorial update should succeed';
  PERFORM 1 FROM youtube_videos
    WHERE id = 'd0000000-0000-4000-8000-000000000002' AND display_title = 'Titre editorial';
  ASSERT FOUND, 'display_title should be updated';
  RAISE NOTICE 'TEST 10 PASS: update_youtube_video_editorial success';
END $$;

-- Test 11: update_youtube_video_editorial - video not found
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.update_youtube_video_editorial(
    'f0000000-0000-4000-8000-ffffffffffff'::uuid,
    'T', '', 'APPROVED', 'OFFICIAL_AUDIO', true, NULL, '', 'Raison suffisante.', NULL
  );
  ASSERT v_result.success = false AND v_result.message = 'video_not_found';
  RAISE NOTICE 'TEST 11 PASS: editorial update video not found';
END $$;

-- Test 12: same advisory lock key
DO $$
DECLARE v_key1 bigint; v_key2 bigint;
BEGIN
  v_key1 := hashtext('youtube_hmi_weekly_delta' || '::' || '2026-07-14::2026-07-21');
  v_key2 := hashtext('youtube_hmi_weekly_delta' || '::' || '2026-07-14::2026-07-21');
  ASSERT v_key1 = v_key2, 'advisory keys must be identical';
  RAISE NOTICE 'TEST 12 PASS: same advisory lock key';
END $$;

-- Test 13: acquire_recalculate_lease success
DO $$
DECLARE v_result RECORD;
BEGIN
  DELETE FROM youtube_sync_leases WHERE source_key = 'youtube_hmi_weekly_delta' AND period_key = '2026-07-14::2026-07-21';
  INSERT INTO chart_sources (id, platform, source_key, display_name, ingestion_mode, is_enabled)
  VALUES ('c5000000-0000-4000-8000-000000000001', 'youtube', 'youtube_hmi_weekly_delta', 'Test', 'OFFICIAL_API', true)
  ON CONFLICT (source_key) DO NOTHING;

  SELECT * INTO v_result FROM public.acquire_recalculate_lease(
    'youtube_hmi_weekly_delta', '2026-07-14::2026-07-21', 'owner-001', 60,
    (SELECT id FROM chart_sources WHERE source_key = 'youtube_hmi_weekly_delta' LIMIT 1)
  );
  ASSERT v_result.acquired = true AND v_result.run_id IS NOT NULL;
  RAISE NOTICE 'TEST 13 PASS: acquire_recalculate_lease success';
END $$;

-- Test 14: active lease blocks second acquisition
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.acquire_recalculate_lease(
    'youtube_hmi_weekly_delta', '2026-07-14::2026-07-21', 'owner-002', 60,
    (SELECT id FROM chart_sources WHERE source_key = 'youtube_hmi_weekly_delta' LIMIT 1)
  );
  ASSERT v_result.acquired = false;
  RAISE NOTICE 'TEST 14 PASS: active lease blocks concurrent acquisition';
END $$;

-- Test 15: fenced write refused after expiration
DO $$
DECLARE v_ok boolean; v_lease RECORD;
BEGIN
  SELECT * INTO v_lease FROM youtube_sync_leases
    WHERE source_key = 'youtube_hmi_weekly_delta' AND period_key = '2026-07-14::2026-07-21';
  UPDATE youtube_sync_leases SET acquired_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
    WHERE id = v_lease.id;
  SELECT public.fenced_update_sync_run(
    'youtube_hmi_weekly_delta', '2026-07-14::2026-07-21', 'owner-001', v_lease.sync_run_id,
    'COMPLETED', now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false
  ) INTO v_ok;
  ASSERT v_ok = false, 'fenced write should be refused after expiration';
  RAISE NOTICE 'TEST 15 PASS: fenced write refused after expiration';
END $$;

-- Test 16-18: Permissions with SET ROLE
DO $$
BEGIN
  SET ROLE anon;
  BEGIN
    PERFORM public.link_youtube_video_to_track(NULL, NULL);
    ASSERT false, 'anon should not execute link_youtube_video_to_track';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RESET ROLE;
  RAISE NOTICE 'TEST 16 PASS: anon denied for link_youtube_video_to_track';
END $$;

DO $$
BEGIN
  SET ROLE authenticated;
  BEGIN
    PERFORM public.approve_youtube_video(NULL, NULL, NULL, NULL, NULL);
    ASSERT false, 'authenticated should not execute approve_youtube_video';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RESET ROLE;
  RAISE NOTICE 'TEST 17 PASS: authenticated denied for approve_youtube_video';
END $$;

DO $$
BEGIN
  SET ROLE authenticated;
  BEGIN
    PERFORM public.update_youtube_video_editorial(NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
    ASSERT false, 'authenticated should not execute update_youtube_video_editorial';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RESET ROLE;
  RAISE NOTICE 'TEST 18 PASS: authenticated denied for update_youtube_video_editorial';
END $$;

-- Test 19: service_role executes a K6 RPC (not only privilege metadata)
DO $$
DECLARE v_result RECORD;
BEGIN
  SET ROLE service_role;
  SELECT * INTO v_result FROM public.link_youtube_video_to_track(NULL, NULL);
  ASSERT v_result.success = false AND v_result.message = 'missing_video_id';
  RESET ROLE;
  RAISE NOTICE 'TEST 19 PASS: service_role executed a K6 RPC';
END $$;

-- Test 20: unlink removes every asset and canonical track_id
DO $$
DECLARE v_result RECORD; v_assets integer;
BEGIN
  SELECT * INTO v_result FROM public.update_youtube_video_editorial(
    'd0000000-0000-4000-8000-000000000002'::uuid,
    'Titre exclu', '', 'EXCLUDED', 'SHORT', false, NULL,
    'Video exclue du classement.', 'Justification de mise a jour editoriale.',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = true;
  SELECT count(*) INTO v_assets FROM public.youtube_track_assets
    WHERE youtube_video_id = 'd0000000-0000-4000-8000-000000000002'::uuid;
  ASSERT v_assets = 0, 'unlink must delete every asset';
  PERFORM 1 FROM public.youtube_videos
    WHERE id = 'd0000000-0000-4000-8000-000000000002'::uuid AND track_id IS NULL;
  ASSERT FOUND, 'canonical track_id must be null';
  RAISE NOTICE 'TEST 20 PASS: unlink is coherent';
END $$;

-- Test 21: incoherent eligibility is rejected before mutation
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.update_youtube_video_editorial(
    'd0000000-0000-4000-8000-000000000002'::uuid,
    'Titre', '', 'APPROVED', 'SHORT', true,
    '10000000-0000-4000-8000-000000000001'::uuid,
    '', 'Justification suffisante.',
    'a0000000-0000-4000-8000-000000000001'::uuid
  );
  ASSERT v_result.success = false AND v_result.message = 'incoherent_eligibility';
  RAISE NOTICE 'TEST 21 PASS: incoherent eligibility rejected';
END $$;

-- Test 22: a failure after asset replacement rolls the whole approval back
CREATE OR REPLACE FUNCTION public.k6_force_approval_failure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.review_reason = 'K6_FORCE_ROLLBACK' THEN
    RAISE EXCEPTION 'forced approval failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER k6_force_approval_failure_trigger
BEFORE UPDATE ON public.youtube_videos
FOR EACH ROW EXECUTE FUNCTION public.k6_force_approval_failure();

DO $$
DECLARE v_assets integer;
BEGIN
  BEGIN
    PERFORM public.approve_youtube_video(
      'd0000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid,
      'OFFICIAL_MUSIC_VIDEO', 'K6_FORCE_ROLLBACK',
      'a0000000-0000-4000-8000-000000000001'::uuid
    );
    ASSERT false, 'forced failure expected';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'forced approval failure';
  END;

  SELECT count(*) INTO v_assets FROM public.youtube_track_assets
  WHERE youtube_video_id = 'd0000000-0000-4000-8000-000000000001'::uuid
    AND track_id = '10000000-0000-4000-8000-000000000001'::uuid;
  ASSERT v_assets = 1, 'original asset must survive rollback';
  PERFORM 1 FROM public.youtube_videos
  WHERE id = 'd0000000-0000-4000-8000-000000000001'::uuid
    AND track_id = '10000000-0000-4000-8000-000000000001'::uuid;
  ASSERT FOUND, 'canonical track must survive rollback';
  RAISE NOTICE 'TEST 22 PASS: forced failure rolled back every change';
END $$;

DROP TRIGGER k6_force_approval_failure_trigger ON public.youtube_videos;
DROP FUNCTION public.k6_force_approval_failure();

DO $$ BEGIN RAISE NOTICE '=== K6 PostgreSQL Tests COMPLETE - all passed ==='; END $$;

ROLLBACK;
