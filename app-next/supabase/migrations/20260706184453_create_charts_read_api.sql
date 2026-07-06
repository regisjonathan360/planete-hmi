-- =========================================================
-- Planète HMI — API de lecture publique agrégée (published only)
-- Vue détaillée + fonctions renvoyant du JSON pour les pages publiques.
-- =========================================================

-- Vue : entrées publiées, enrichies (titre, artistes principaux, source, édition).
create or replace view chart_public_entries
with (security_invoker = true) as
select
  ce.id                    as entry_id,
  cs.source_key,
  cs.platform,
  cs.display_name          as source_display_name,
  cs.chart_context,
  cs.market_code,
  cs.ingestion_mode,
  cs.is_automatic,
  e.id                     as edition_id,
  e.period_start,
  e.period_end,
  e.published_at,
  e.source_updated_at,
  e.is_stale,
  ce.filtered_position,
  ce.source_position,
  ce.previous_filtered_position,
  ce.peak_filtered_position,
  ce.weeks_on_chart,
  ce.consecutive_weeks,
  ce.movement,
  ce.entry_status,
  ce.metric_value,
  ce.metric_unit,
  t.id                     as track_id,
  t.title                  as track_title,
  t.default_artwork_url,
  coalesce(pt.external_url, null) as platform_url,
  coalesce(pt.artwork_url, t.default_artwork_url) as artwork_url,
  (
    select string_agg(a.name, ', ' order by ta.billing_order)
    from track_artists ta
    join artists a on a.id = ta.artist_id
    where ta.track_id = t.id and ta.role in ('primary','co_primary')
  ) as artists_text
from chart_entries ce
join chart_editions e on e.id = ce.chart_edition_id and e.status = 'published'
join chart_sources cs on cs.id = e.chart_source_id
join tracks t on t.id = ce.track_id
left join platform_tracks pt on pt.id = ce.platform_track_id;

comment on view chart_public_entries is 'Entrées de classements publiées, enrichies. security_invoker => RLS des tables de base appliquée.';

-- Dernière édition publiée par source (aide interne).
create or replace function latest_published_edition(p_source_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from chart_editions e
  where e.chart_source_id = p_source_id and e.status = 'published'
  order by e.period_start desc
  limit 1;
$$;

-- Aperçu : pour chaque source active, la dernière édition publiée + Top N.
create or replace function get_chart_overview(p_limit int default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(src)::jsonb order by src.ordre), '[]'::jsonb)
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
      e.id            as edition_id,
      e.period_start,
      e.period_end,
      e.published_at,
      e.source_updated_at,
      e.is_stale,
      e.entry_count,
      (
        select coalesce(jsonb_agg(row_to_json(ent)::jsonb order by ent.filtered_position), '[]'::jsonb)
        from (
          select cpe.filtered_position, cpe.source_position, cpe.movement,
                 cpe.entry_status, cpe.metric_value, cpe.metric_unit,
                 cpe.track_id, cpe.track_title, cpe.artists_text,
                 cpe.artwork_url, cpe.platform_url,
                 cpe.peak_filtered_position, cpe.weeks_on_chart
          from chart_public_entries cpe
          where cpe.edition_id = e.id and cpe.filtered_position <= p_limit
        ) ent
      ) as entries
    from chart_sources cs
    left join lateral (
      select * from chart_editions ce2
      where ce2.chart_source_id = cs.id and ce2.status = 'published'
      order by ce2.period_start desc limit 1
    ) e on true
    where cs.is_enabled = true
  ) src;
$$;

-- Top complet d'une plateforme (édition la plus récente par défaut, ou précise).
create or replace function get_platform_chart(p_source_key text, p_limit int default 20, p_edition uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cible as (
    select cs.id as source_id, cs.*,
           coalesce(p_edition, latest_published_edition(cs.id)) as edition_id
    from chart_sources cs
    where cs.source_key = p_source_key and cs.is_enabled = true
  )
  select case when (select edition_id from cible) is null then null
  else (
    select jsonb_build_object(
      'source_key', c.source_key,
      'platform', c.platform,
      'display_name', c.display_name,
      'chart_context', c.chart_context,
      'market_code', c.market_code,
      'ingestion_mode', c.ingestion_mode,
      'is_automatic', c.is_automatic,
      'edition', (
        select jsonb_build_object(
          'edition_id', e.id, 'period_start', e.period_start, 'period_end', e.period_end,
          'published_at', e.published_at, 'source_updated_at', e.source_updated_at,
          'is_stale', e.is_stale, 'entry_count', e.entry_count)
        from chart_editions e where e.id = c.edition_id
      ),
      'entries', (
        select coalesce(jsonb_agg(row_to_json(ent)::jsonb order by ent.filtered_position), '[]'::jsonb)
        from (
          select cpe.filtered_position, cpe.source_position, cpe.movement,
                 cpe.entry_status, cpe.metric_value, cpe.metric_unit,
                 cpe.track_id, cpe.track_title, cpe.artists_text,
                 cpe.artwork_url, cpe.platform_url,
                 cpe.peak_filtered_position, cpe.weeks_on_chart, cpe.consecutive_weeks
          from chart_public_entries cpe
          where cpe.edition_id = c.edition_id and cpe.filtered_position <= p_limit
        ) ent
      )
    )
    from cible c
  ) end;
$$;

grant execute on function get_chart_overview(int) to anon, authenticated;
grant execute on function get_platform_chart(text, int, uuid) to anon, authenticated;
grant select on chart_public_entries to anon, authenticated;
