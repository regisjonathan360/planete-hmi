-- =========================================================
-- Planète HMI — Instantanés de collecte : droits d'écriture manquants
--
-- `chart_snapshots` et `chart_snapshot_entries` n'avaient de GRANT que pour
-- anon et authenticated, en SELECT. Toute écriture côté serveur échouait donc
-- en « permission denied », et silencieusement : les routes de collecte
-- ignoraient la valeur de retour de saveSnapshot. Résultat, aucun instantané
-- n'a jamais été enregistré, ni pour Audiomack, ni pour Deezer.
--
-- L'écriture est accordée au seul rôle serveur. La lecture publique reste
-- gouvernée par les policies RLS existantes.
-- =========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_snapshot_entries TO service_role;
