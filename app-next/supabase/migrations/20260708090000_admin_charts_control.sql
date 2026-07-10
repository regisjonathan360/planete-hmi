-- =========================================================
-- Planète HMI — Contrôle administrateur des classements
-- Ajoute la couche d'édition manuelle, l'historique de positions,
-- et l'isolation brouillon / publié via des snapshots figés.
--
-- Principe :
--   * chart_entries = COPIE DE TRAVAIL (brouillon), toujours éditable.
--   * chart_published_snapshots = VERSION PUBLIÉE FIGÉE lue par le site public.
--   * Le public ne voit jamais un brouillon : il lit uniquement le dernier
--     snapshot publié de chaque source.
-- Multi-plateforme : tout est indexé par chart_sources.platform, donc le
-- même mécanisme servira YouTube, Apple Music, Spotify, etc.
-- =========================================================

-- ---------- Colonnes d'édition manuelle sur chart_entries ----------
alter table chart_entries add column if not exists is_hidden boolean not null default false;
alter table chart_entries add column if not exists is_excluded boolean not null default false;
alter table chart_entries add column if not exists admin_position integer;
alter table chart_entries add column if not exists display_title text;
alter table chart_entries add column if not exists display_artist text;
alter table chart_entries add column if not exists display_artwork_url text;
alter table chart_entries add column if not exists display_url text;
alter table chart_entries add column if not exists exclusion_reason text;

comment on column chart_entries.is_hidden is 'Masqué par l''admin : conservé mais absent du classement public.';
comment on column chart_entries.is_excluded is 'Retiré par l''admin (ex. artiste non haïtien) : ne compte pas dans les positions.';
comment on column chart_entries.admin_position is 'Ordre manuel imposé par l''admin (null = ordre source Audiomack).';
comment on column chart_entries.display_title is 'Titre corrigé par l''admin (override de tracks.title).';
comment on column chart_entries.display_artist is 'Nom d''artiste corrigé par l''admin (override).';
comment on column chart_entries.display_artwork_url is 'Cover corrigée par l''admin (override).';
comment on column chart_entries.display_url is 'Lien Audiomack corrigé par l''admin (override).';

-- ---------- État de publication sur chart_editions ----------
alter table chart_editions add column if not exists has_unpublished_changes boolean not null default true;
alter table chart_editions add column if not exists last_published_at timestamptz;

comment on column chart_editions.has_unpublished_changes is 'Vrai si des modifications brouillon ne sont pas encore publiées.';

-- ---------- Historique simple des positions ----------
create table if not exists chart_entry_history (
  id uuid primary key default gen_random_uuid(),
  chart_edition_id uuid references chart_editions (id) on delete cascade,
  chart_entry_id uuid,
  track_id uuid,
  old_position integer,
  new_position integer,
  action text not null,          -- collect | reorder | hide | unhide | exclude | delete | edit | publish | restore | cancel
  source text not null default 'audiomack',
  is_manual boolean not null default true,
  note text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index if not exists chart_entry_history_edition_idx
  on chart_entry_history (chart_edition_id, changed_at desc);

comment on table chart_entry_history is 'Journal simple : ancienne position, nouvelle position, date, source, manuel.';

-- ---------- Snapshots publiés (version figée lue par le public) ----------
create table if not exists chart_published_snapshots (
  id uuid primary key default gen_random_uuid(),
  chart_source_id uuid not null references chart_sources (id) on delete cascade,
  source_key text not null,
  edition_id uuid references chart_editions (id) on delete set null,
  platform text not null,
  period_start timestamptz,
  period_end timestamptz,
  is_stale boolean not null default false,
  payload jsonb not null,          -- vue publique figée (forme PlatformChart)
  editable_state jsonb,            -- état admin figé, pour « Restaurer »
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_key)
);
create index if not exists chart_published_snapshots_source_idx
  on chart_published_snapshots (source_key);

comment on table chart_published_snapshots is 'Dernière version publiée par source. Le site public lit uniquement ceci.';

-- ---------- Trigger : marquer l'édition comme modifiée ----------
create or replace function mark_edition_dirty()
returns trigger
language plpgsql
as $$
declare
  v_edition uuid;
begin
  v_edition := coalesce(new.chart_edition_id, old.chart_edition_id);
  if v_edition is not null then
    update chart_editions
      set has_unpublished_changes = true
      where id = v_edition;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_chart_entries_dirty on chart_entries;
create trigger trg_chart_entries_dirty
  after insert or update or delete on chart_entries
  for each row execute function mark_edition_dirty();

-- ---------- RLS ----------
alter table chart_entry_history enable row level security;
alter table chart_published_snapshots enable row level security;

-- Admin : accès complet à l'historique.
create policy "admin manage chart_entry_history"
  on chart_entry_history for all
  using (public.is_admin()) with check (public.is_admin());

-- Snapshots : lecture publique, écriture admin.
create policy "public read published snapshots"
  on chart_published_snapshots for select using (true);
create policy "admin manage published snapshots"
  on chart_published_snapshots for all
  using (public.is_admin()) with check (public.is_admin());

grant select on chart_published_snapshots to anon, authenticated;

-- ---------- API de lecture publique basée snapshot ----------

-- Top complet publié d'une plateforme (depuis le snapshot figé).
create or replace function get_published_platform_chart(p_source_key text, p_limit int default 20)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.payload is null then null
    else jsonb_set(
      s.payload,
      '{entries}',
      (
        select coalesce(jsonb_agg(e order by (e->>'filtered_position')::int), '[]'::jsonb)
        from jsonb_array_elements(coalesce(s.payload->'entries','[]'::jsonb)) e
        where (e->>'filtered_position')::int <= p_limit
      )
    )
  end
  from chart_published_snapshots s
  where s.source_key = p_source_key
  limit 1;
$$;

-- Aperçu publié : une entrée par source active ayant un snapshot.
create or replace function get_published_overview(p_limit int default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(o)::jsonb order by o.ordre), '[]'::jsonb)
  from (
    select
      cs.source_key,
      cs.platform,
      cs.display_name,
      cs.chart_context,
      cs.market_code,
      cs.ingestion_mode,
      cs.is_automatic,
      case cs.platform
        when 'youtube' then 1 when 'spotify' then 2 when 'audiomack' then 3
        when 'apple_music' then 4 when 'tiktok' then 5 else 6 end as ordre,
      s.edition_id,
      s.period_start,
      s.period_end,
      s.published_at,
      (s.payload->'edition'->>'source_updated_at') as source_updated_at,
      s.is_stale,
      coalesce(jsonb_array_length(s.payload->'entries'), 0) as entry_count,
      (
        select coalesce(jsonb_agg(e order by (e->>'filtered_position')::int), '[]'::jsonb)
        from jsonb_array_elements(coalesce(s.payload->'entries','[]'::jsonb)) e
        where (e->>'filtered_position')::int <= p_limit
      ) as entries
    from chart_sources cs
    join chart_published_snapshots s on s.source_key = cs.source_key
    where cs.is_enabled = true
  ) o;
$$;

grant execute on function get_published_platform_chart(text, int) to anon, authenticated;
grant execute on function get_published_overview(int) to anon, authenticated;
