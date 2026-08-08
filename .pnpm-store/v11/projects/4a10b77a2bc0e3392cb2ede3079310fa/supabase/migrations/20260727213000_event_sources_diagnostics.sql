-- =========================================================
-- Planète HMI — Sources d'événements : type de parseur et diagnostic
--
-- Constat : seule Chokarella était collectée. Les sources Eventbrite
-- échouaient parce que le parseur cherchait des liens `eventbrite.com` dans le
-- HTML alors que les pages FR exposent leurs événements en JSON-LD, et
-- Bandsintown répond HTTP 403 (Cloudflare) à toute requête serveur.
-- =========================================================

ALTER TABLE public.event_sources
  -- Parseur à utiliser. 'auto' = déduit de l'URL (comportement historique).
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'auto'
    CHECK (source_type IN ('auto', 'eventbrite', 'wordpress', 'bandsintown', 'jsonld')),
  -- Note éditoriale affichée en admin (pourquoi la source est active ou non).
  ADD COLUMN IF NOT EXISTS notes text,
  -- Dernière erreur rencontrée, pour diagnostiquer sans ouvrir les logs.
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_found_count integer;
COMMENT ON COLUMN public.event_sources.source_type IS
  'Famille de parseur (voir src/lib/events/scraper.ts). auto = déduction depuis l''URL.';
COMMENT ON COLUMN public.event_sources.last_error IS
  'Message de la dernière collecte en échec. Remis à NULL dès qu''une collecte réussit.';
-- ---------- Typage des sources existantes ----------

UPDATE public.event_sources
SET source_type = 'eventbrite'
WHERE slug LIKE 'eventbrite%';
UPDATE public.event_sources
SET source_type = 'wordpress'
WHERE slug LIKE 'chokarella%';
-- ---------- Eventbrite : URLs consolidées ----------

-- « music--events » ne renvoie que quelques concerts. La page « all-events »
-- du pays est un sur-ensemble, filtré ensuite par l'admin à la publication.
UPDATE public.event_sources
SET scrape_url = 'https://www.eventbrite.fr/d/haiti/all-events/',
    name = 'Eventbrite Haïti',
    notes = 'Tous les événements publiés en Haïti. Lecture du JSON-LD schema.org de la page.'
WHERE slug = 'eventbrite-haiti-music';
UPDATE public.event_sources
SET notes = 'Événements de Port-au-Prince et environs. Lecture du JSON-LD schema.org.'
WHERE slug = 'eventbrite-pap';
UPDATE public.event_sources
SET notes = 'API REST WordPress de Chokarella (le rendu HTML du site est produit en JavaScript).'
WHERE slug = 'chokarella-evenements';
-- ---------- Bandsintown : collecte serveur impossible ----------

UPDATE public.event_sources
SET is_active = false,
    source_type = 'bandsintown',
    notes = 'Désactivée : Cloudflare renvoie HTTP 403 sur les pages ville et l''API publique '
         || 'refuse explicitement les accès applicatifs. Aucune collecte serveur possible '
         || 'sans contourner ces protections.',
    last_error = 'HTTP 403 (Cloudflare) — collecte serveur bloquée par la source.'
WHERE slug = 'bandsintown-pap';
-- ---------- Nouvelle source diaspora ----------

INSERT INTO public.event_sources (name, slug, base_url, scrape_url, is_active, source_type, notes)
VALUES (
  'Eventbrite Miami (musique haïtienne)',
  'eventbrite-miami-haitian',
  'https://www.eventbrite.com',
  'https://www.eventbrite.com/d/fl--miami/haitian-music/',
  true,
  'eventbrite',
  'Scène haïtienne de Miami. Recherche par mot-clé : vérifier la pertinence avant publication.'
)
ON CONFLICT (slug) DO NOTHING;
