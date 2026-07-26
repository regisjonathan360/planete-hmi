/**
 * Collecteur d'actualités depuis Chokarella.
 * Utilise une approche RSS/API si disponible, sinon parse le HTML statique.
 *
 * Chokarella est un site WordPress — on peut utiliser son API REST WP.
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
 * Collecte les articles depuis l'API WordPress de Chokarella.
 * WordPress expose /wp-json/wp/v2/posts par défaut.
 */
export async function scrapeChokarella(baseUrl: string): Promise<ScrapedArticle[]> {
  // Déterminer l'URL de l'API WP à partir de l'URL de catégorie
  // baseUrl = https://www.chokarella.com/category/musique/
  // API WP = https://www.chokarella.com/wp-json/wp/v2/posts?categories=XX&per_page=20

  // D'abord, récupérer l'ID de la catégorie "musique"
  const wpBase = "https://www.chokarella.com/wp-json/wp/v2";

  try {
    // Essayer l'API WP directement avec le slug de catégorie
    const catRes = await fetch(`${wpBase}/categories?slug=musique`, {
      headers: { "User-Agent": "PlaneteHMI-NewsBot/1.0" },
      cache: "no-store",
    });

    let categoryId: number | null = null;
    if (catRes.ok) {
      const cats = await catRes.json();
      if (Array.isArray(cats) && cats.length > 0) {
        categoryId = cats[0].id;
      }
    }

    // Récupérer les posts
    let postsUrl = `${wpBase}/posts?per_page=20&_embed`;
    if (categoryId) {
      postsUrl += `&categories=${categoryId}`;
    }

    const postsRes = await fetch(postsUrl, {
      headers: { "User-Agent": "PlaneteHMI-NewsBot/1.0" },
      cache: "no-store",
    });

    if (!postsRes.ok) {
      throw new Error(`API WordPress non disponible (HTTP ${postsRes.status})`);
    }

    const posts = await postsRes.json();

    if (!Array.isArray(posts)) {
      throw new Error("Réponse inattendue de l'API WordPress");
    }

    return posts.map((post: WPPost) => ({
      sourceUrl: post.link,
      title: decodeHtmlEntities(post.title?.rendered ?? ""),
      imageUrl: extractFeaturedImage(post),
      excerpt: decodeHtmlEntities(stripHtml(post.excerpt?.rendered ?? "")),
      author: extractAuthorName(post),
      date: formatWpDate(post.date),
    })).filter((a: ScrapedArticle) => a.title.length > 3);
  } catch (err) {
    // Fallback : tenter un parse HTML simple
    return fallbackHtmlScrape(baseUrl);
  }
}

// ============================================================
// Types WordPress
// ============================================================

interface WPPost {
  link: string;
  title?: { rendered: string };
  excerpt?: { rendered: string };
  date: string;
  _embedded?: {
    author?: Array<{ name: string }>;
    "wp:featuredmedia"?: Array<{ source_url: string }>;
  };
}

// ============================================================
// Helpers
// ============================================================

function extractFeaturedImage(post: WPPost): string | null {
  const media = post._embedded?.["wp:featuredmedia"];
  if (Array.isArray(media) && media.length > 0) {
    return media[0].source_url ?? null;
  }
  return null;
}

function extractAuthorName(post: WPPost): string | null {
  const authors = post._embedded?.author;
  if (Array.isArray(authors) && authors.length > 0) {
    return authors[0].name ?? null;
  }
  return null;
}

function formatWpDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, "\u00ab")
    .replace(/&#8221;/g, "\u00bb")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\u00a0/g, " ")
    .trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// ============================================================
// Fallback HTML scraping
// ============================================================

async function fallbackHtmlScrape(url: string): Promise<ScrapedArticle[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "PlaneteHMI-NewsBot/1.0" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Échec du scraping : HTTP ${response.status}`);
  }

  const html = await response.text();
  const articles: ScrapedArticle[] = [];
  const seen = new Set<string>();

  // Pattern: articles with links to chokarella.com/YYYY/MM/DD/slug/
  const linkPattern = /href="(https:\/\/www\.chokarella\.com\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/g;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const articleUrl = match[1];
    if (seen.has(articleUrl)) continue;
    seen.add(articleUrl);

    // Find title near this link
    const titlePattern = new RegExp(
      `href="${articleUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([^<]{5,})<`,
      "i"
    );
    const titleMatch = titlePattern.exec(html);
    const title = titleMatch?.[1]?.trim();
    if (!title) continue;

    // Find image
    const pos = html.indexOf(articleUrl);
    const context = html.slice(Math.max(0, pos - 2000), pos + 500);
    const imgMatch = /(?:src|data-src)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i.exec(context);
    const imageUrl = imgMatch?.[1] ?? null;

    articles.push({
      sourceUrl: articleUrl,
      title: decodeHtmlEntities(title),
      imageUrl: imageUrl && !imageUrl.includes("gravatar") ? imageUrl : null,
      excerpt: null,
      author: null,
      date: null,
    });
  }

  return articles.slice(0, 20);
}
