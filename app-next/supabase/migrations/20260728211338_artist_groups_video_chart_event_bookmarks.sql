-- Relations structurées entre les groupes et leurs membres.
CREATE TABLE public.artist_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  member_artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  membership_role text,
  joined_at date,
  left_at date,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_group_members_distinct CHECK (group_artist_id <> member_artist_id),
  CONSTRAINT artist_group_members_dates CHECK (
    joined_at IS NULL OR left_at IS NULL OR left_at >= joined_at
  ),
  CONSTRAINT artist_group_members_unique UNIQUE (group_artist_id, member_artist_id)
);

CREATE INDEX artist_group_members_group_idx
  ON public.artist_group_members (group_artist_id, is_current);
CREATE INDEX artist_group_members_member_idx
  ON public.artist_group_members (member_artist_id, is_current);

ALTER TABLE public.artist_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_artist_group_members"
  ON public.artist_group_members
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.artists AS group_artist
      WHERE group_artist.id = group_artist_id
        AND group_artist.is_active = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.artists AS member_artist
      WHERE member_artist.id = member_artist_id
        AND member_artist.is_active = true
    )
  );

CREATE POLICY "admin_manage_artist_group_members"
  ON public.artist_group_members
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.artist_group_members FROM PUBLIC;
GRANT SELECT ON TABLE public.artist_group_members TO anon, authenticated;
GRANT ALL ON TABLE public.artist_group_members TO service_role;

COMMENT ON TABLE public.artist_group_members IS
  'Relations administrées entre un groupe ou orchestre et ses artistes membres.';

CREATE OR REPLACE FUNCTION public.set_artist_group_relationships(
  p_artist_id uuid,
  p_group_ids uuid[] DEFAULT '{}'::uuid[],
  p_member_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_artist_type text;
BEGIN
  SELECT artist_type
  INTO v_artist_type
  FROM public.artists
  WHERE id = p_artist_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'artist_not_found';
  END IF;
  IF p_artist_id = ANY(COALESCE(p_group_ids, '{}'::uuid[]))
     OR p_artist_id = ANY(COALESCE(p_member_ids, '{}'::uuid[])) THEN
    RAISE EXCEPTION 'self_membership';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_group_ids, '{}'::uuid[])) AS requested(id)
    LEFT JOIN public.artists artist ON artist.id = requested.id
    WHERE artist.id IS NULL OR artist.artist_type <> 'group'
  ) THEN
    RAISE EXCEPTION 'invalid_group';
  END IF;
  IF cardinality(COALESCE(p_member_ids, '{}'::uuid[])) > 0
     AND v_artist_type <> 'group' THEN
    RAISE EXCEPTION 'artist_is_not_group';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_member_ids, '{}'::uuid[])) AS requested(id)
    LEFT JOIN public.artists artist ON artist.id = requested.id
    WHERE artist.id IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid_member';
  END IF;

  DELETE FROM public.artist_group_members
  WHERE member_artist_id = p_artist_id;
  INSERT INTO public.artist_group_members (group_artist_id, member_artist_id)
  SELECT DISTINCT requested.id, p_artist_id
  FROM unnest(COALESCE(p_group_ids, '{}'::uuid[])) AS requested(id);

  IF v_artist_type = 'group' THEN
    DELETE FROM public.artist_group_members
    WHERE group_artist_id = p_artist_id;
    INSERT INTO public.artist_group_members (group_artist_id, member_artist_id)
    SELECT DISTINCT p_artist_id, requested.id
    FROM unnest(COALESCE(p_member_ids, '{}'::uuid[])) AS requested(id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_artist_group_relationships(uuid, uuid[], uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_artist_group_relationships(uuid, uuid[], uuid[])
  TO service_role;

-- Les signets d'événements sont privés et limités au strict nécessaire.
DROP POLICY IF EXISTS "users_manage_own_saved_events" ON public.saved_events;
DROP POLICY IF EXISTS "users_read_own_saved_events" ON public.saved_events;
DROP POLICY IF EXISTS "users_create_own_saved_events" ON public.saved_events;
DROP POLICY IF EXISTS "users_delete_own_saved_events" ON public.saved_events;

CREATE POLICY "users_read_own_saved_events"
  ON public.saved_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users_create_own_saved_events"
  ON public.saved_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_saved_events"
  ON public.saved_events
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.saved_events FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_events TO authenticated;
GRANT ALL ON TABLE public.saved_events TO service_role;

-- Le classement public YouTube est fondé sur les vidéos suivies et leur
-- progression hebdomadaire, pas sur le palmarès territorial YouTube Music.
UPDATE public.chart_sources
SET is_enabled = false,
    updated_at = now()
WHERE source_key = 'youtube_haiti_official';

UPDATE public.chart_sources
SET display_name = 'Top vidéos YouTube HMI',
    chart_context = 'Nouvelles vues hebdomadaires des vidéos officielles suivies',
    market_code = NULL,
    is_enabled = true,
    updated_at = now()
WHERE source_key = 'youtube_hmi_weekly_delta';
