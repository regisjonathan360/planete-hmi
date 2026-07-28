-- Tests PostgreSQL : producteurs et photos de profil de secours (local only)
-- Couvre artist_fallback_image, backfill_artist_images, link_artist_production.

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Producers / Avatars Tests START ==='; END $$;

-- ---------- Setup ----------
INSERT INTO artists (id, name, slug, image_url) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Artiste Sans Photo', 'artiste-sans-photo-t1', NULL),
  ('b0000000-0000-4000-8000-000000000002', 'Artiste Photo Vide', 'artiste-photo-vide-t1', ''),
  ('b0000000-0000-4000-8000-000000000003', 'Artiste Avec Photo', 'artiste-avec-photo-t1', 'https://img/own.jpg'),
  ('b0000000-0000-4000-8000-000000000004', 'Artiste Isole', 'artiste-isole-t1', NULL),
  ('b0000000-0000-4000-8000-000000000005', 'Beatmaker Test', 'beatmaker-test-t1', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tracks (id, title, normalized_title) VALUES
  ('20000000-0000-4000-8000-000000000001', 'Chanson Prod Test', 'chanson prod test')
ON CONFLICT (id) DO NOTHING;

-- Artiste 1 : Spotify non vérifié + Audiomack vérifié → le vérifié gagne.
INSERT INTO artist_platform_identities (artist_id, platform, external_id, platform_image_url, is_verified, last_seen_at) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'spotify', 'sp-test-0001', 'https://img/spotify.jpg', false, '2026-07-20T00:00:00Z'),
  ('b0000000-0000-4000-8000-000000000001', 'audiomack', 'am-test-0001', 'https://img/audiomack.jpg', true, '2026-06-01T00:00:00Z')
ON CONFLICT (platform, external_id) DO NOTHING;

-- Artiste 2 : deux identités non vérifiées → l'ordre de plateforme tranche.
INSERT INTO artist_platform_identities (artist_id, platform, external_id, platform_image_url, is_verified, last_seen_at) VALUES
  ('b0000000-0000-4000-8000-000000000002', 'tiktok', 'tk-test-0002', 'https://img/tiktok.jpg', false, '2026-07-20T00:00:00Z'),
  ('b0000000-0000-4000-8000-000000000002', 'deezer', 'dz-test-0002', 'https://img/deezer.jpg', false, '2026-01-01T00:00:00Z')
ON CONFLICT (platform, external_id) DO NOTHING;

-- Artiste 5 : aucune identité, mais une chaîne YouTube active.
INSERT INTO youtube_channels (id, channel_id, channel_title, channel_type, is_active, status, is_youtube_verified, artist_id, thumbnail_url) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'UCProducersTest000000001', 'Beatmaker Channel', 'OFFICIAL_ARTIST_CHANNEL', true, 'active', true,
   'b0000000-0000-4000-8000-000000000005', 'https://img/yt.jpg')
ON CONFLICT (id) DO NOTHING;

-- Test 1 : une identité vérifiée passe devant une plateforme mieux classée.
DO $$
DECLARE v_image text;
BEGIN
  v_image := public.artist_fallback_image('b0000000-0000-4000-8000-000000000001');
  ASSERT v_image = 'https://img/audiomack.jpg',
    format('identité vérifiée attendue, obtenu %s', COALESCE(v_image, 'NULL'));
  RAISE NOTICE 'TEST 1 PASS: identité vérifiée prioritaire';
END $$;

-- Test 2 : à vérification égale, l'ordre de plateforme tranche.
DO $$
DECLARE v_image text;
BEGIN
  v_image := public.artist_fallback_image('b0000000-0000-4000-8000-000000000002');
  ASSERT v_image = 'https://img/deezer.jpg',
    format('deezer attendu avant tiktok, obtenu %s', COALESCE(v_image, 'NULL'));
  RAISE NOTICE 'TEST 2 PASS: ordre des plateformes respecté';
END $$;

-- Test 3 : miniature de chaîne YouTube en dernier recours.
DO $$
DECLARE v_image text;
BEGIN
  v_image := public.artist_fallback_image('b0000000-0000-4000-8000-000000000005');
  ASSERT v_image = 'https://img/yt.jpg',
    format('miniature YouTube attendue, obtenu %s', COALESCE(v_image, 'NULL'));
  RAISE NOTICE 'TEST 3 PASS: repli sur la chaîne YouTube';
END $$;

-- Test 4 : aucun candidat → NULL.
DO $$
BEGIN
  ASSERT public.artist_fallback_image('b0000000-0000-4000-8000-000000000004') IS NULL,
    'aucun candidat doit renvoyer NULL';
  RAISE NOTICE 'TEST 4 PASS: absence de candidat';
END $$;

-- Test 5 : le backfill remplit les fiches vides sans toucher aux autres.
DO $$
DECLARE v_result RECORD; v_own text;
BEGIN
  SELECT * INTO v_result FROM public.backfill_artist_images(5000);
  ASSERT v_result.updated_count >= 3,
    format('au moins 3 fiches attendues, obtenu %s', v_result.updated_count);

  PERFORM 1 FROM artists
    WHERE id = 'b0000000-0000-4000-8000-000000000001'
      AND image_url = 'https://img/audiomack.jpg';
  ASSERT FOUND, 'artiste 1 doit recevoir la photo Audiomack';

  PERFORM 1 FROM artists
    WHERE id = 'b0000000-0000-4000-8000-000000000002'
      AND image_url = 'https://img/deezer.jpg';
  ASSERT FOUND, 'la chaîne vide compte comme photo manquante';

  SELECT image_url INTO v_own FROM artists WHERE id = 'b0000000-0000-4000-8000-000000000003';
  ASSERT v_own = 'https://img/own.jpg', 'une photo existante ne doit jamais être écrasée';

  PERFORM 1 FROM artists WHERE id = 'b0000000-0000-4000-8000-000000000004' AND image_url IS NULL;
  ASSERT FOUND, 'un artiste sans plateforme reste sans photo';

  RAISE NOTICE 'TEST 5 PASS: backfill_artist_images';
END $$;

-- Test 6 : second passage idempotent, plus rien à compléter.
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.backfill_artist_images(5000);
  ASSERT v_result.updated_count = 0,
    format('second passage doit être neutre, obtenu %s', v_result.updated_count);
  RAISE NOTICE 'TEST 6 PASS: backfill idempotent';
END $$;

-- Test 7 : link_artist_production crée le crédit et le miroir track_artists.
DO $$
DECLARE v_result RECORD; v_count integer;
BEGIN
  SELECT * INTO v_result FROM public.link_artist_production(
    'b0000000-0000-4000-8000-000000000005'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'beatmaker', 'title_credit', '(Prod. Beatmaker Test)', 0.85, false, NULL
  );
  ASSERT v_result.success = true, 'le rattachement doit réussir';
  ASSERT v_result.production_id IS NOT NULL, 'un identifiant doit être renvoyé';

  SELECT count(*) INTO v_count FROM track_artists
    WHERE track_id = '20000000-0000-4000-8000-000000000001'
      AND artist_id = 'b0000000-0000-4000-8000-000000000005'
      AND role = 'producer';
  ASSERT v_count = 1, 'le crédit doit être reflété dans track_artists';

  RAISE NOTICE 'TEST 7 PASS: link_artist_production';
END $$;

-- Test 8 : un second appel met à jour sans dupliquer, la confiance ne baisse pas.
DO $$
DECLARE v_result RECORD; v_count integer; v_confidence numeric;
BEGIN
  SELECT * INTO v_result FROM public.link_artist_production(
    'b0000000-0000-4000-8000-000000000005'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'beatmaker', 'title_credit', NULL, 0.40, false, NULL
  );
  ASSERT v_result.success = true, 'le second appel doit réussir';

  SELECT count(*), max(confidence) INTO v_count, v_confidence
  FROM artist_productions
  WHERE producer_id = 'b0000000-0000-4000-8000-000000000005'
    AND track_id = '20000000-0000-4000-8000-000000000001';

  ASSERT v_count = 1, 'aucun doublon ne doit apparaître';
  ASSERT v_confidence = 0.85, format('la confiance ne doit pas baisser, obtenu %s', v_confidence);
  RAISE NOTICE 'TEST 8 PASS: upsert idempotent et confiance monotone';
END $$;

-- Test 9 : un crédit vérifié conserve son origine malgré une collecte.
DO $$
DECLARE v_source text;
BEGIN
  UPDATE artist_productions
  SET is_verified = true, credit_source = 'manual_admin'
  WHERE producer_id = 'b0000000-0000-4000-8000-000000000005'
    AND track_id = '20000000-0000-4000-8000-000000000001';

  PERFORM public.link_artist_production(
    'b0000000-0000-4000-8000-000000000005'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'beatmaker', 'title_credit', NULL, 0.90, false, NULL
  );

  SELECT credit_source INTO v_source FROM artist_productions
  WHERE producer_id = 'b0000000-0000-4000-8000-000000000005'
    AND track_id = '20000000-0000-4000-8000-000000000001';

  ASSERT v_source = 'manual_admin',
    format('un crédit vérifié ne doit pas être rétrogradé, obtenu %s', v_source);
  RAISE NOTICE 'TEST 9 PASS: crédit vérifié protégé';
END $$;

-- Test 10 : rôle invalide et références inexistantes sont refusés proprement.
DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.link_artist_production(
    'b0000000-0000-4000-8000-000000000005'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'mixeur', 'title_credit', NULL, 1, false, NULL
  );
  ASSERT v_result.success = false AND v_result.message = 'invalid_role', 'rôle invalide refusé';

  SELECT * INTO v_result FROM public.link_artist_production(
    '00000000-0000-4000-8000-0000000000ff'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'producer', 'title_credit', NULL, 1, false, NULL
  );
  ASSERT v_result.success = false AND v_result.message = 'producer_not_found', 'producteur inconnu refusé';

  SELECT * INTO v_result FROM public.link_artist_production(
    'b0000000-0000-4000-8000-000000000005'::uuid,
    '00000000-0000-4000-8000-0000000000ff'::uuid,
    'producer', 'title_credit', NULL, 1, false, NULL
  );
  ASSERT v_result.success = false AND v_result.message = 'track_not_found', 'chanson inconnue refusée';

  RAISE NOTICE 'TEST 10 PASS: validations de link_artist_production';
END $$;

-- Test 11 : la confiance reste bornée à [0, 1].
DO $$
DECLARE v_confidence numeric;
BEGIN
  INSERT INTO artists (id, name, slug) VALUES
    ('b0000000-0000-4000-8000-000000000006', 'Producteur Borne', 'producteur-borne-t1')
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.link_artist_production(
    'b0000000-0000-4000-8000-000000000006'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'producer', 'title_credit', NULL, 4.2, false, NULL
  );

  SELECT confidence INTO v_confidence FROM artist_productions
  WHERE producer_id = 'b0000000-0000-4000-8000-000000000006';

  ASSERT v_confidence = 1.00, format('confiance bornée à 1 attendue, obtenu %s', v_confidence);
  RAISE NOTICE 'TEST 11 PASS: confiance bornée';
END $$;

-- Test 12 : lecture publique des productions, écriture refusée pour anon.
DO $$
DECLARE v_count integer; v_denied boolean := false;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM artist_productions;
  ASSERT v_count >= 1, 'anon doit pouvoir lire les productions';

  BEGIN
    INSERT INTO artist_productions (producer_id, track_id)
    VALUES ('b0000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN insufficient_privilege OR others THEN
    v_denied := true;
  END;

  RESET ROLE;
  ASSERT v_denied, 'anon ne doit pas pouvoir écrire dans artist_productions';
  RAISE NOTICE 'TEST 12 PASS: RLS artist_productions';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Producers / Avatars Tests DONE ==='; END $$;

ROLLBACK;
