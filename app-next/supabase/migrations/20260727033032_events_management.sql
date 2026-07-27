-- =========================================================
-- Planète HMI — Événements : sources et événements collectés
-- =========================================================

CREATE TABLE IF NOT EXISTS public.event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  base_url text NOT NULL,
  scrape_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES event_sources(id) ON DELETE RESTRICT,
  source_url text NOT NULL UNIQUE,
  source_title text NOT NULL,
  source_image_url text,
  source_date text,
  source_time text,
  source_location text,
  source_price text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  -- Champs éditoriaux
  display_title text,
  display_image_url text,
  display_description text,
  category text DEFAULT 'musique',
  -- État
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'rejected')),
  published_at timestamptz,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer,
  event_date timestamptz, -- date parsée pour tri
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_status_idx ON events (status, event_date DESC);
CREATE INDEX IF NOT EXISTS events_source_idx ON events (source_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_updated') THEN
    CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE event_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_published_events" ON events
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "admin_all_event_sources" ON event_sources
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_events" ON events
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed : Eventbrite Haiti Music
INSERT INTO event_sources (name, slug, base_url, scrape_url, is_active)
VALUES (
  'Eventbrite Haiti Music',
  'eventbrite-haiti-music',
  'https://www.eventbrite.fr',
  'https://www.eventbrite.fr/d/haiti/music--events/',
  true
)
ON CONFLICT (slug) DO NOTHING;
