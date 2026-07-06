-- =========================================================
-- Planète HMI — Orchestration Supabase Cron (pg_cron + pg_net)
--
-- Semaine canonique Planète HMI :
--   vendredi 00:00 UTC → jeudi 23:59:59 UTC
--
-- Programmation :
--   Vendredi 00:30 UTC  – collecte automatique (sources API)
--   Samedi   06:00 UTC  – retry + marquage périmé
--   Lundi    12:00 UTC  – publication_time par défaut
--     (configurable: publication_day, publication_time, publication_timezone)
--
-- Les Edge Functions sont appelées via pg_net (HTTP local).
-- Le plan gratuit a une durée max par fonction : on appelle séparément chaque
-- source (petits lots, pas de fonction monolithique).
-- =========================================================

-- Table de configuration de publication.
create table if not exists chart_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into chart_config (key, value) values
  ('publication_day', 'Monday'),
  ('publication_time', '08:00'),
  ('publication_timezone', 'America/Port-au-Prince')
on conflict (key) do nothing;

-- Note : pg_cron et pg_net ne sont disponibles que sur Supabase Cloud (pas en
-- local). Les commandes cron.schedule ci-dessous sont commentées pour le dev
-- local. Sur Supabase Cloud, exécuter ce bloc manuellement ou via Dashboard.

/*
-- Vendredi 00:30 UTC : collecte automatique (YouTube video stats + Apple Music)
select cron.schedule('collect-youtube-video-stats', '30 0 * * 5',
  $$select net.http_post(
    'http://supabase_edge_runtime_app-next:8081/functions/v1/collect-youtube-video-stats',
    '{}'::jsonb, headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  )$$
);

select cron.schedule('collect-apple-music-chart', '35 0 * * 5',
  $$select net.http_post(
    'http://supabase_edge_runtime_app-next:8081/functions/v1/collect-apple-music-chart',
    '{}'::jsonb, headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  )$$
);

-- Samedi 06:00 UTC : retry + marquage périmé
select cron.schedule('retry-failed-chart-runs', '0 6 * * 6',
  $$select net.http_post(
    'http://supabase_edge_runtime_app-next:8081/functions/v1/retry-failed-chart-runs',
    '{}'::jsonb, headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  )$$
);

select cron.schedule('mark-stale-chart-editions', '10 6 * * 6',
  $$select net.http_post(
    'http://supabase_edge_runtime_app-next:8081/functions/v1/mark-stale-chart-editions',
    '{}'::jsonb, headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  )$$
);
*/
