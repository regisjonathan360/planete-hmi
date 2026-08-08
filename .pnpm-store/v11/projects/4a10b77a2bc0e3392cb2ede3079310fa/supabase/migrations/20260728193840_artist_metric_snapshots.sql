CREATE TABLE public.artist_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (btrim(platform) <> ''),
  source_field text NOT NULL CHECK (btrim(source_field) <> ''),
  collected_at timestamptz NOT NULL,
  monthly_listeners bigint CHECK (monthly_listeners IS NULL OR monthly_listeners >= 0),
  followers bigint CHECK (followers IS NULL OR followers >= 0),
  subscriber_count bigint CHECK (subscriber_count IS NULL OR subscriber_count >= 0),
  total_views bigint CHECK (total_views IS NULL OR total_views >= 0),
  popularity smallint CHECK (popularity IS NULL OR popularity BETWEEN 0 AND 100),
  album_count bigint CHECK (album_count IS NULL OR album_count >= 0),
  track_count bigint CHECK (track_count IS NULL OR track_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_metric_snapshots_has_metric CHECK (
    num_nonnulls(monthly_listeners, followers, subscriber_count, total_views, popularity, album_count, track_count) > 0
  ),
  CONSTRAINT artist_metric_snapshots_collection_key UNIQUE (artist_id, platform, collected_at)
);

CREATE INDEX artist_metric_snapshots_artist_recent_idx
  ON public.artist_metric_snapshots (artist_id, collected_at DESC);

CREATE INDEX artist_metric_snapshots_artist_platform_recent_idx
  ON public.artist_metric_snapshots (artist_id, platform, collected_at DESC);

ALTER TABLE public.artist_metric_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.artist_metric_snapshots FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.artist_metric_snapshots FROM service_role;
GRANT SELECT, INSERT ON TABLE public.artist_metric_snapshots TO service_role;

COMMENT ON TABLE public.artist_metric_snapshots IS
  'Historique immuable des indicateurs publics collectés pour chaque artiste et plateforme.';

INSERT INTO public.artist_metric_snapshots (
  artist_id, platform, source_field, collected_at, monthly_listeners,
  followers, subscriber_count, total_views, popularity, album_count, track_count
)
SELECT
  identity.artist_id,
  identity.platform,
  COALESCE(NULLIF(identity.metadata->>'field', ''), 'url_' || identity.platform),
  COALESCE(identity.updated_at, identity.last_seen_at, identity.created_at, now()),
  CASE WHEN identity.metadata->>'monthly_listeners' ~ '^\d+$'
    THEN (identity.metadata->>'monthly_listeners')::bigint END,
  CASE WHEN identity.metadata->>'followers' ~ '^\d+$'
    THEN (identity.metadata->>'followers')::bigint END,
  CASE WHEN identity.metadata->>'subscriber_count' ~ '^\d+$'
    THEN (identity.metadata->>'subscriber_count')::bigint END,
  CASE WHEN identity.metadata->>'total_views' ~ '^\d+$'
    THEN (identity.metadata->>'total_views')::bigint END,
  CASE WHEN identity.metadata->>'popularity' ~ '^\d+$'
    THEN LEAST((identity.metadata->>'popularity')::integer, 100)::smallint END,
  CASE WHEN identity.metadata->>'album_count' ~ '^\d+$'
    THEN (identity.metadata->>'album_count')::bigint END,
  CASE WHEN identity.metadata->>'track_count' ~ '^\d+$'
    THEN (identity.metadata->>'track_count')::bigint END
FROM public.artist_platform_identities AS identity
WHERE num_nonnulls(
  CASE WHEN identity.metadata->>'monthly_listeners' ~ '^\d+$' THEN 1 END,
  CASE WHEN identity.metadata->>'followers' ~ '^\d+$' THEN 1 END,
  CASE WHEN identity.metadata->>'subscriber_count' ~ '^\d+$' THEN 1 END,
  CASE WHEN identity.metadata->>'total_views' ~ '^\d+$' THEN 1 END,
  CASE WHEN identity.metadata->>'popularity' ~ '^\d+$' THEN 1 END,
  CASE WHEN identity.metadata->>'album_count' ~ '^\d+$' THEN 1 END,
  CASE WHEN identity.metadata->>'track_count' ~ '^\d+$' THEN 1 END
) > 0
ON CONFLICT (artist_id, platform, collected_at) DO NOTHING;;
