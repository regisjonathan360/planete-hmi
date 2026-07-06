-- =========================================================
-- Planète HMI — Maintenance : semaine canonique + péremption
-- Semaine canonique : vendredi 00:00 UTC -> jeudi 23:59:59 UTC.
-- =========================================================

-- Début de la semaine canonique courante (dernier vendredi 00:00 UTC).
create or replace function current_canonical_week_start()
returns timestamptz
language sql
stable
as $$
  -- date_trunc('week') donne le lundi ; on décale pour obtenir le vendredi.
  select (date_trunc('week', (now() at time zone 'UTC')) - interval '3 days')::timestamptz;
$$;

-- Marque périmée la dernière édition publiée de chaque source active dont la
-- source n'a pas été actualisée pour la semaine courante. Conserve l'édition
-- (ne la duplique jamais). Retourne le nombre d'éditions marquées.
create or replace function mark_stale_editions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select distinct on (cs.id) e.id, e.source_updated_at
    from chart_sources cs
    join chart_editions e on e.chart_source_id = cs.id and e.status = 'published'
    where cs.is_enabled = true
    order by cs.id, e.period_start desc
  loop
    if r.source_updated_at is null or r.source_updated_at < current_canonical_week_start() then
      update chart_editions set is_stale = true where id = r.id and is_stale = false;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;
  return v_count;
end;
$$;

grant execute on function current_canonical_week_start() to service_role;
grant execute on function mark_stale_editions() to service_role;
