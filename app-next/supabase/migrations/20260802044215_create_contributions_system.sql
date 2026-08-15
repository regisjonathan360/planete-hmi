-- NOTE: Migration rendue sans-effet volontairement.
-- Le contenu est un doublon exact de 20260728233359_create_contributions_system.sql
-- (tables contributions, contribution_status_history, contribution_rate_limits,
--  fonctions consume_contribution_rate_limit / review_contribution, RLS, grants,
--  bucket storage). Les deux versions étant déjà enregistrées dans l'historique
-- des migrations distantes, celle-ci ne fait rien pour permettre un reset
-- from scratch de la base locale.

select 1;