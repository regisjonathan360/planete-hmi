-- =========================================================
-- Planète HMI — Module TikTok Charts : tables dédiées
-- tiktok_videos, tiktok_sounds, tiktok_featured_shorts
-- Contraintes UNIQUE, CHECK, FK, index, et politiques RLS.
-- =========================================================

-- ---------- Table : tiktok_sounds ----------
-- Stocke les données agrégées par son musical TikTok.
create table tiktok_sounds (
  id uuid primary key default gen_random_uuid(),
  music_id text unique not null,
  sound_title text not null,
  sound_author text,
  total_videos integer not null default 0,
  total_views bigint not null default 0,
  total_likes bigint not null default 0,
  total_comments bigint not null default 0,
  total_shares bigint not null default 0,
  unique_creators integer not null default 0,
  score numeric(12,4) not null default 0,
  growth_7d numeric(8,4) not null default 0,
  previous_total_videos integer,
  previous_snapshot_at timestamptz,
  validation_status text not null default 'a_verifier'
    check (validation_status in ('a_verifier', 'valide', 'refuse')),
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  artist_id uuid references artists (id) on delete set null
);

comment on table tiktok_sounds is 'Sons TikTok agrégés avec métriques et score composite pour les classements.';
comment on column tiktok_sounds.music_id is 'Identifiant unique du son sur TikTok.';
comment on column tiktok_sounds.validation_status is 'Statut de validation admin : a_verifier (défaut), valide, refuse.';
comment on column tiktok_sounds.score is 'Score composite calculé par le Score Engine (pondéré, normalisé).';
comment on column tiktok_sounds.growth_7d is 'Croissance en pourcentage sur 7 jours du nombre de publications.';
comment on column tiktok_sounds.previous_total_videos is 'Snapshot du total_videos il y a 7 jours pour calcul de croissance.';

-- Index sur tiktok_sounds
create index tiktok_sounds_validation_status_idx on tiktok_sounds (validation_status);
create index tiktok_sounds_score_idx on tiktok_sounds (score desc);
create index tiktok_sounds_growth_7d_idx on tiktok_sounds (growth_7d desc);
create index tiktok_sounds_first_seen_at_idx on tiktok_sounds (first_seen_at desc);
create index tiktok_sounds_artist_id_idx on tiktok_sounds (artist_id) where artist_id is not null;

-- ---------- Table : tiktok_videos ----------
-- Stocke les données brutes de chaque vidéo TikTok collectée.
create table tiktok_videos (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,
  music_id text not null references tiktok_sounds (music_id) on delete cascade,
  username text not null,
  create_time timestamptz not null,
  region_code text,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  share_count bigint not null default 0,
  hashtag_names text[] not null default '{}',
  video_description text,
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table tiktok_videos is 'Données brutes des vidéos TikTok collectées via l''API Research.';
comment on column tiktok_videos.video_id is 'Identifiant unique de la vidéo sur TikTok.';
comment on column tiktok_videos.music_id is 'Référence au son utilisé dans la vidéo (FK → tiktok_sounds.music_id).';

-- Index sur tiktok_videos
create index tiktok_videos_music_id_idx on tiktok_videos (music_id);
create index tiktok_videos_username_idx on tiktok_videos (username);
create index tiktok_videos_create_time_idx on tiktok_videos (create_time desc);
create index tiktok_videos_collected_at_idx on tiktok_videos (collected_at desc);
create index tiktok_videos_region_code_idx on tiktok_videos (region_code) where region_code is not null;

-- ---------- Table : tiktok_featured_shorts ----------
-- Vidéos sélectionnées pour la section HMI Shorts de la homepage.
create table tiktok_featured_shorts (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references tiktok_videos (video_id) on delete cascade,
  music_id text not null references tiktok_sounds (music_id) on delete cascade,
  display_order integer not null,
  selected_at timestamptz not null default now(),
  selected_by uuid references auth.users (id) on delete set null
);

comment on table tiktok_featured_shorts is 'Vidéos TikTok mises en avant sur la homepage (section HMI Shorts, max 10).';
comment on column tiktok_featured_shorts.display_order is 'Ordre d''affichage sur la homepage (1 = premier).';

-- Index sur tiktok_featured_shorts
create index tiktok_featured_shorts_display_order_idx on tiktok_featured_shorts (display_order);
create index tiktok_featured_shorts_video_id_idx on tiktok_featured_shorts (video_id);
create index tiktok_featured_shorts_music_id_idx on tiktok_featured_shorts (music_id);

-- ---------- Trigger updated_at pour tiktok_videos ----------
create trigger trg_tiktok_videos_updated before update on tiktok_videos
  for each row execute function set_updated_at();

-- ---------- Trigger last_updated_at pour tiktok_sounds ----------
create or replace function set_last_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

create trigger trg_tiktok_sounds_updated before update on tiktok_sounds
  for each row execute function set_last_updated_at();

-- =========================================================
-- Row Level Security (RLS)
-- Politique : écriture interdite au public, service_role a accès complet.
-- Le service_role bypass la RLS par défaut dans Supabase.
-- =========================================================

-- Activer la RLS sur les 3 tables
alter table tiktok_videos          enable row level security;
alter table tiktok_sounds          enable row level security;
alter table tiktok_featured_shorts enable row level security;

-- Lecture admin (is_admin) + écriture admin
create policy "admin manage tiktok_videos"
  on tiktok_videos for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin manage tiktok_sounds"
  on tiktok_sounds for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin manage tiktok_featured_shorts"
  on tiktok_featured_shorts for all
  using (public.is_admin())
  with check (public.is_admin());

-- Pas de politique SELECT publique sur tiktok_videos / tiktok_sounds :
-- les données publiques sont servies via chart_published_snapshots.
-- Aucun GRANT SELECT public n'est accordé sur ces tables.

-- =========================================================
-- Notes :
-- • Le service_role (utilisé par les API routes serveur) bypass la RLS.
-- • Les utilisateurs anon/authenticated n'ont aucun accès à ces tables.
-- • Les classements publiés sont exposés via chart_published_snapshots (existant).
-- =========================================================
