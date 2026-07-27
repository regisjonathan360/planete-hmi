/**
 * Collecteur d'événements depuis Eventbrite.
 * Eventbrite expose une API publique de recherche qu'on peut utiliser,
 * ou on parse le HTML rendu de la page de catégorie.
 */
import "server-only";

export interface ScrapedEvent {
  sourceUrl: string;
  title: string;
  imageUrl: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  price: string | null;
}

/**
 * Scrape la page Eventbrite Haiti Music Events.
 */
export async function scrapeEventbrite(url: string): Promise<ScrapedEvent[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlaneteHMI-EventBot/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Échec du scraping Eventbrite : HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseEventbriteHtml(html);
}

/**
 * Parse le HTML d'Eventbrite pour extraire les événements.
 */
export function parseEventbriteHtml(html: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  // Eventbrite event URLs pattern: eventbrite.com/e/SLUG-tickets-ID
  const eventLinkPattern = /href="(https:\/\/www\.eventbrite\.com\/e\/[^"?]+)"/g;

  let match;
  while ((match = eventLinkPattern.exec(html)) !== null) {
    const eventUrl = match[1];
    if (seen.has(eventUrl)) continue;
    seen.add(eventUrl);

    // Extract title from "Voir TITLE" patterns or aria-labels
    const pos = html.indexOf(eventUrl);
    const contextBefore = html.slice(Math.max(0, pos - 3000), pos + 1000);

    // Title: look for text after "Voir " link text
    let title: string | null = null;
    const titleFromVoir = /Voir ([^<\n]{5,80})/i.exec(contextBefore);
    if (titleFromVoir) {
      title = titleFromVoir[1].trim();
    }

    // Also try aria-label
    if (!title) {
      const ariaPattern = new RegExp(`aria-label="[^"]*?(${escapeRegex(eventUrl)})[^"]*"`, "i");
      const ariaMatch = ariaPattern.exec(html);
      if (ariaMatch) {
        // Try to get text from nearby content
        const nearTitle = /class="[^"]*title[^"]*"[^>]*>([^<]{5,100})</i.exec(contextBefore);
        if (nearTitle) title = nearTitle[1].trim();
      }
    }

    // Extract from slug as last resort
    if (!title) {
      const slugMatch = /\/e\/(.+?)-tickets-/i.exec(eventUrl);
      if (slugMatch) {
        title = slugMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
    }

    if (!title || title.length < 3) continue;

    // Date - look for date patterns near the link
    const dateContext = html.slice(pos, pos + 500);
    const dateMatch = /(\w{3}\.\s+\d{1,2}\s+\w+(?:,?\s+\d{2}:\d{2})?)/i.exec(dateContext);

    // Location
    const locationMatch = /(?:location|lieu)[^>]*>([^<]{3,60})/i.exec(dateContext) ||
      /\n\s*\n\s*([A-ZÀ-Ü][^<\n]{3,50})\s*\n/m.exec(dateContext);

    // Price
    const priceMatch = /(?:prix|price|billet)[^>]*>([^<]{2,30})/i.exec(dateContext) ||
      /(\d+[\s,.]?\d*\s*(?:€|\$|HTG|USD|Gratuit|Free))/i.exec(dateContext);

    // Image
    const imgContext = html.slice(Math.max(0, pos - 2000), pos + 500);
    const imgMatch = /(?:src|data-src)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i.exec(imgContext);
    const imageUrl = imgMatch?.[1] ?? null;

    events.push({
      sourceUrl: eventUrl,
      title: decodeHtmlEntities(title),
      imageUrl: imageUrl && !imageUrl.includes("avatar") ? imageUrl : null,
      date: dateMatch?.[1]?.trim() ?? null,
      time: null,
      location: locationMatch?.[1]?.trim() ?? null,
      price: priceMatch?.[1]?.trim() ?? null,
    });
  }

  return events.slice(0, 20);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
