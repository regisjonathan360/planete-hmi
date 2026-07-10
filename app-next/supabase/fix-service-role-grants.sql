-- Accorder tous les droits au service_role (utilisé par le backend admin).
-- Le service_role contourne la RLS, mais il a quand même besoin des GRANTs table.
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.artists TO service_role;
GRANT ALL ON public.tracks TO service_role;
GRANT ALL ON public.track_artists TO service_role;
GRANT ALL ON public.platform_tracks TO service_role;
GRANT ALL ON public.chart_sources TO service_role;
GRANT ALL ON public.chart_editions TO service_role;
GRANT ALL ON public.chart_entries TO service_role;
GRANT ALL ON public.chart_imports TO service_role;
GRANT ALL ON public.chart_match_queue TO service_role;
GRANT ALL ON public.sync_runs TO service_role;
GRANT ALL ON public.chart_audit_logs TO service_role;
GRANT ALL ON public.chart_snapshots TO service_role;
GRANT ALL ON public.chart_snapshot_entries TO service_role;
GRANT ALL ON public.chart_entry_history TO service_role;
GRANT ALL ON public.chart_published_snapshots TO service_role;
