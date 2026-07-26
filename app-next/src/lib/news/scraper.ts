/**
 * Collecteur d'actualités depuis des sources externes.
 * Scrape les pages de catégorie et extrait titre, image, URL, auteur, date.
 */
import "server-only";

export interface ScrapedArticle {
  sourceUrl: string;
  title: string;
  imageUrl: string | null;
  excerpt: string | null;
  author: string | null;
  date: string | null;
}

/**
 * Scrape la page musique de Chokarella et retourne les articles trouvés.
 */
export async function scrapeChokarella(url: string): Promise<ScrapedArticle[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PlaneteHMI-NewsBot/1.0 (+https://planete-hmi.com)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Échec du scraping : HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseChokarellaHtml(html);
}

/**
 * Parse le HTML de Chokarella pour extraire les articles.
 * Utilise des regex simples (pas de dépendance DOM côté serveur).
 */
export function parseChokarellaHtml(html: string): ScrapedArticle[] {
  const articles: ScrapedArticle[] = [];
  const seen = new Set<string>();

  // Pattern: articles with links to chokarella.com/YYYY/MM/DD/slug/
  const linkPattern = /href="(https:\/\/www\.chokarella\.com\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/g;
  const links: string[] = [];

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }

  for (const url of links) {
    // Find the title associated with this URL
    // Pattern: title text is usually inside a heading near the link
    const titlePattern = new RegExp(
      `href="${escapeRegex(url)}"[^>]*>([^<]+)<`,
      "i"
    );
    const titleMatch = titlePattern.exec(html);
    const title = titleMatch?.[1]?.trim();

    if (!title || title.length < 5) continue; // Skip navigation links

    // Find image near this article (image src in the same article block)
    // Look for img with src before the link
    const urlPos = html.indexOf(url);
    const contextStart = Math.max(0, urlPos - 2000);
    const context = html.slice(contextStart, urlPos + 500);

    const imgPattern = /(?:src|data-src)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    let imgMatch;
    let imageUrl: string | null = null;
    while ((imgMatch = imgPattern.exec(context)) !== null) {
      const imgUrl = imgMatch[1];
      // Skip tiny icons/avatars
      if (!imgUrl.includes("gravatar") && !imgUrl.includes("icon") && !imgUrl.includes("logo")) {
        imageUrl = imgUrl;
      }
    }

    // Extract date
    const datePattern = /(\w+ \d{1,2}, \d{4})/;
    const dateContext = html.slice(urlPos, urlPos + 500);
    const dateMatch = datePattern.exec(dateContext);

    // Extract author
    const authorPattern = /author\/[^"]+">([^<]+)</;
    const authorMatch = authorPattern.exec(dateContext);

    articles.push({
      sourceUrl: url,
      title: cleanTitle(title),
      imageUrl,
      excerpt: null, // Could be extracted but not always present in listing
      author: authorMatch?.[1]?.trim() ?? null,
      date: dateMatch?.[1] ?? null,
    });
  }

  // Deduplicate by URL and limit to reasonable count
  return articles.slice(0, 30);
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\u00ab/g, "«")
    .replace(/\u00bb/g, "»")
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
