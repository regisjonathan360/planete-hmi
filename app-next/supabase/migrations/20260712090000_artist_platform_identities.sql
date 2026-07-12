-- =========================================================
-- Planète HMI — Identités multi-plateformes des artistes
-- Un artiste unique peut avoir des profils sur plusieurs plateformes.
-- Cette table stocke chaque identité externe rattachée au profil interne.
-- =========================================================

CREATE TABLE IF NOT EXISTS artist_platform_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  platform text NOT NULL, -- audiomack, deezer, spotify, apple_music, youtube, tiktok, soundcloud, tidal
  external_id text,       -- ID sur la plateforme
  external_url text,      -- URL du profil sur la plateforme
  platform_name text,     -- Nom affiché sur la plateforme (peut différer du nom Planet HMI)
  platform_image_url text,-- Photo de profil sur la plateforme
  match_confidence numeric(3,2) DEFAULT 1.0, -- 0.00 à 1.00
  match_method text,      -- auto_collect, manual_admin, user_claim
  is_verified boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  collected_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Un artiste ne peut avoir qu'une identité par plateforme+external_id
  UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS api_artist_id_idx ON artist_platform_identities (artist_id);
CREATE INDEX IF NOT EXISTS api_platform_idx ON artist_platform_identities (platform, external_id);

-- RLS
ALTER TABLE artist_platform_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read identities" ON artist_platform_identities FOR SELECT USING (true);
CREATE POLICY "admin manage identities" ON artist_platform_identities FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON artist_platform_identities TO anon, authenticated;

-- =========================================================
-- Table pour la détection de doublons (Phase 4)
-- =========================================================
CREATE TABLE IF NOT EXISTS artist_merge_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_a_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  artist_b_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  confidence numeric(3,2) NOT NULL DEFAULT 0.5, -- 0.00 à 1.00
  reason text NOT NULL, -- normalized_name_match, platform_match, isrc_match, etc.
  status text NOT NULL DEFAULT 'pending', -- pending, merged, dismissed
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_a_id, artist_b_id)
);

CREATE INDEX IF NOT EXISTS amc_status_idx ON artist_merge_candidates (status) WHERE status = 'pending';

ALTER TABLE artist_merge_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage merge candidates" ON artist_merge_candidates FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- Table historique des fusions (pour annulation)
-- =========================================================
CREATE TABLE IF NOT EXISTS artist_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kept_artist_id uuid NOT NULL REFERENCES artists(id),
  merged_artist_id uuid NOT NULL, -- L'ID de l'artiste fusionné (peut ne plus exister)
  merged_data jsonb NOT NULL, -- Snapshot complet de l'artiste fusionné avant fusion
  merged_by uuid,
  merged_at timestamptz NOT NULL DEFAULT now(),
  is_reverted boolean NOT NULL DEFAULT false,
  reverted_at timestamptz
);

-- =========================================================
-- Table favoris visiteurs (Phase 5)
-- =========================================================
CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, artist_id)
);

CREATE INDEX IF NOT EXISTS uf_user_idx ON user_favorites (user_id);
CREATE INDEX IF NOT EXISTS uf_artist_idx ON user_favorites (artist_id);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own favorites" ON user_favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON user_favorites TO authenticated;
