-- =========================================================
-- Planète HMI — Système de revendication automatique TikTok
-- Profil de test X-OJO + colonne claim_artist_id côté serveur
-- =========================================================

-- 1. Profil artiste X-OJO (idempotent)
INSERT INTO artists (name, slug, haitian_status, is_active, url_tiktok)
VALUES ('X-OJO', 'x-ojo', 'pending_review', true, 'https://www.tiktok.com/@x_ojo_official')
ON CONFLICT (slug) DO UPDATE SET
  url_tiktok = EXCLUDED.url_tiktok,
  is_active = true;

-- 2. Identité plateforme TikTok pour X-OJO (idempotent)
INSERT INTO artist_platform_identities (
  artist_id,
  platform,
  external_id,
  external_url,
  platform_name,
  match_method,
  is_verified
)
SELECT
  a.id,
  'tiktok',
  'x_ojo_official',
  'https://www.tiktok.com/@x_ojo_official',
  'X-OJO',
  'manual_admin',
  false
FROM artists a WHERE a.slug = 'x-ojo'
ON CONFLICT (platform, external_id) DO UPDATE SET
  external_url = EXCLUDED.external_url,
  platform_name = EXCLUDED.platform_name;

-- 3. Colonne pour mémoriser l'artiste demandé pendant le flux OAuth
-- Stockée dans artist_accounts (serveur uniquement, jamais exposée au client)
ALTER TABLE artist_accounts ADD COLUMN IF NOT EXISTS claim_target_artist_id uuid REFERENCES artists(id);

-- 4. Trace d'audit pour les revendications automatiques
CREATE TABLE IF NOT EXISTS artist_claim_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  artist_id uuid NOT NULL REFERENCES artists(id),
  tiktok_open_id text NOT NULL,
  tiktok_username text,
  expected_username text,
  match_result text NOT NULL, -- 'exact_match', 'no_match', 'missing_scope'
  auto_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE artist_claim_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON artist_claim_audit FOR SELECT USING (public.is_admin());
