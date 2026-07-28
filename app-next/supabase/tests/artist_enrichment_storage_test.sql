DO $$
DECLARE
  v_public boolean;
  v_limit bigint;
  v_duplicate_blocked boolean := false;
BEGIN
  SELECT public, file_size_limit
  INTO v_public, v_limit
  FROM storage.buckets
  WHERE id = 'artist-media';

  ASSERT v_public = true, 'artist-media doit être public en lecture';
  ASSERT v_limit = 10485760, 'artist-media doit limiter les fichiers à 10 Mo';

  INSERT INTO public.artists (id, name, slug)
  VALUES ('e1000000-0000-4000-8000-000000000001', 'Collecte Test', 'collecte-test-storage')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.artist_platform_identities (
    artist_id, platform, external_id, external_url, metadata
  )
  VALUES (
    'e1000000-0000-4000-8000-000000000001',
    'spotify',
    'spotify-storage-test-1',
    'https://open.spotify.com/artist/1111111111111111111111',
    '{"images":[]}'::jsonb
  );

  BEGIN
    INSERT INTO public.artist_platform_identities (
      artist_id, platform, external_id, external_url, metadata
    )
    VALUES (
      'e1000000-0000-4000-8000-000000000001',
      'spotify',
      'spotify-storage-test-2',
      'https://open.spotify.com/artist/2222222222222222222222',
      '{"images":[]}'::jsonb
    );
  EXCEPTION WHEN unique_violation THEN
    v_duplicate_blocked := true;
  END;

  ASSERT v_duplicate_blocked, 'une deuxième identité artiste/plateforme doit être refusée';

  DELETE FROM public.artists
  WHERE id = 'e1000000-0000-4000-8000-000000000001';
END;
$$;
