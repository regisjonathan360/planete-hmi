-- Bibliothèque éditoriale multi-plateforme pour la section HMI Shorts.
-- Les écritures passent exclusivement par les routes serveur administrateur.

create table if not exists public.hmi_shorts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  source_url text not null,
  external_id text,
  title text not null,
  creator_name text,
  thumbnail_url text,
  description text,
  display_order integer not null default 1,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hmi_shorts_platform_check
    check (platform in ('tiktok', 'instagram', 'youtube')),
  constraint hmi_shorts_source_url_check
    check (source_url ~ '^https://'),
  constraint hmi_shorts_display_order_check
    check (display_order between 1 and 100),
  constraint hmi_shorts_title_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint hmi_shorts_source_url_unique unique (source_url)
);

create index if not exists hmi_shorts_publication_order_idx
  on public.hmi_shorts (is_published, display_order, published_at desc);

drop trigger if exists trg_hmi_shorts_updated_at on public.hmi_shorts;
create trigger trg_hmi_shorts_updated_at
  before update on public.hmi_shorts
  for each row execute function public.set_updated_at();

alter table public.hmi_shorts enable row level security;

revoke all on table public.hmi_shorts from public, anon, authenticated;
grant all on table public.hmi_shorts to service_role;

comment on table public.hmi_shorts is
  'Shorts TikTok, Instagram et YouTube sélectionnés manuellement pour la page d’accueil.';
comment on column public.hmi_shorts.is_published is
  'Seuls les éléments publiés sont servis par la route publique HMI Shorts.';;
