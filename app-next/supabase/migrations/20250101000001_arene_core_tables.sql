-- ============================================================================
-- Migration: Arène communautaire — Tables principales
-- Description: Crée les tables community_profiles, reactions, comments, battles, battle_votes
-- Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
-- ============================================================================

-- ==========================================================================
-- Table: community_profiles
-- Profil communautaire d'un membre (pseudo, niveau, points, stats)
-- ==========================================================================
CREATE TABLE community_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo VARCHAR(30) NOT NULL UNIQUE,
  avatar_url TEXT,
  niveau VARCHAR(20) NOT NULL DEFAULT 'etoile'
    CHECK (niveau IN ('etoile', 'constellation', 'nebuleuse', 'galaxie', 'univers')),
  points_cosmiques INTEGER NOT NULL DEFAULT 0 CHECK (points_cosmiques >= 0),
  comment_count INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspended_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_points ON community_profiles(points_cosmiques DESC);
CREATE INDEX idx_profiles_pseudo ON community_profiles(pseudo);

-- ==========================================================================
-- Table: reactions
-- Réactions emoji cosmiques sur les contenus (chansons, commentaires, battles)
-- ==========================================================================
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('song', 'comment', 'battle')),
  content_id UUID NOT NULL,
  reaction_type VARCHAR(20) NOT NULL
    CHECK (reaction_type IN ('star', 'fire', 'rocket', 'planet', 'magic', 'heart')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, content_type, content_id, reaction_type)
);

CREATE INDEX idx_reactions_content ON reactions(content_type, content_id);
CREATE INDEX idx_reactions_member_date ON reactions(member_id, created_at);

-- ==========================================================================
-- Table: comments
-- Commentaires dans les fils de discussion (chansons, battles, défis, libre)
-- ==========================================================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_type VARCHAR(20) NOT NULL CHECK (thread_type IN ('song', 'battle', 'challenge', 'free')),
  thread_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  status VARCHAR(20) NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'deleted')),
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_thread ON comments(thread_type, thread_id, created_at DESC);
CREATE INDEX idx_comments_member ON comments(member_id);
CREATE INDEX idx_comments_moderation ON comments(status, report_count) WHERE status = 'hidden';

-- ==========================================================================
-- Table: battles
-- Duels thématiques entre artistes ou chansons soumis au vote communautaire
-- ==========================================================================
CREATE TABLE battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  side_a_type VARCHAR(20) NOT NULL CHECK (side_a_type IN ('artist', 'song')),
  side_a_id UUID NOT NULL,
  side_a_label VARCHAR(200) NOT NULL,
  side_a_image_url TEXT,
  side_b_type VARCHAR(20) NOT NULL CHECK (side_b_type IN ('artist', 'song')),
  side_b_id UUID NOT NULL,
  side_b_label VARCHAR(200) NOT NULL,
  side_b_image_url TEXT,
  votes_a INTEGER NOT NULL DEFAULT 0,
  votes_b INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'cancelled')),
  duration_hours INTEGER NOT NULL CHECK (duration_hours IN (24, 48, 72)),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  winner VARCHAR(10) CHECK (winner IN ('side_a', 'side_b', 'tie', NULL)),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_battles_status ON battles(status, ends_at);
CREATE INDEX idx_battles_active ON battles(status) WHERE status = 'active';

-- ==========================================================================
-- Table: battle_votes
-- Votes des membres dans les battles (un seul vote par membre par battle)
-- ==========================================================================
CREATE TABLE battle_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  side VARCHAR(10) NOT NULL CHECK (side IN ('side_a', 'side_b')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, battle_id)
);

CREATE INDEX idx_votes_battle ON battle_votes(battle_id);
