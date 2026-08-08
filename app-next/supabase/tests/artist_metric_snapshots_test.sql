DO $$
DECLARE
  v_constraint_blocked boolean := false;
  v_duplicate_blocked boolean := false;
BEGIN
  ASSERT (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.artist_metric_snapshots'::regclass
  ), 'artist_metric_snapshots doit avoir RLS activé';

  ASSERT NOT has_table_privilege('anon', 'public.artist_metric_snapshots', 'SELECT'),
    'anon ne doit pas lire les indicateurs privés';
  ASSERT NOT has_table_privilege('authenticated', 'public.artist_metric_snapshots', 'SELECT'),
    'authenticated ne doit pas lire directement les indicateurs';
  ASSERT has_table_privilege('service_role', 'public.artist_metric_snapshots', 'SELECT'),
    'service_role doit pouvoir lire les indicateurs';
  ASSERT has_table_privilege('service_role', 'public.artist_metric_snapshots', 'INSERT'),
    'service_role doit pouvoir ajouter un relevé';
  ASSERT NOT has_table_privilege('service_role', 'public.artist_metric_snapshots', 'UPDATE'),
    'les relevés doivent être immuables pour service_role';
  ASSERT NOT has_table_privilege('service_role', 'public.artist_metric_snapshots', 'DELETE'),
    'les relevés doivent être indélébiles pour service_role';

  INSERT INTO public.artists (id, name, slug)
  VALUES (
    'e2000000-0000-4000-8000-000000000001',
    'Indicateurs Test',
    'indicateurs-test'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.artist_metric_snapshots (
    artist_id,
    platform,
    source_field,
    collected_at,
    followers,
    total_views
  )
  VALUES (
    'e2000000-0000-4000-8000-000000000001',
    'youtube',
    'url_youtube',
    '2026-07-28T12:00:00Z',
    100,
    1000
  );

  BEGIN
    INSERT INTO public.artist_metric_snapshots (
      artist_id,
      platform,
      source_field,
      collected_at
    )
    VALUES (
      'e2000000-0000-4000-8000-000000000001',
      'spotify',
      'url_spotify',
      '2026-07-28T12:00:00Z'
    );
  EXCEPTION WHEN check_violation THEN
    v_constraint_blocked := true;
  END;
  ASSERT v_constraint_blocked, 'un relevé sans indicateur doit être refusé';

  BEGIN
    INSERT INTO public.artist_metric_snapshots (
      artist_id,
      platform,
      source_field,
      collected_at,
      followers
    )
    VALUES (
      'e2000000-0000-4000-8000-000000000001',
      'youtube',
      'url_youtube',
      '2026-07-28T12:00:00Z',
      200
    );
  EXCEPTION WHEN unique_violation THEN
    v_duplicate_blocked := true;
  END;
  ASSERT v_duplicate_blocked, 'un même relevé plateforme/date doit être unique';

  DELETE FROM public.artists
  WHERE id = 'e2000000-0000-4000-8000-000000000001';
END;
$$;
