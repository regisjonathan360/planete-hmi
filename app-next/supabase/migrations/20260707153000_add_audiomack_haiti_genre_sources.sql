-- =========================================================
-- Planete HMI - Audiomack Haiti genre sources
-- Each Audiomack Haiti genre gets its own source_key so imports, history,
-- validation and publication stay separated.
-- =========================================================

insert into chart_sources (
  platform,
  source_key,
  display_name,
  chart_context,
  market_code,
  genre_id,
  ingestion_mode,
  source_url,
  is_enabled,
  is_automatic
) values
  ('audiomack','audiomack_haiti_weekly100','Audiomack - Weekly 100 Haiti','Top Songs Haiti - All','HT','all','VERIFIED_ADMIN_IMPORT','https://audiomack.com/geo-charts/playlist/haiti',true,false),
  ('audiomack','audiomack_haiti_top_songs_afrosounds','Audiomack - Haiti Afrosounds','Top Songs Haiti - Afrosounds','HT','afrosounds','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_hip_hop_rap','Audiomack - Haiti Hip-Hop/Rap','Top Songs Haiti - Hip-Hop/Rap','HT','hip-hop-rap','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_latin','Audiomack - Haiti Latin','Top Songs Haiti - Latin','HT','latin','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_jazz_blues','Audiomack - Haiti Jazz/Blues','Top Songs Haiti - Jazz/Blues','HT','jazz-blues','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_caribbean','Audiomack - Haiti Caribbean','Top Songs Haiti - Caribbean','HT','caribbean','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_pop','Audiomack - Haiti Pop','Top Songs Haiti - Pop','HT','pop','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_r_b','Audiomack - Haiti R&B','Top Songs Haiti - R&B','HT','r-b','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_gospel','Audiomack - Haiti Gospel','Top Songs Haiti - Gospel','HT','gospel','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_electronic','Audiomack - Haiti Electronic','Top Songs Haiti - Electronic','HT','electronic','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_rock','Audiomack - Haiti Rock','Top Songs Haiti - Rock','HT','rock','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_punjabi','Audiomack - Haiti Punjabi','Top Songs Haiti - Punjabi','HT','punjabi','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_country','Audiomack - Haiti Country','Top Songs Haiti - Country','HT','country','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_instrumental','Audiomack - Haiti Instrumental','Top Songs Haiti - Instrumental','HT','instrumental','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false),
  ('audiomack','audiomack_haiti_top_songs_podcast','Audiomack - Haiti Podcast','Top Haiti - Podcast','HT','podcast','VERIFIED_ADMIN_IMPORT','https://audiomack.com/charts',true,false)
on conflict (source_key) do update set
  display_name = excluded.display_name,
  chart_context = excluded.chart_context,
  market_code = excluded.market_code,
  genre_id = excluded.genre_id,
  ingestion_mode = excluded.ingestion_mode,
  source_url = excluded.source_url,
  is_enabled = excluded.is_enabled,
  is_automatic = excluded.is_automatic,
  updated_at = now();

create index if not exists chart_sources_platform_market_genre_idx
  on chart_sources (platform, market_code, genre_id);

create index if not exists artists_haitian_status_idx
  on artists (haitian_status);
