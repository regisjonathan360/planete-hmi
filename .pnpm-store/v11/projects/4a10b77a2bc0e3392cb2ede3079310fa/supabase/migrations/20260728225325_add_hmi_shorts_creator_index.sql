create index if not exists hmi_shorts_created_by_idx
  on public.hmi_shorts (created_by)
  where created_by is not null;;
