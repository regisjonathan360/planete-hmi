-- =========================================================
-- Planète HMI — Actualités : sources et articles collectés
-- =========================================================

-- Sources d'actualités (ex: Chokarella, Loop Haiti, etc.)
CREATE TABLE IF NOT EXISTS public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  base_url text NOT NULL,
  scrape_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  scrape_selector text, -- CSS selector hint pour le scraper
  last_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Articles collectés
CREATE TABLE IF NOT EXISTS public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES news_sources(id) ON DELETE RESTRICT,
  -- Données collectées
  source_url text NOT NULL UNIQUE, -- URL de l'article original
  source_title text NOT NULL,
  source_image_url text,
  source_excerpt text,
  source_author text,
  source_date text, -- date telle que collectée (texte brut)
  collected_at timestamptz NOT NULL DEFAULT now(),
  -- Champs éditoriaux (modifiables par l'admin)
  display_title text, -- titre affiché (null = utilise source_title)
  display_image_url text, -- image personnalisée (null = utilise source_image_url)
  display_excerpt text, -- résumé personnalisé (null = utilise source_excerpt)
  category text DEFAULT 'musique',
  -- État de publication
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'rejected')),
  published_at timestamptz,
  -- Méta
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_articles_status_idx ON news_articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS news_articles_source_idx ON news_articles (source_id);
-- Trigger updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_news_articles_updated') THEN
    CREATE TRIGGER trg_news_articles_updated BEFORE UPDATE ON news_articles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
-- RLS
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
-- Public peut lire les articles publiés uniquement
CREATE POLICY "public_read_published_news" ON news_articles
  FOR SELECT TO anon, authenticated USING (status = 'published');
-- Admin (service_role bypass RLS)
CREATE POLICY "admin_all_news_sources" ON news_sources
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_news_articles" ON news_articles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Seed : source Chokarella
INSERT INTO news_sources (name, slug, base_url, scrape_url, is_active)
VALUES (
  'Chokarella',
  'chokarella',
  'https://www.chokarella.com',
  'https://www.chokarella.com/category/musique/',
  true
)
ON CONFLICT (slug) DO NOTHING;
