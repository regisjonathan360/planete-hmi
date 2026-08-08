-- Conserver séparément la rubrique d'origine et la catégorie éditoriale.
-- La colonne category reste modifiable par l'administration.
-- source_section est une preuve de provenance écrite par le collecteur.

alter table public.news_articles
  add column if not exists source_section text,
  add column if not exists source_section_verified_at timestamptz;
create index if not exists news_articles_source_section_idx
  on public.news_articles (source_id, source_section, collected_at desc);
comment on column public.news_articles.source_section is
  'Rubrique confirmée sur le site source au moment de la collecte (ex: musique).';
comment on column public.news_articles.source_section_verified_at is
  'Date de la dernière confirmation de la rubrique par le collecteur.';
