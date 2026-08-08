-- ============================================================================
-- Migration: Arène communautaire — Politiques RLS
-- Description: Active RLS sur toutes les tables communautaires et applique
--              les politiques de sécurité (lecture publique, écriture auth,
--              admin-only, system-only via SECURITY DEFINER)
-- Requirements: 14.7, 14.8, 15.1, 15.2
-- Depends on: 20250101000001_arene_core_tables.sql
--             20250101000002_arene_gamification_moderation.sql
--             20260706173846_create_charts_rls.sql (is_admin() function)
-- ============================================================================

-- ==========================================================================
-- 1. Activer RLS sur toutes les tables communautaires
-- ==========================================================================
ALTER TABLE community_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges                ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_badges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed         ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_terms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_points_log      ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- 2. community_profiles — SELECT: all | INSERT: auth (own) | UPDATE: auth (own)
-- ==========================================================================
CREATE POLICY "community_profiles_select_all"
  ON community_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "community_profiles_insert_own"
  ON community_profiles FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "community_profiles_update_own"
  ON community_profiles FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- ==========================================================================
-- 3. reactions — SELECT: all | INSERT: auth (own) | DELETE: auth (own)
-- ==========================================================================
CREATE POLICY "reactions_select_all"
  ON reactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "reactions_insert_own"
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "reactions_delete_own"
  ON reactions FOR DELETE
  TO authenticated
  USING (member_id = auth.uid());

-- ==========================================================================
-- 4. comments — SELECT: published for all, all for admin | INSERT: auth (own) | DELETE: auth (own)
-- ==========================================================================
CREATE POLICY "comments_select_published"
  ON comments FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR public.is_admin());

CREATE POLICY "comments_insert_own"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  TO authenticated
  USING (member_id = auth.uid());

-- ==========================================================================
-- 5. battles — SELECT: all | INSERT/UPDATE/DELETE: admin only
-- ==========================================================================
CREATE POLICY "battles_select_all"
  ON battles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "battles_insert_admin"
  ON battles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "battles_update_admin"
  ON battles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "battles_delete_admin"
  ON battles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ==========================================================================
-- 6. battle_votes — SELECT: all | INSERT: auth (own)
-- ==========================================================================
CREATE POLICY "battle_votes_select_all"
  ON battle_votes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "battle_votes_insert_own"
  ON battle_votes FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- ==========================================================================
-- 7. challenges — SELECT: all | INSERT/UPDATE: admin only
-- ==========================================================================
CREATE POLICY "challenges_select_all"
  ON challenges FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "challenges_insert_admin"
  ON challenges FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "challenges_update_admin"
  ON challenges FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ==========================================================================
-- 8. challenge_completions — SELECT: all | INSERT: auth (own) | UPDATE: auth (own)
-- ==========================================================================
CREATE POLICY "challenge_completions_select_all"
  ON challenge_completions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "challenge_completions_insert_own"
  ON challenge_completions FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "challenge_completions_update_own"
  ON challenge_completions FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- ==========================================================================
-- 9. badges — SELECT: all | INSERT/UPDATE: admin only
-- ==========================================================================
CREATE POLICY "badges_select_all"
  ON badges FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "badges_insert_admin"
  ON badges FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "badges_update_admin"
  ON badges FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ==========================================================================
-- 10. member_badges — SELECT: all | INSERT: system only (SECURITY DEFINER RPCs)
--     No direct INSERT policy for users — only SECURITY DEFINER functions can insert
-- ==========================================================================
CREATE POLICY "member_badges_select_all"
  ON member_badges FOR SELECT
  TO anon, authenticated
  USING (true);

-- ==========================================================================
-- 11. activity_feed — SELECT: all | INSERT: system only (SECURITY DEFINER RPCs)
--     No direct INSERT policy for users — only SECURITY DEFINER functions can insert
-- ==========================================================================
CREATE POLICY "activity_feed_select_all"
  ON activity_feed FOR SELECT
  TO anon, authenticated
  USING (true);

-- ==========================================================================
-- 12. moderation_reports — SELECT: admin only | INSERT: auth (own)
-- ==========================================================================
CREATE POLICY "moderation_reports_select_admin"
  ON moderation_reports FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "moderation_reports_insert_own"
  ON moderation_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- ==========================================================================
-- 13. moderation_actions — admin only (all operations)
-- ==========================================================================
CREATE POLICY "moderation_actions_select_admin"
  ON moderation_actions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "moderation_actions_insert_admin"
  ON moderation_actions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ==========================================================================
-- 14. notifications — SELECT: auth (own) | INSERT: system only | UPDATE: auth (own, mark read)
-- ==========================================================================
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- ==========================================================================
-- 15. banned_terms — SELECT/INSERT/UPDATE/DELETE: admin only
-- ==========================================================================
CREATE POLICY "banned_terms_select_admin"
  ON banned_terms FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "banned_terms_insert_admin"
  ON banned_terms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "banned_terms_update_admin"
  ON banned_terms FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "banned_terms_delete_admin"
  ON banned_terms FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ==========================================================================
-- 16. daily_points_log — SELECT/INSERT/UPDATE: auth (own) — used by RPCs
--     Also accessible via SECURITY DEFINER award_points function
-- ==========================================================================
CREATE POLICY "daily_points_log_select_own"
  ON daily_points_log FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "daily_points_log_insert_own"
  ON daily_points_log FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "daily_points_log_update_own"
  ON daily_points_log FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- ==========================================================================
-- 17. Grants — Permettre aux rôles anon et authenticated d'accéder aux tables
-- ==========================================================================
GRANT SELECT ON community_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON community_profiles TO authenticated;

GRANT SELECT ON reactions TO anon, authenticated;
GRANT INSERT, DELETE ON reactions TO authenticated;

GRANT SELECT ON comments TO anon, authenticated;
GRANT INSERT, DELETE ON comments TO authenticated;

GRANT SELECT ON battles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON battles TO authenticated;

GRANT SELECT ON battle_votes TO anon, authenticated;
GRANT INSERT ON battle_votes TO authenticated;

GRANT SELECT ON challenges TO anon, authenticated;
GRANT INSERT, UPDATE ON challenges TO authenticated;

GRANT SELECT ON challenge_completions TO anon, authenticated;
GRANT INSERT, UPDATE ON challenge_completions TO authenticated;

GRANT SELECT ON badges TO anon, authenticated;
GRANT INSERT, UPDATE ON badges TO authenticated;

GRANT SELECT ON member_badges TO anon, authenticated;
GRANT INSERT ON member_badges TO authenticated;

GRANT SELECT ON activity_feed TO anon, authenticated;
GRANT INSERT ON activity_feed TO authenticated;

GRANT SELECT, INSERT ON moderation_reports TO authenticated;

GRANT SELECT, INSERT ON moderation_actions TO authenticated;

GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON banned_terms TO authenticated;

GRANT SELECT, INSERT, UPDATE ON daily_points_log TO authenticated;
