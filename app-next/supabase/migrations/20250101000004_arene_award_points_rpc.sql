-- ============================================================================
-- Migration: Arène communautaire — Fonction RPC award_points
-- Description: Fonction SECURITY DEFINER pour attribuer des points cosmiques
--              avec gestion des plafonds quotidiens et détection de niveau
-- Requirements: 7.1, 7.4, 7.5, 7.6, 3.6, 3.7, 4.5, 4.8
-- Depends on: 20250101000001_arene_core_tables.sql (community_profiles)
--             20250101000002_arene_gamification_moderation.sql (daily_points_log)
-- ============================================================================

-- ==========================================================================
-- Fonction: award_points
-- Attribue des points cosmiques à un membre en respectant les plafonds
-- quotidiens par catégorie. Détecte automatiquement les changements de niveau.
--
-- Paramètres:
--   p_member_id  — UUID du membre recevant les points
--   p_category   — Catégorie d'action ('reaction', 'comment', 'vote', 'challenge')
--   p_points     — Nombre de points demandés
--
-- Retourne un objet JSONB contenant:
--   awarded     — Nombre de points effectivement attribués
--   new_total   — Nouveau total de points cosmiques du membre
--   cap_reached — Booléen indiquant si le plafond quotidien est atteint
--   level_up    — Booléen indiquant si le membre a changé de niveau
--   new_niveau  — Le niveau actuel du membre après attribution
--
-- Plafonds quotidiens (réinitialisés à 00:00 UTC):
--   - reaction : 50 points/jour
--   - comment  : 40 points/jour
--   - vote     : aucun plafond
--   - challenge: aucun plafond
--
-- Seuils de niveaux cosmiques:
--   - etoile        :    0 –   99 points
--   - constellation :  100 –  499 points
--   - nebuleuse     :  500 – 1499 points
--   - galaxie       : 1500 – 4999 points
--   - univers       : 5000+        points
--
-- SECURITY DEFINER: permet de contourner les politiques RLS pour mettre à jour
-- les tables community_profiles et daily_points_log depuis les API routes.
-- ==========================================================================
CREATE OR REPLACE FUNCTION award_points(
  p_member_id UUID,
  p_category VARCHAR(20),
  p_points INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_daily_total INTEGER;
  v_cap INTEGER;
  v_remaining INTEGER;
  v_awarded INTEGER;
  v_new_total INTEGER;
  v_old_niveau VARCHAR(20);
  v_new_niveau VARCHAR(20);
BEGIN
  -- Déterminer le plafond quotidien selon la catégorie
  -- Les réactions sont limitées à 50 pts/jour, les commentaires à 40 pts/jour
  -- Les votes et défis n'ont pas de plafond
  v_cap := CASE p_category
    WHEN 'reaction' THEN 50
    WHEN 'comment' THEN 40
    ELSE NULL
  END;

  -- Calculer le total de points déjà gagnés dans cette catégorie aujourd'hui
  SELECT COALESCE(SUM(points_earned), 0) INTO v_daily_total
  FROM daily_points_log
  WHERE member_id = p_member_id
    AND category = p_category
    AND log_date = CURRENT_DATE;

  -- Si le plafond est déjà atteint, retourner sans attribuer de points
  IF v_cap IS NOT NULL AND v_daily_total >= v_cap THEN
    RETURN jsonb_build_object(
      'awarded', 0,
      'cap_reached', true
    );
  END IF;

  -- Calculer les points restants disponibles dans le plafond
  -- Si pas de plafond (vote/challenge), on attribue la totalité demandée
  v_remaining := CASE
    WHEN v_cap IS NOT NULL THEN v_cap - v_daily_total
    ELSE p_points
  END;

  -- Ne jamais attribuer plus que ce qui est demandé
  v_awarded := LEAST(p_points, v_remaining);

  -- Enregistrer dans le journal quotidien des points
  -- UPSERT : si une entrée existe déjà pour ce membre/catégorie/jour, on cumule
  INSERT INTO daily_points_log (member_id, category, points_earned, log_date)
  VALUES (p_member_id, p_category, v_awarded, CURRENT_DATE)
  ON CONFLICT (member_id, category, log_date)
  DO UPDATE SET points_earned = daily_points_log.points_earned + v_awarded;

  -- Récupérer le niveau actuel avant mise à jour
  SELECT niveau INTO v_old_niveau
  FROM community_profiles
  WHERE member_id = p_member_id;

  -- Mettre à jour les points cosmiques du profil
  UPDATE community_profiles
  SET points_cosmiques = points_cosmiques + v_awarded,
      updated_at = now()
  WHERE member_id = p_member_id
  RETURNING points_cosmiques INTO v_new_total;

  -- Déterminer le nouveau niveau cosmique selon les seuils
  v_new_niveau := CASE
    WHEN v_new_total >= 5000 THEN 'univers'
    WHEN v_new_total >= 1500 THEN 'galaxie'
    WHEN v_new_total >= 500 THEN 'nebuleuse'
    WHEN v_new_total >= 100 THEN 'constellation'
    ELSE 'etoile'
  END;

  -- Mettre à jour le niveau si le membre a progressé
  IF v_new_niveau != v_old_niveau THEN
    UPDATE community_profiles
    SET niveau = v_new_niveau,
        updated_at = now()
    WHERE member_id = p_member_id;
  END IF;

  -- Retourner le résultat détaillé
  RETURN jsonb_build_object(
    'awarded', v_awarded,
    'new_total', v_new_total,
    'cap_reached', v_cap IS NOT NULL AND (v_daily_total + v_awarded) >= v_cap,
    'level_up', v_new_niveau != v_old_niveau,
    'new_niveau', v_new_niveau
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaire sur la fonction pour documentation PostgreSQL
COMMENT ON FUNCTION award_points(UUID, VARCHAR, INTEGER) IS
  'Attribue des points cosmiques à un membre avec plafonds quotidiens et détection de niveau. SECURITY DEFINER pour bypass RLS.';
