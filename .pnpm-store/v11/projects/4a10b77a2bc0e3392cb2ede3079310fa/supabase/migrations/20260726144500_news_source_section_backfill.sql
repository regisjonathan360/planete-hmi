-- Articles de la collecte historique dont l'appartenance à la rubrique
-- Chokarella / Musique a été confirmée. Les autres lignes restent intactes,
-- sans source_section, et sont donc masquées jusqu'à une nouvelle confirmation.

update public.news_articles
set
  source_section = 'musique',
  source_section_verified_at = now()
where source_url in (
  'https://www.chokarella.com/2026/07/21/deezer-detecte-pres-de-90-000-morceaux-generes-par-ia-chaque-jour-sur-sa-plateforme/',
  'https://www.chokarella.com/2026/07/21/pm-music-et-mgck-devoilent-une-nouvelle-version-de-badwun/',
  'https://www.chokarella.com/2026/07/21/naika-revisite-one-track-mind-avec-jessie-reyez/',
  'https://www.chokarella.com/2026/07/22/bic-tizon-dife-fait-entrer-adrienne-de-tropicana-dans-lere-drill/',
  'https://www.chokarella.com/2026/07/23/niko-et-steves-j-bryan-se-rencontrent-sur-freche/',
  'https://www.chokarella.com/2026/07/24/francis-mercier-presente-son-album-lakay-lors-dune-soiree-a-new-york/',
  'https://www.chokarella.com/2026/07/25/chale-atys-panch-et-lilobeatz-livrent-un-son-aux-couleurs-estivales/',
  'https://www.chokarella.com/2026/07/25/haiku-fridayy-ouvre-un-nouveau-chapitre-avant-la-sortie-de-son-album-tension/',
  'https://www.chokarella.com/2026/07/25/rayhans-devoile-pa-pi-mal-son-nouveau-titre/'
);
