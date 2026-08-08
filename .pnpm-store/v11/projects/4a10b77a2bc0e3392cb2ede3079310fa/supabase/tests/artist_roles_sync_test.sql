DO $$
DECLARE
  v_type text;
  v_tags text[];
BEGIN
  INSERT INTO public.artists (
    name, slug, haitian_status, is_active, artist_type, tags
  ) VALUES (
    'Test Roles Sync',
    'test-roles-sync',
    'pending_review',
    false,
    'artist',
    ARRAY['Productrice', 'Chanteuse']
  );

  SELECT artist_type, tags
  INTO v_type, v_tags
  FROM public.artists
  WHERE slug = 'test-roles-sync';

  ASSERT v_type = 'producer', 'le rôle productrice doit alimenter la catégorie producer';
  ASSERT v_tags @> ARRAY['beatmaker', 'chanteur'], 'les variantes doivent être normalisées';

  UPDATE public.artists
  SET artist_type = 'group'
  WHERE slug = 'test-roles-sync';

  SELECT artist_type, tags
  INTO v_type, v_tags
  FROM public.artists
  WHERE slug = 'test-roles-sync';

  ASSERT v_type = 'group', 'la catégorie principale choisie doit être conservée';
  ASSERT 'groupe' = ANY(v_tags), 'la catégorie group doit ajouter le rôle groupe';

  DELETE FROM public.artists WHERE slug = 'test-roles-sync';
END;
$$;
