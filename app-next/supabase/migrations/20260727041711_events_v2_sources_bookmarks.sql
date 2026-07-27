-- =========================================================
-- Événements v2 : sources supplémentaires + signets utilisateur
-- =========================================================

-- Ajouter les nouvelles sources
INSERT INTO event_sources (name, slug, base_url, scrape_url, is_active) VALUES
  ('Bandsintown Port-au-Prince', 'bandsintown-pap', 'https://www.bandsintown.com', 'https://www.bandsintown.com/fr/c/port-au-prince-haiti', true),
  ('Eventbrite Port-au-Prince', 'eventbrite-pap', 'https://www.eventbrite.fr', 'https://www.eventbrite.fr/d/haiti--port-au-prince/event-in-haiti/', true),
  ('Chokarella Événements', 'chokarella-evenements', 'https://www.chokarella.com', 'https://www.chokarella.com/category/evenements/', true)
ON CONFLICT (slug) DO NOTHING;

-- Table des événements sauvegardés par les utilisateurs (signets/rubans)
CREATE TABLE IF NOT EXISTS public.saved_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS saved_events_user_idx ON saved_events (user_id, saved_at DESC);

ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur connecté peut lire/écrire/supprimer ses propres signets
CREATE POLICY "users_manage_own_saved_events" ON saved_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
