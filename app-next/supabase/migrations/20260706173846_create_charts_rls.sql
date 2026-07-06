-- =========================================================
-- Planète HMI — Module Classements : rôles + RLS
-- Lecture publique restreinte aux données PUBLIÉES.
-- Écriture réservée aux administrateurs (rôle app).
-- (La clé secrète/service role contourne la RLS côté serveur.)
-- =========================================================

-- ---------- Rôles applicatifs ----------
create table user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

comment on table user_roles is 'Attribution de rôles applicatifs (ex. admin) aux utilisateurs Supabase Auth.';

-- Détermine si l'utilisateur courant est administrateur.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  );
$$;

-- Détermine si une édition donnée est publiée (aide aux politiques de lecture).
create or replace function public.edition_is_published(edition uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chart_editions e
    where e.id = edition and e.status = 'published'
  );
$$;

-- ---------- Activer la RLS partout ----------
alter table artists            enable row level security;
alter table tracks             enable row level security;
alter table track_artists      enable row level security;
alter table platform_tracks    enable row level security;
alter table chart_sources      enable row level security;
alter table chart_editions     enable row level security;
alter table chart_entries      enable row level security;
alter table chart_imports      enable row level security;
alter table chart_match_queue  enable row level security;
alter table sync_runs          enable row level security;
alter table chart_audit_logs   enable row level security;
alter table user_roles         enable row level security;

-- =========================================================
-- LECTURE PUBLIQUE (anon + authenticated) — données publiées
-- =========================================================

-- Éditions publiées.
create policy "public read published editions"
  on chart_editions for select
  using (status = 'published');

-- Entrées d'éditions publiées.
create policy "public read entries of published editions"
  on chart_entries for select
  using (public.edition_is_published(chart_edition_id));

-- Sources actives (données de référence non sensibles).
create policy "public read enabled sources"
  on chart_sources for select
  using (is_enabled = true);

-- Chansons référencées par au moins une entrée publiée.
create policy "public read tracks in published entries"
  on tracks for select
  using (exists (
    select 1 from chart_entries ce
    where ce.track_id = tracks.id
      and public.edition_is_published(ce.chart_edition_id)
  ));

-- Artistes crédités sur une chanson publiée.
create policy "public read artists in published entries"
  on artists for select
  using (exists (
    select 1
    from track_artists ta
    join chart_entries ce on ce.track_id = ta.track_id
    where ta.artist_id = artists.id
      and public.edition_is_published(ce.chart_edition_id)
  ));

-- Liens chanson↔artiste des chansons publiées.
create policy "public read track_artists in published entries"
  on track_artists for select
  using (exists (
    select 1 from chart_entries ce
    where ce.track_id = track_artists.track_id
      and public.edition_is_published(ce.chart_edition_id)
  ));

-- Correspondances plateforme des chansons publiées.
create policy "public read platform_tracks in published entries"
  on platform_tracks for select
  using (exists (
    select 1 from chart_entries ce
    where ce.platform_track_id = platform_tracks.id
      and public.edition_is_published(ce.chart_edition_id)
  ));

-- =========================================================
-- ÉCRITURE / LECTURE COMPLÈTE — ADMINISTRATEURS
-- Une politique ALL par table, gouvernée par is_admin().
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array[
    'artists','tracks','track_artists','platform_tracks','chart_sources',
    'chart_editions','chart_entries','chart_imports','chart_match_queue',
    'sync_runs','chart_audit_logs'
  ]
  loop
    execute format(
      'create policy %I on %I for all using (public.is_admin()) with check (public.is_admin());',
      'admin manage ' || t, t
    );
  end loop;
end $$;

-- user_roles : lisible/gérable uniquement par les admins.
create policy "admin manage user_roles"
  on user_roles for all
  using (public.is_admin())
  with check (public.is_admin());

-- =========================================================
-- GRANTS de base (la RLS filtre ensuite les lignes)
-- anon + authenticated : SELECT sur les tables à lecture publique.
-- Les tables opérationnelles (imports, file de correspondance, sync_runs,
-- audit, user_roles) ne reçoivent AUCUN grant public : accès via le rôle
-- service (serveur/admin) uniquement.
-- =========================================================
grant usage on schema public to anon, authenticated;

grant select on
  chart_editions, chart_entries, chart_sources,
  tracks, artists, track_artists, platform_tracks
to anon, authenticated;
