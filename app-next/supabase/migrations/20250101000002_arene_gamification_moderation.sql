-- ============================================================================
-- Migration: Arène communautaire — Gamification & Modération
-- Description: Crée les tables challenges, challenge_completions, badges,
--              member_badges, daily_points_log, activity_feed, moderation_reports,
--              moderation_actions, banned_terms, notifications
-- Requirements: 14.1, 14.6
-- Depends on: 20250101000001_arene_core_tables.sql (comments table)
-- ============================================================================

-- ==========================================================================
-- Table: challenges
-- Défis communautaires temporaires proposés par l'administration
-- ==========================================================================
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  challenge_type VARCHAR(30) NOT NULL
    CHECK (challenge_type IN ('vote_battles', 'comment_songs', 'react_contents', 'consecutive_days')),
  target_count INTEGER NOT NULL CHECK (target_count BETWEEN 1 AND 100),
  reward_points INTEGER NOT NULL CHECK (reward_points BETWEEN 1 AND 10000),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'ended')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  participant_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_status ON challenges(status, ends_at);

-- ==========================================================================
-- Table: challenge_completions
-- Suivi de la progression et complétion des défis par les membres
-- ==========================================================================
CREATE TABLE challenge_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, challenge_id)
);

-- ==========================================================================
-- Table: badges
-- Distinctions visuelles attribuables aux membres pour des accomplissements
-- ==========================================================================
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  description VARCHAR(200) NOT NULL,
  icon_url TEXT NOT NULL,
  badge_type VARCHAR(30) NOT NULL
    CHECK (badge_type IN ('first_comment', 'first_vote', '10_battles', '50_reactions',
      '7_days_streak', 'challenge_complete', 'level_up', 'special')),
  condition_value INTEGER,
  is_special BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- Table: member_badges
-- Association membre ↔ badge (un badge attribué une seule fois par membre)
-- ==========================================================================
CREATE TABLE member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, badge_id)
);

-- ==========================================================================
-- Table: daily_points_log
-- Journal quotidien des points gagnés par catégorie (pour plafonds journaliers)
-- ==========================================================================
CREATE TABLE daily_points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('reaction', 'comment', 'vote', 'challenge')),
  points_earned INTEGER NOT NULL DEFAULT 0,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(member_id, category, log_date)
);

CREATE INDEX idx_daily_points ON daily_points_log(member_id, log_date);

-- ==========================================================================
-- Table: activity_feed
-- Mur d'activité en temps réel de la communauté
-- ==========================================================================
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type VARCHAR(30) NOT NULL
    CHECK (activity_type IN ('reaction', 'comment', 'vote', 'badge_earned',
      'new_member', 'new_chart', 'challenge_complete')),
  target_type VARCHAR(30),
  target_id UUID,
  target_label TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_feed_date ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_feed_grouping ON activity_feed(activity_type, target_type, target_id, created_at);

-- ==========================================================================
-- Table: moderation_reports
-- Signalements de commentaires par les membres
-- ==========================================================================
CREATE TABLE moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reason VARCHAR(30) NOT NULL
    CHECK (reason IN ('insulte', 'spam', 'discours_haineux', 'autre')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reporter_id, comment_id)
);

CREATE INDEX idx_reports_comment ON moderation_reports(comment_id);

-- ==========================================================================
-- Table: moderation_actions
-- Actions de modération effectuées par les administrateurs
-- ==========================================================================
CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('validate', 'delete', 'restore')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- Table: banned_terms
-- Liste noire de termes interdits pour la modération automatique
-- ==========================================================================
CREATE TABLE banned_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- Table: notifications
-- Notifications in-app pour les membres (badges, niveaux, modération)
-- ==========================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('badge_earned', 'level_up', 'comment_deleted', 'suspension', 'challenge_reward')),
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_member ON notifications(member_id, read, created_at DESC);
