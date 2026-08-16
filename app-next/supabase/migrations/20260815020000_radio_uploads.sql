-- Audio importé par l'administration radio.
-- Les fichiers sont stockés dans Supabase Storage et non dans la base.
insert into storage.buckets (id, name, public)
values ('radio-audio', 'radio-audio', true)
on conflict (id) do update set public = true;

drop policy if exists "Public radio audio" on storage.objects;
create policy "Public radio audio" on storage.objects for select
  using (bucket_id = 'radio-audio');

create index if not exists idx_radio_tracks_updated_at on public.radio_tracks(updated_at desc);

-- Les classements peuvent provenir de Deezer ou SoundCloud également.
alter table public.radio_tracks drop constraint if exists radio_tracks_source_check;
alter table public.radio_tracks add constraint radio_tracks_source_check
  check (source in ('manual', 'chart', 'youtube', 'audiomack', 'spotify', 'deezer', 'soundcloud'));

alter table public.platform_tracks add column if not exists preview_url text;
alter table public.platform_tracks add column if not exists audio_url text;
