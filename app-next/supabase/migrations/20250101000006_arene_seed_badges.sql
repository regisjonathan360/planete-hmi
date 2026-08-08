-- ============================================================================
-- Migration: Arène communautaire — Badges par défaut
-- Description: Insère les badges standard pour le système de gamification.
--              Ces badges sont attribués automatiquement par checkAndAwardBadges.
-- ============================================================================

INSERT INTO badges (name, description, icon_url, badge_type, condition_value, is_special) VALUES
  ('Premier commentaire', 'Vous avez publié votre premier commentaire dans l''arène.', '⭐', 'first_comment', 1, false),
  ('Premier vote', 'Vous avez voté pour la première fois dans une battle.', '🗳️', 'first_vote', 1, false),
  ('Votant assidu', 'Vous avez voté dans 10 battles différentes.', '🏆', '10_battles', 10, false),
  ('Réacteur cosmique', 'Vous avez posé 50 réactions sur des contenus.', '💫', '50_reactions', 50, false),
  ('Flamme continue', 'Vous avez été actif 7 jours consécutifs.', '🔥', '7_days_streak', 7, false),
  ('Défi accompli', 'Vous avez complété un défi communautaire.', '🎯', 'challenge_complete', 1, false),
  ('Ascension cosmique', 'Vous avez atteint un nouveau niveau cosmique.', '🚀', 'level_up', 1, false);
