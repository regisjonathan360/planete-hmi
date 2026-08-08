BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE prune_artist_ids (
  id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO prune_artist_ids (id) VALUES
  ('3e25d391-68c7-4826-8367-e3bc5a9ce67f'::uuid),
  ('5f886391-4b9c-48ab-8b25-05eed0a8d2cf'::uuid),
  ('22222222-0000-0000-0000-000000000002'::uuid),
  ('22222222-0000-0000-0000-000000000001'::uuid),
  ('5d11fcd7-7396-4f96-87b8-e60797596bc3'::uuid),
  ('6d61dae5-70e0-47ca-92d5-d691e8e4a500'::uuid),
  ('8048cd4d-dd45-4e31-906c-4f6e9126c3f5'::uuid),
  ('8cee09a2-34ae-4255-a28b-c29ecf842ad8'::uuid),
  ('235bfdcf-228b-4b83-a544-5af59aad3a7b'::uuid),
  ('aa000000-0000-0000-0000-000000000008'::uuid),
  ('b1a50565-bbc0-4938-a8b4-eff4a733e934'::uuid),
  ('4515fee1-e33f-49d8-b09c-2a9268ef87dc'::uuid),
  ('7a87a2bc-901b-41a1-8a0d-572e1eecf2cf'::uuid),
  ('b719b7ef-d957-4479-b477-2e342d1ff89c'::uuid),
  ('0ec7aab9-3eee-4fd4-a697-1d623a1518ca'::uuid),
  ('3d7bf040-618b-44b3-96b2-d742bceef662'::uuid),
  ('39f36d28-4d13-41b0-b4c2-ab39bcbdb21b'::uuid),
  ('76d6e281-7ca7-4fa0-82af-9c6d6ce9dbde'::uuid),
  ('75ad514c-6f0e-4e88-a181-7b9b0abeccf6'::uuid),
  ('6fe4818d-638b-46bb-8569-ab75618b119f'::uuid),
  ('f62f01d8-3273-4cc0-a5ff-a123e5b49dbc'::uuid),
  ('c19bdad4-c5e4-43a6-be9c-8b3f8413fd3d'::uuid),
  ('5f20d4c1-4899-478e-8a53-90096b300c88'::uuid),
  ('5ef512a2-b302-40ad-b17a-ed221f90372a'::uuid),
  ('94fe91bf-2803-4399-94a8-dc5c28521898'::uuid),
  ('20018044-f9db-4643-8869-c55e8fd764e9'::uuid),
  ('3d940968-643a-4495-8014-833cc33735f9'::uuid),
  ('8e5b5af5-6794-46d9-9213-6dc389aa4f16'::uuid),
  ('0b06101c-3568-4f94-b3bb-892152b56076'::uuid),
  ('79f2bbd9-bcbd-46c6-8b2b-9419034281f8'::uuid),
  ('88fd86d5-370e-4599-97f2-403da3ca5a75'::uuid),
  ('adcaf6a8-1f78-413d-9b49-7f9a86258bb0'::uuid),
  ('d0e54cc1-8842-4c17-a603-016572db39b9'::uuid),
  ('211f2d63-feda-4de8-8a62-68c2edbd58d6'::uuid),
  ('4596758d-5c21-4ae4-8909-851a1cf60c7d'::uuid),
  ('6c0ad760-73e1-49fc-a43a-9722ba729a7a'::uuid),
  ('2fc2a59d-365f-4e25-9edd-e23e23e6a835'::uuid),
  ('843de76c-023f-4fdc-be2e-d4f742f517d0'::uuid),
  ('f0a88d00-a8d5-4565-bfb9-04bf439a22a3'::uuid),
  ('17d39406-d16e-4903-abfb-7f9c697f0859'::uuid),
  ('dc22f868-0cdb-430f-b2c4-369bd28784db'::uuid),
  ('c8d065ff-4054-4972-9e68-063d874fe306'::uuid),
  ('3b656e49-08b3-4ee7-b491-a17b09f6044b'::uuid),
  ('8bc0d6be-36fb-48b4-90bc-9a329d7e2deb'::uuid),
  ('37f27ed8-46b2-4b85-99af-d2e68a0fc74d'::uuid),
  ('2a9bf481-648d-45ac-b629-1ed41dfc39b2'::uuid),
  ('cf722dd1-f30f-4f7c-ad19-4232ba63ec74'::uuid),
  ('c4a55d2c-3024-4287-b5c9-dc165036e1bf'::uuid),
  ('99970017-82df-44a5-befc-84eed944c5c1'::uuid),
  ('1c4ed73d-b7dc-4f1d-a7d4-35cf9df36a57'::uuid),
  ('e681b74d-2f41-48a8-91be-86029d570400'::uuid),
  ('1a92b56e-2551-4fd5-b413-c100517f7173'::uuid),
  ('e3b5e3bb-7daa-435e-8c3e-79013080b540'::uuid),
  ('67efba80-8e94-45f7-92bc-5345720689cf'::uuid),
  ('d3ecd10b-40b8-45b2-9dcd-b645b8abcdc8'::uuid),
  ('667e16b5-ab2b-40a7-aff2-b8dbd1cbaed5'::uuid),
  ('677b6e9e-24de-4399-a424-33664a84883a'::uuid),
  ('de272f94-48a3-49c6-96e4-354119cfd57a'::uuid),
  ('7aca4807-7c49-4bbc-868c-f7ed74bca01d'::uuid),
  ('3a7fe33b-b1ed-4cfb-8f03-1c85eafe3e91'::uuid),
  ('5e852c71-0107-441e-96a8-1f4f56c528b6'::uuid),
  ('66dd902a-454a-4029-b5c0-2f2aa4f4e6f1'::uuid),
  ('15706f88-d85d-4f2b-a043-b732652692fb'::uuid),
  ('91252a58-7988-443a-984e-d3bddfc15b60'::uuid),
  ('8863a9e5-f9fa-4f78-ac9c-2c9f0ed6ee16'::uuid);

DO $check$
DECLARE
  candidate_count integer;
BEGIN
  SELECT count(*) INTO candidate_count
  FROM public.artists a
  JOIN prune_artist_ids p ON p.id = a.id;

  IF candidate_count <> 65 THEN
    RAISE EXCEPTION 'artist_count_changed: expected %, got %',
      65, candidate_count;
  END IF;

  IF EXISTS (
    WITH protected AS (
  SELECT ta.artist_id, cs.source_key
  FROM public.chart_sources cs
  JOIN public.chart_editions e ON e.chart_source_id = cs.id
  JOIN public.chart_entries ce ON ce.chart_edition_id = e.id
  JOIN public.track_artists ta ON ta.track_id = ce.track_id
  WHERE lower(cs.platform) IN ('audiomack', 'deezer')
     OR lower(cs.source_key) LIKE 'audiomack%'
     OR lower(cs.source_key) LIKE 'deezer%'

  UNION

  SELECT ta.artist_id, cs.source_key
  FROM public.chart_sources cs
  JOIN public.chart_editions e ON e.chart_source_id = cs.id
  JOIN public.chart_entries ce ON ce.chart_edition_id = e.id
  JOIN public.platform_tracks pt ON pt.id = ce.platform_track_id
  JOIN public.track_artists ta ON ta.track_id = pt.track_id
  WHERE lower(cs.platform) IN ('audiomack', 'deezer')
     OR lower(cs.source_key) LIKE 'audiomack%'
     OR lower(cs.source_key) LIKE 'deezer%'
)
    SELECT 1
    FROM protected x
    JOIN prune_artist_ids p ON p.id = x.artist_id
  ) THEN
    RAISE EXCEPTION 'new_audiomack_or_deezer_protection_detected';
  END IF;
END
$check$;

UPDATE public.artist_accounts aa
SET claim_target_artist_id = NULL
FROM prune_artist_ids p
WHERE aa.claim_target_artist_id = p.id;

DELETE FROM public.artist_claim_audit d
USING prune_artist_ids p
WHERE d.artist_id = p.id;

DELETE FROM public.artist_merges d
USING prune_artist_ids p
WHERE d.kept_artist_id = p.id;

DELETE FROM public.youtube_channel_artists d
USING prune_artist_ids p
WHERE d.artist_id = p.id;

DO $delete$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.artists a
  USING prune_artist_ids p
  WHERE a.id = p.id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 65 THEN
    RAISE EXCEPTION 'unexpected_deleted_count: expected %, got %',
      65, deleted_count;
  END IF;
END
$delete$;

COMMIT;
