-- Archive durable des photos et bannières choisies depuis les collectes.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'artist-media',
  'artist-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- L'ancien conflit (platform, external_id) permettait plusieurs collectes
-- concurrentes pour le même artiste et la même plateforme.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY artist_id, platform
      ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS position
  FROM public.artist_platform_identities
)
DELETE FROM public.artist_platform_identities AS identity
USING ranked
WHERE identity.id = ranked.id
  AND ranked.position > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artist_platform_identities_artist_platform_key'
      AND conrelid = 'public.artist_platform_identities'::regclass
  ) THEN
    ALTER TABLE public.artist_platform_identities
      ADD CONSTRAINT artist_platform_identities_artist_platform_key
      UNIQUE (artist_id, platform);
  END IF;
END;
$$;

COMMENT ON CONSTRAINT artist_platform_identities_artist_platform_key
ON public.artist_platform_identities IS
  'Une seule collecte persistée par artiste et par plateforme.';;
