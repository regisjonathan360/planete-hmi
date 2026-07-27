/**
 * Collecteur d'événements multi-sources.
 * Supporte : Eventbrite, Chokarella (WordPress), Bandsintown.
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
  excerpt: string | null;
}

/**
 * Collecte les événements depuis n'importe quelle source configurée.
 * Détecte automatiquement le type de source par son slug.
 */
export async function scrapeEvents(slug: string, url: string): Promise<ScrapedEvent[]> {
  if (slug.startsWith("chokarella")) {
    return scrapeChokarellaEvents(url);
  }
  if (slug.startsWith("bandsintown")) {
    return scrapeBandsintown(url);
  }
  // Eventbrite par défaut
  return scrapeEventbrite(url);
}

// ============================================================
// Chokarella (WordPress REST API)
// ============================================================

async function scrapeChokarellaEvents(url: string): Promise<ScrapedEvent[]> {
  const wpBase = "https://www.chokarella.com/wp-json/wp/v2";

  try {
    // Récupérer l'ID catégorie "evenements"
    const catRes = await fetch(`${wpBase}/categories?slug=evenements`, {
      headers: { "User-Agent": "PlaneteHMI-EventBot/1.0" },
      cache: "no-store",
    });
    let categoryId: number | null = null;
    if (catRes.ok) {
      const cats = await catRes.json();
      if (Array.isArray(cats) && cats.length > 0) categoryId = cats[0].id;
    }

    let postsUrl = `${wpBase}/posts?per_page=15&_embed`;
    if (categoryId) postsUrl += `&categories=${categoryId}`;

    const postsRes = await fetch(postsUrl, {
      headers: { "User-Agent": "PlaneteHMI-EventBot/1.0" },
      cache: "no-store",
    });
    if (!postsRes.ok) throw new Error(`WordPress API HTTP ${postsRes.status}`);

    const posts = await postsRes.json();
    if (!Array.isArray(posts)) return [];

    return posts.map((post: Record<string, unknown>) => {
      const embedded = post._embedded as Record<string, unknown[]> | undefined;
      const media = embedded?.["wp:featuredmedia"] as Array<{ source_url?: string }> | undefined;

      return {
        sourceUrl: post.link as string,
        title: decodeHtml(((post.title as { rendered?: string })?.rendered) ?? ""),
        imageUrl: media?.[0]?.source_url ?? null,
        date: formatWpDate(post.date as string),
        time: null,
        location: null,
        price: null,
        excerpt: decodeHtml(stripHtml(((post.excerpt as { rendered?: string })?.rendered) ?? "")),
      };
    }).filter((e: ScrapedEvent) => e.title.length > 3);
  } catch {
    return fallbackHtmlScrape(url);
  }
}

// ============================================================
// Eventbrite
// ============================================================

async function scrapeEventbrite(url: string): Promise<ScrapedEvent[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlaneteHMI-EventBot/1.0)",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Eventbrite HTTP ${response.status}`);

  const html = await response.text();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="(https:\/\/www\.eventbrite\.com\/e\/[^"?]+)"/g;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const eventUrl = match[1];
    if (seen.has(eventUrl)) continue;
    seen.add(eventUrl);

    const pos = html.indexOf(eventUrl);
    const context = html.slice(Math.max(0, pos - 3000), pos + 1000);

    // Title from "Voir TITLE"
    let title: string | null = null;
    const voirMatch = /Voir ([^<\n]{5,80})/i.exec(context);
    if (voirMatch) title = voirMatch[1].trim();
    if (!title) {
      const slugMatch = /\/e\/(.+?)-tickets-/i.exec(eventUrl);
      if (slugMatch) title = slugMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
    if (!title || title.length < 3) continue;

    // Date
    const dateMatch = /(\w{3}\.\s+\d{1,2}\s+\w+(?:,?\s+\d{2}:\d{2})?)/i.exec(html.slice(pos, pos + 500));
    // Location
    const locContext = html.slice(pos, pos + 600);
    const locMatch = /\n\s*\n\s*([A-ZÀ-Ü][^\n<]{3,50})\s*\n/m.exec(locContext);
    // Image
    const imgContext = html.slice(Math.max(0, pos - 2000), pos + 500);
    const imgMatch = /(?:src|data-src)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i.exec(imgContext);

    events.push({
      sourceUrl: eventUrl,
      title: decodeHtml(title),
      imageUrl: imgMatch?.[1] && !imgMatch[1].includes("avatar") ? imgMatch[1] : null,
      date: dateMatch?.[1]?.trim() ?? null,
      time: null,
      location: locMatch?.[1]?.trim() ?? null,
      price: null,
      excerpt: null,
    });
  }

  return events.slice(0, 20);
}

// ============================================================
// Bandsintown
// ============================================================

async function scrapeBandsintown(url: string): Promise<ScrapedEvent[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlaneteHMI-EventBot/1.0)",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Bandsintown HTTP ${response.status}`);

  const html = await response.text();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  // Bandsintown event links pattern
  const linkPattern = /href="(https:\/\/www\.bandsintown\.com\/[^"]*\/e\/[^"]+)"/g;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const eventUrl = match[1];
    if (seen.has(eventUrl)) continue;
    seen.add(eventUrl);

    const pos = html.indexOf(eventUrl);
    const context = html.slice(Math.max(0, pos - 1500), pos + 800);

    // Artist/event name from nearby text
    const nameMatch = /class="[^"]*[Nn]ame[^"]*"[^>]*>([^<]{3,80})</i.exec(context);
    const title = nameMatch?.[1]?.trim() ?? null;
    if (!title) continue;

    // Date
    const dateMatch = /(\d{1,2}\s+\w{3,10}(?:\s+\d{4})?)/i.exec(context);
    // Venue
    const venueMatch = /class="[^"]*[Vv]enue[^"]*"[^>]*>([^<]{3,60})</i.exec(context);
    // Image
    const imgMatch = /(?:src|data-src)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i.exec(context);

    events.push({
      sourceUrl: eventUrl,
      title: decodeHtml(title),
      imageUrl: imgMatch?.[1] ?? null,
      date: dateMatch?.[1]?.trim() ?? null,
      time: null,
      location: venueMatch?.[1]?.trim() ?? null,
      price: null,
      excerpt: null,
    });
  }

  return events.slice(0, 20);
}

// ============================================================
// Fallback HTML scrape (generic)
// ============================================================

async function fallbackHtmlScrape(url: string): Promise<ScrapedEvent[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "PlaneteHMI-EventBot/1.0" },
    cache: "no-store",
  });
  if (!response.ok) return [];

  const html = await response.text();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="(https:\/\/www\.chokarella\.com\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/g;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const eventUrl = match[1];
    if (seen.has(eventUrl)) continue;
    seen.add(eventUrl);

    const titlePattern = new RegExp(`href="${eventUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([^<]{5,})<`, "i");
    const titleMatch = titlePattern.exec(html);
    const title = titleMatch?.[1]?.trim();
    if (!title) continue;

    events.push({ sourceUrl: eventUrl, title: decodeHtml(title), imageUrl: null, date: null, time: null, location: null, price: null, excerpt: null });
  }
  return events.slice(0, 15);
}

// ============================================================
// Helpers
// ============================================================

function decodeHtml(str: string): string {
  return str.replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&#8220;/g, "\u00ab").replace(/&#8221;/g, "\u00bb").replace(/&#8211;/g, "–").replace(/&#038;/g, "&").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\u00a0/g, " ").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatWpDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return dateStr; }
}
