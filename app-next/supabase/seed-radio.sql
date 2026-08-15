-- Seed pour le système radio - DONNÉES RÉELLES UNIQUEMENT
-- Ce fichier ne crée QUE la configuration de base
-- Les pistes viennent uniquement de:
--   1. chart_editions (classements publiés)
--   2. radio_playlists (playlists manuelles créées par l'admin)

-- ✅ S'assurer qu'une configuration radio existe (si pas déjà présente)
INSERT INTO radio_config (
  preload_count, 
  crossfade_duration_ms, 
  is_live,
  auto_switch_to_chart,
  active_playlist_id,
  chart_source_key
)
SELECT 3, 2000, true, false, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM radio_config);

-- ✅ Vérification
SELECT 
  '✅ Radio configurée' as status,
  COUNT(*) as config_count,
  is_live,
  auto_switch_to_chart
FROM radio_config
GROUP BY is_live, auto_switch_to_chart;

-- 📝 Notes d'utilisation:
-- 1. Allez sur /admin/radio pour configurer la radio
-- 2. Sélectionnez un classement ou une playlist
-- 3. Cliquez "Appliquer cette source"
-- 4. La radio jouera les vraies pistes de votre base de données
-- 
-- ❌ AUCUNE DONNÉE FICTIVE - tout est réel ! 🎉
