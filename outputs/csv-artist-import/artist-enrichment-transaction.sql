BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC2ZYc_PUslueVEtmCQGGs0w'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/6442QvtHrjHcAiaBCi5VhP'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/fr/artist/509/509752566'),
    tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '50929995-48db-45cb-aacf-70093343a421'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCf1Q6N0zgytyNQI93mffMSA'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/5soBVwhSyJeROoyNhL5MXi'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/fr/artist/5lan/521008936'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/5lan'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/1915881'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@sase5lan'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/dj5etwal'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '87efb1dc-9d96-4a0e-8000-f38e6f2c47c6'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCl-BLAhWn_65j-olWcqqXgw'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/2dIqqZbIp2fDKfPJa5zXyg'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/fr/artist/accolade-de-new-york/369201513'),
    tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'a488a5a6-0c9c-4840-a44f-519611d23884'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC4HrV9DrVwRmrfRdMNqpBQg'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/1tNzo7FgikOLSyk1xf3cR2'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/ci/artist/alan-cav%C3%A9/146005756'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/368263'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/alancave'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'bd672361-ab4e-4ee1-9911-e8903d5e6783'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCAN-r5bFJfzcrabDcj0NWuA'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/1v6UMf3x5nYEsgsOmjITkH'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/us/artist/amos-coulanges/384256183'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/amoscoulanges_'),
    tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Musicien']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '01c593fd-49c9-42ac-a81c-1416ec1eb121'::uuid;

UPDATE public.artists
  SET url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/4lUf2dcjE9GvdOnf6LEMjp'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/4999518'),
    bio = coalesce(nullif(btrim(bio), ''), 'Trompettiste et Improvisateur'),
    tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Musicien']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'f4278217-97b9-4ea4-852e-03b9693a5977'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@aniealerteofficial'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/2Qw1eM052uiH5CrtKgfcvf'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/us/artist/anie-alerte/1439939812'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/anie-alerte'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '78758699-0da8-4f92-9b25-e22483e965d2'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@arlylarivierenulook3418/videos'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/3GHVlKRurzupQYaoB5x9uB'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/fr/artist/arly-larivi%C3%A8re/434603279'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/2725861'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '454f2909-ce54-466e-8c36-f3cc24782429'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC-yu78hXVo7RfpJwS6Ls12g'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/4QGsZxK8k6DOsdbPeMc7k8'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/us/artist/astro-haiti/1537130966'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/astro-haiti'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/106430352'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@astrohaiti'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/astrohaiti'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'cf8bf102-8911-4cba-87d0-3f0ff8d143dc'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/bakypopileofficial'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/3bIpszMh2QVDRLw1knzG5h'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/us/artist/baky/438475674'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/en/artist/6423222'),
    url_soundcloud = coalesce(nullif(btrim(url_soundcloud), ''), 'https://soundcloud.com/paj-pam-tv-show'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@realbaky.popile'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/bakypopile'),
    updated_at = now()
  WHERE id = 'aa000000-0000-0000-0000-000000000005'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCHMCkZ2mAMhX072UDPjaWDA'),
    updated_at = now()
  WHERE id = '2bd10558-ea44-4c11-bc82-75b96efd8da2'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '9e8b71d0-7f35-4b9a-b9ef-1ebfdfd087b6'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'dfcb1a70-4ed7-47e3-b9b9-2c758a9228f0'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@BICtizondife'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '201ffe69-e90c-4ceb-8fae-9f7d30c934b6'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '9c3273b9-e0f7-4c5a-9ff6-7f63897d3f71'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '1c9dcd67-4783-4a3f-9f8d-747cef5b0d71'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '7b812662-eb98-416c-bd92-87632c0c7271'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCDN56D-Eq9VZ8jRchYFnkjg'),
    updated_at = now()
  WHERE id = 'd313316b-b6b4-4f5d-a6e1-d96f2e2982a7'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '06dcb9e1-fcf8-4dc1-9664-c1214e51e217'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '6d4b55d4-ecf3-4eb9-92c0-d6a6a587229d'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC9QCQ3hZs02WOnjMl7bBBjA'),
    updated_at = now()
  WHERE id = '6ed06702-f321-4223-94c6-f9ea81f8ab67'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '92b9ee21-5339-4c82-8013-8c21e7573f99'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'b3acf61b-859b-4bd8-9040-7f5124919b95'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@DELLYBenson'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'c5cff213-cc4b-4c62-b426-caa3f17a4797'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCnhHilULSY5LcKCldkBYuUQ'),
    updated_at = now()
  WHERE id = '798763b3-4319-440d-ad6d-cd91e438afe5'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'f9f97a91-a261-4eb5-bb34-e60fc6193483'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCMGV9JguVMq0gCeMcA6ILtQ'),
    tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '43521789-f664-421d-b002-a6d74b279718'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@DjBulletHaiti'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'b0d96043-a68e-4919-be16-178c45c5769b'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCJ8Wj89EmLYYdqbZrhERrWQ'),
    tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '919d1b20-9d14-4138-bfbf-c5719576c008'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'd5ae1205-edc5-45ba-8705-0d18e08f8d70'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'ab8ed840-8c78-4d04-8193-aedbdc248cee'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@fantom-oficiel-channel'),
    updated_at = now()
  WHERE id = '75f0d5cd-e788-4290-b9e5-41082e1ce083'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC_Bp7PdHcujGqoGd6y-V20Q'),
    updated_at = now()
  WHERE id = '89c532ae-8cee-4b71-9fbc-0f1702150af6'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '87aa9718-e591-4c7f-a34d-ef48dd977704'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '571ce9a8-9512-4ec2-bed3-e0066461f50e'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'c645f2e7-0fb9-4184-a543-2476df8795c4'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCNOuZU9J7WJobrZ83kyrAxA'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '57ef5b85-5bda-4d8a-8b17-f07ab8018864'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '521a48ba-9e4f-463f-99cf-2a56a019cec3'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '4305574c-d2b4-4edb-b93f-f49e30ee8b65'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'e8a562e3-562c-4570-8d2f-9d593e4db551'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['groupe', 'Groupe']::text[]) AS tag
    ),
    updated_at = now()
  WHERE id = 'f51ff425-8e91-4ee2-aba8-9ad31ad85e71'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'ba0e85a3-60c4-4457-8f22-7ff640326686'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@officialjperry'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'ad819e26-46ec-4a83-ac4d-ae743f1031f8'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'ee0fd680-223e-4439-9bb4-10fcaaa71d75'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '40979cea-c93d-4438-bd48-5048d396d9e2'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '61cdf676-2cfb-4662-9c6f-add5d743f4ce'::uuid;

UPDATE public.artists
  SET bio = coalesce(nullif(btrim(bio), ''), 'Le compositeur, parolier, conteur et dramaturge haïtien'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'a95cc92f-a24f-4dbd-a0e7-079d7c2c6990'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC7n1N9L_9RKpJQLGhGVWPlg'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/26zgIfFyTCImkHAp5gwKW8'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/fr/artist/jo%C3%A9-dw%C3%A8t-fil%C3%A9/1059364184'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/joe-dwet-file'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@joedwetfile'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/joedwetfile'),
    updated_at = now()
  WHERE id = 'aa000000-0000-0000-0000-000000000001'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UChjUd3NTEnc3MzqckoRZ51A'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '9fe76b72-136c-4947-a1c9-4fc096b54841'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@KAIMIZIK'),
    updated_at = now()
  WHERE id = '5eee5a03-0f80-4dec-ac2d-8491aa736e8f'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC4SdUIL2PSBbif2FFEOLNQQ'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/5zGYbzmbV51p2Zc4F4g1vZ'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/cm/artist/kenny-desmangles/278319838'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/4075336'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/kennydesmanglesofficial'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '0b5a8fc7-20d7-492f-aa3c-9fd19285828d'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCGX5ZjXJidhFuh_eLhniOjA'),
    updated_at = now()
  WHERE id = 'fb24c8e0-726c-495e-8844-a75ac25c4ae7'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCIFhkVjbTDibAeZGII5JgqQ'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/0TF33HmxeRHaOyEAqnuehy'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/ci/artist/kidnelyrz/1737059726'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/kidnely_rz'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/259036192'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@thekidnely_rz'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/kidnelyrz'),
    updated_at = now()
  WHERE id = '56ee4ec8-3b9c-4d33-9820-6b1f3e0b3eb3'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'e31af2bf-b27e-40b9-9411-afbb269ff09b'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@kingstreettetkale'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'ac38c07a-3b93-4e85-bfc2-6a3aca8f965c'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'cc2cf601-06ec-4ab2-aec0-8896f1455bb5'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '1b5e5d11-b3d7-4cfc-b918-121e8250686b'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['chanteur', 'auteur_compositeur', 'Groupe']::text[]) AS tag
    ),
    updated_at = now()
  WHERE id = 'd66d2d86-3408-4a05-becc-705401df9af4'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '9020626e-adf2-41af-bde8-efc9030ac251'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@l-wonhaiti'),
    updated_at = now()
  WHERE id = '28e5ad2c-d3ee-42d1-bdca-baab7b20f821'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '2b1a5706-b4da-4e96-baff-65f80543db77'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '60ff12e9-0cda-4a34-a023-44e303577541'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCG-tgj3H3sqflu83l_5NR9Q'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/31Xfnn2aa7WHVFZYJ3Ibcm'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/ci/artist/mebel-brun/1603191241'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/mebelbrun'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/156267012'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@mebel.brun'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/mebelbrun'),
    updated_at = now()
  WHERE id = '15387c59-0a20-43f1-8d3e-f41ebfd905d7'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCMvZ4lsFM9kLYciwiB1Xq-w'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'aa000000-0000-0000-0000-000000000006'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Musicien']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'bfc035d7-4e6e-43b8-9cb7-4601313c1528'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCDRcUzs1Kko7kaGBvWaLqRQ'),
    updated_at = now()
  WHERE id = '9ce50f8d-cfb3-474c-9874-2846a27be249'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@oklotruemusic'),
    updated_at = now()
  WHERE id = '50fe5d2c-ddc8-4e81-b02e-fec1fa60b21d'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/oliviermartelly'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '0def99ce-641f-4043-8f1c-dee5dbb4c3c5'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@ralphconde'),
    tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Musicien']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '64a43b19-0b44-4480-85cb-013c51f37649'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'f358e062-b44d-4179-9a38-22e1b3d4f661'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'dd1c4268-6305-4641-9e66-99859764db28'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'ad7fff65-8c09-4da4-830c-851106c737f0'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC1doAXToOGftK-UaoAhlkfw'),
    updated_at = now()
  WHERE id = 'aa000000-0000-0000-0000-000000000003'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCEhDGvg8cufVXqGO1fd5M3w'),
    updated_at = now()
  WHERE id = 'fddecc2d-9e78-4136-ba20-b70145328149'::uuid;

UPDATE public.artists
  SET url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/4891505'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '2763186b-3492-4ce0-9fc5-1c76283377f3'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '46f21fb5-d548-4e23-ae9b-78a8c5852e38'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '5354408c-a5de-492f-8840-2255f5d5f5ee'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'e195325d-cdc0-4e77-83b2-51df9476d763'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCpY4JlnccKLrPfogpYM5ceA'),
    updated_at = now()
  WHERE id = 'f6649d99-7afa-4c89-8cf2-63f29d8ee232'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@theplugmusik'),
    updated_at = now()
  WHERE id = '334e9042-3386-45ee-b3d8-ec193c466124'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@Theloofficial17'),
    updated_at = now()
  WHERE id = '161200bf-8aeb-4b5d-9437-0adb82683780'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '5ace8515-6b5d-417b-a745-0aa66d7460d8'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCLHBWWgOQQI0OOL1Nf1XZWQ'),
    updated_at = now()
  WHERE id = '0c5194b8-ec97-4f10-bbe6-35c8e5fff243'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UC6F6AS4FLnjmyAbugezoP6Q'),
    updated_at = now()
  WHERE id = 'df096c68-e62d-405d-b3fc-f15ba7538b6a'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '1d0a66ad-61f6-4490-be0f-a156a204ff71'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCduvg_JyNPy8WoJhOfgtyZA'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/0iOgRHaPQ2OGQlZYsCapKc'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/ca/artist/vwadezil/270545729'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'aa000000-0000-0000-0000-000000000009'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'aa000000-0000-0000-0000-000000000007'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCEZq8nrd7l0X0_05FrDlPdw'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/6ZrHa6BqjHwq6vceFhxOaL'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/us/artist/watson-g/414985017'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/pi-piti-paningran-yo-'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/11838215'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@watsong_pipitiofficiel'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/watson_g_pipiti_pami_gran_yo'),
    updated_at = now()
  WHERE id = '9c79ab00-4d87-491b-af08-e01179de9d50'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@TrakaMusicGrp'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/wendyyyking'),
    updated_at = now()
  WHERE id = '82c1da17-0d69-4c64-b517-33bedcdf7409'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UCWVwpgTad6HBDxbWbTBkWdw'),
    url_spotify = coalesce(nullif(btrim(url_spotify), ''), 'https://open.spotify.com/intl-fr/artist/2NB9Yw58zVxCBGQEwqg7wv'),
    url_apple_music = coalesce(nullif(btrim(url_apple_music), ''), 'https://music.apple.com/us/artist/wid/378404644'),
    url_audiomack = coalesce(nullif(btrim(url_audiomack), ''), 'https://audiomack.com/widmusicofficial'),
    url_deezer = coalesce(nullif(btrim(url_deezer), ''), 'https://www.deezer.com/fr/artist/4441166'),
    url_tiktok = coalesce(nullif(btrim(url_tiktok), ''), 'https://www.tiktok.com/@widmusicofficial'),
    url_instagram = coalesce(nullif(btrim(url_instagram), ''), 'https://www.instagram.com/widmusicofficial'),
    haitian_status = 'verified_haitian',
    verified_at = coalesce(verified_at, '2026-07-26T04:07:20.809Z'::timestamptz),
    updated_at = now()
  WHERE id = '85eaf21f-35e3-4f2d-a9d7-9dd09d1492e6'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '91bd9967-0906-4e6e-b621-188969b2524a'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@x9daddylova55'),
    updated_at = now()
  WHERE id = 'c56c3c78-46f0-43db-96a0-d886c784d6c0'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/channel/UClu3wvr4mUMQb_Xd_Kw8FKA'),
    updated_at = now()
  WHERE id = '00d9c50e-ec38-436b-a05d-163af855755c'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@YaniMartelly'),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = '274bd0ce-f34f-4da5-a09f-cc84c28e7c14'::uuid;

UPDATE public.artists
  SET haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'c1e09ad1-6466-405b-b14f-c44e7dd88e80'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['chanteur', 'Groupe']::text[]) AS tag
    ),
    updated_at = now()
  WHERE id = '9632a8ba-800d-4a4c-be8c-7842fc265c6f'::uuid;

UPDATE public.artists
  SET tags = (
      SELECT array_agg(DISTINCT tag ORDER BY tag)
      FROM unnest(coalesce(tags, '{}'::text[]) || ARRAY['Groupe']::text[]) AS tag
    ),
    haitian_status = 'verified_haitian',
    updated_at = now()
  WHERE id = 'e363c59e-2991-400a-a1d9-8a104ed11bc4'::uuid;

UPDATE public.artists
  SET url_youtube = coalesce(nullif(btrim(url_youtube), ''), 'https://www.youtube.com/@ZOBWAYPAMAY'),
    url_soundcloud = coalesce(nullif(btrim(url_soundcloud), ''), 'https://soundcloud.com/caz-caz-660244647'),
    updated_at = now()
  WHERE id = 'c4e3ac5c-3e07-4241-87ce-ee698d95b03a'::uuid;

COMMIT;
