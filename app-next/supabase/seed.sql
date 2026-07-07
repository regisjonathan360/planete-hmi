-- =========================================================
-- Planète HMI — Données de DÉMONSTRATION (fictives)
-- Aucune donnée réelle, aucune donnée issue de GlobHaitian.
-- Sert au développement de l'UI et aux tests.
-- Semaine canonique : vendredi 00:00 UTC -> jeudi 23:59:59 UTC.
--   Semaine précédente : 2026-06-26 -> 2026-07-02
--   Semaine courante   : 2026-07-03 -> 2026-07-09
-- =========================================================

-- ---------- Sources (les 6 source_key du module) ----------
insert into chart_sources (id, platform, source_key, display_name, chart_context, market_code, ingestion_mode, is_enabled, is_automatic) values
  ('11111111-0000-0000-0000-000000000001','youtube','youtube_haiti_official','YouTube Music — Haïti','Chansons populaires en Haïti','HT','VERIFIED_ADMIN_IMPORT',true,false),
  ('11111111-0000-0000-0000-000000000002','youtube','youtube_hmi_weekly_delta','YouTube HMI — Vues gagnées en 7 jours','Vues mondiales gagnées en 7 jours',null,'OFFICIAL_API',true,true),
  ('11111111-0000-0000-0000-000000000003','spotify','spotify_haiti_popular','Spotify — Populaire en Haïti','Populaire en Haïti','HT','VERIFIED_ADMIN_IMPORT',true,false),
  ('11111111-0000-0000-0000-000000000004','audiomack','audiomack_haiti_weekly100','Audiomack — Weekly 100 Haiti','Weekly 100 Haiti','HT','VERIFIED_ADMIN_IMPORT',true,false),
  ('11111111-0000-0000-0000-000000000005','apple_music','apple_hmi_worldwide','Apple Music — HMI Worldwide','Présence internationale (Worldwide)',null,'OFFICIAL_API',true,true),
  ('11111111-0000-0000-0000-000000000006','tiktok','tiktok_haiti_sounds','TikTok — Sons populaires en Haïti','Sons populaires en Haïti','HT','VERIFIED_ADMIN_IMPORT',true,false);

-- ---------- Sources Audiomack Haiti par genre ----------
insert into chart_sources (platform, source_key, display_name, chart_context, market_code, genre_id, ingestion_mode, source_url, is_enabled, is_automatic) values
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
  is_automatic = excluded.is_automatic;

-- ---------- Artistes (fictifs) ----------
insert into artists (id, name, slug, haitian_status, country_code, verified_at) values
  ('22222222-0000-0000-0000-000000000001','Artiste Test HMI Un','artiste-test-hmi-un','verified_haitian','HT', now()),
  ('22222222-0000-0000-0000-000000000002','Artiste Test HMI Deux','artiste-test-hmi-deux','verified_haitian_diaspora','US', now()),
  ('22222222-0000-0000-0000-000000000003','Groupe Test HMI','groupe-test-hmi','verified_haitian_group','HT', now()),
  ('22222222-0000-0000-0000-000000000004','Foreign Test Artist','foreign-test-artist','insufficient_evidence','FR', null);

-- ---------- Chansons (fictives) ----------
insert into tracks (id, title, normalized_title, isrc, release_date, default_artwork_url) values
  ('33333333-0000-0000-0000-000000000001','Chanson Test A','chanson test a','TESTA0000001','2026-05-01',null),
  ('33333333-0000-0000-0000-000000000002','Chanson Test B','chanson test b','TESTB0000001','2026-05-10',null),
  ('33333333-0000-0000-0000-000000000003','Chanson Test C','chanson test c','TESTC0000001','2026-06-01',null),
  ('33333333-0000-0000-0000-000000000004','Chanson Test D','chanson test d','TESTD0000001','2026-06-20',null),
  ('33333333-0000-0000-0000-0000000000ff','Foreign Test Song','foreign test song','FORGN0000001','2026-04-01',null);

-- ---------- Crédits (rôles) ----------
insert into track_artists (track_id, artist_id, role, billing_order) values
  ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','primary',0),
  ('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','primary',0),
  ('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000003','primary',0),
  ('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','primary',0),
  -- La chanson étrangère a un artiste haïtien seulement en featured (NON admissible au top principal)
  ('33333333-0000-0000-0000-0000000000ff','22222222-0000-0000-0000-000000000004','primary',0),
  ('33333333-0000-0000-0000-0000000000ff','22222222-0000-0000-0000-000000000001','featured',1);

-- ---------- Éditions Spotify : précédente + courante (publiées) ----------
insert into chart_editions (id, chart_source_id, edition_key, period_start, period_end, source_updated_at, collected_at, validated_at, published_at, status, entry_count, is_stale) values
  ('44444444-0000-0000-0000-0000000000a1','11111111-0000-0000-0000-000000000003','spotify-2026-W26','2026-06-26T00:00:00Z','2026-07-02T23:59:59Z','2026-07-03T02:00:00Z','2026-07-03T05:00:00Z','2026-07-05T12:00:00Z','2026-07-06T12:00:00Z','published',3,false),
  ('44444444-0000-0000-0000-0000000000a2','11111111-0000-0000-0000-000000000003','spotify-2026-W27','2026-07-03T00:00:00Z','2026-07-09T23:59:59Z','2026-07-10T02:00:00Z','2026-07-10T05:00:00Z','2026-07-12T12:00:00Z','2026-07-13T12:00:00Z','published',3,false);

-- Entrées édition précédente (W26) : A#1, B#2, C#3 (positions source 2,3,5 : #1 et #4 étaient étrangers)
insert into chart_entries (chart_edition_id, track_id, source_position, filtered_position, previous_filtered_position, peak_filtered_position, weeks_on_chart, consecutive_weeks, movement, entry_status, metric_value, metric_unit) values
  ('44444444-0000-0000-0000-0000000000a1','33333333-0000-0000-0000-000000000001',2,1,null,1,1,1,null,'new',null,null),
  ('44444444-0000-0000-0000-0000000000a1','33333333-0000-0000-0000-000000000002',3,2,null,2,1,1,null,'new',null,null),
  ('44444444-0000-0000-0000-0000000000a1','33333333-0000-0000-0000-000000000003',5,3,null,3,1,1,null,'new',null,null);

-- Entrées édition courante (W27) : B monte #1, A descend #2, D nouvelle #3 (C sort)
insert into chart_entries (chart_edition_id, track_id, source_position, filtered_position, previous_filtered_position, peak_filtered_position, weeks_on_chart, consecutive_weeks, movement, entry_status, metric_value, metric_unit) values
  ('44444444-0000-0000-0000-0000000000a2','33333333-0000-0000-0000-000000000002',1,1,2,1,2,2,1,'up',null,null),
  ('44444444-0000-0000-0000-0000000000a2','33333333-0000-0000-0000-000000000001',4,2,1,1,2,2,-1,'down',null,null),
  ('44444444-0000-0000-0000-0000000000a2','33333333-0000-0000-0000-000000000004',6,3,null,3,1,1,null,'new',null,null);

-- ---------- Édition TikTok courante (publiée) — métrique posts_count ----------
insert into chart_editions (id, chart_source_id, edition_key, period_start, period_end, source_updated_at, collected_at, validated_at, published_at, status, entry_count, is_stale) values
  ('44444444-0000-0000-0000-0000000000b1','11111111-0000-0000-0000-000000000006','tiktok-2026-W27','2026-07-03T00:00:00Z','2026-07-09T23:59:59Z','2026-07-10T02:00:00Z','2026-07-10T05:00:00Z','2026-07-12T12:00:00Z','2026-07-13T12:00:00Z','published',2,false);
insert into chart_entries (chart_edition_id, track_id, source_position, filtered_position, peak_filtered_position, weeks_on_chart, consecutive_weeks, entry_status, metric_value, metric_unit) values
  ('44444444-0000-0000-0000-0000000000b1','33333333-0000-0000-0000-000000000001',1,1,1,1,1,'new',12400,'posts_count'),
  ('44444444-0000-0000-0000-0000000000b1','33333333-0000-0000-0000-000000000004',3,2,2,1,1,'new',8300,'posts_count');

-- ---------- Édition Audiomack périmée (test badge « Mise à jour en attente ») ----------
insert into chart_editions (id, chart_source_id, edition_key, period_start, period_end, source_updated_at, collected_at, validated_at, published_at, status, entry_count, is_stale) values
  ('44444444-0000-0000-0000-0000000000c1','11111111-0000-0000-0000-000000000004','audiomack-2026-W26','2026-06-26T00:00:00Z','2026-07-02T23:59:59Z','2026-07-03T02:00:00Z','2026-07-03T05:00:00Z','2026-07-05T12:00:00Z','2026-07-06T12:00:00Z','published',1,true);
insert into chart_entries (chart_edition_id, track_id, source_position, filtered_position, peak_filtered_position, weeks_on_chart, consecutive_weeks, entry_status) values
  ('44444444-0000-0000-0000-0000000000c1','33333333-0000-0000-0000-000000000003',1,1,1,1,1,'new');
