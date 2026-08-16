-- Retire uniquement les liens de pages (YouTube/Spotify/Audiomack/Deezer)
-- des playlists radio. Ces URLs décrivent une chanson, mais ne sont pas une
-- source que HTMLAudioElement peut lire. Les données de classement restent
-- intactes et les fichiers/URLs audio directs ne sont pas touchés.

delete from public.radio_playlist_tracks rpt
using public.radio_tracks rt
where rt.id = rpt.track_id
  and (
    nullif(trim(rt.audio_url), '') is null
    or position('youtube.com' in lower(rt.audio_url)) > 0
    or position('youtu.be' in lower(rt.audio_url)) > 0
    or position('spotify.com' in lower(rt.audio_url)) > 0
    or position('audiomack.com' in lower(rt.audio_url)) > 0
    or position('deezer.com' in lower(rt.audio_url)) > 0
    or lower(rt.audio_url) like '%.html'
    or lower(rt.audio_url) like '%.html?%'
    or lower(rt.audio_url) like '%.php'
    or lower(rt.audio_url) like '%.php?%'
  );

update public.radio_tracks
set is_active = false,
    updated_at = now()
where nullif(trim(audio_url), '') is null
   or position('youtube.com' in lower(audio_url)) > 0
   or position('youtu.be' in lower(audio_url)) > 0
   or position('spotify.com' in lower(audio_url)) > 0
   or position('audiomack.com' in lower(audio_url)) > 0
   or position('deezer.com' in lower(audio_url)) > 0
   or lower(audio_url) like '%.html'
   or lower(audio_url) like '%.html?%'
   or lower(audio_url) like '%.php'
   or lower(audio_url) like '%.php?%';

update public.radio_config c
set active_playlist_id = null,
    auto_switch_to_chart = false,
    chart_source_key = null,
    is_live = false,
    updated_at = now()
where c.active_playlist_id is not null
  and not exists (
    select 1
    from public.radio_playlist_tracks rpt
    join public.radio_tracks rt on rt.id = rpt.track_id
    where rpt.playlist_id = c.active_playlist_id
      and rt.is_active = true
      and nullif(trim(rt.audio_url), '') is not null
      and position('youtube.com' in lower(rt.audio_url)) = 0
      and position('youtu.be' in lower(rt.audio_url)) = 0
      and position('spotify.com' in lower(rt.audio_url)) = 0
      and position('audiomack.com' in lower(rt.audio_url)) = 0
      and position('deezer.com' in lower(rt.audio_url)) = 0
      and lower(rt.audio_url) not like '%.html'
      and lower(rt.audio_url) not like '%.html?%'
      and lower(rt.audio_url) not like '%.php'
      and lower(rt.audio_url) not like '%.php?%'
  );
