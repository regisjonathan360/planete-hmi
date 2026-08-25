/**
 * Collecteur d'actualités depuis Chokarella.
 * Utilise l'API REST WordPress, puis la page Musique comme solution de secours.
 */
import "server-only";

const MUSIC_CATEGORY_SLUG = "musique";
const FETCH_TIMEOUT_MS = 12_000;
const ALLOWED_HOSTS = new Set(["chokarella.com", "www.chokarella.com"]);
const REQUEST_HEADERS = { "User-Agent": "PlaneteHMI-NewsBot/1.0" };

export interface ScrapedArticle {
  sourceUrl: string;
  title: string;
  imageUrl: string | null;
  excerpt: string | null;
  author: string | null;
  date: string | null;
  categorySlug: typeof MUSIC_CATEGORY_SLUG;
}

interface WPPost {
  link: string;
  categories: number[];
  title?: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  date: string;
  _embedded?: {
    author?: Array<{ name: string }>;
    "wp:featuredmedia"?: Array<{ source_url: string; media_details?: { sizes?: Record<string, { source_url: string }> } }>;
  };
}

interface WPCategory {
  id: number;
  slug: string;
}

/**
 * Collecte uniquement les articles rattachés à la catégorie Musique.
 * Si l'API WordPress est indisponible, la page HTML /category/musique/
 * est utilisée sans jamais revenir aux derniers articles globaux du site.
 */
export async function scrapeChokarella(baseUrl: string): Promise<ScrapedArticle[]> {
  const sourceUrl = validateMusicSource(baseUrl);

  try {
    return await scrapeWordPress(sourceUrl);
  } catch (apiError) {
    try {
      const fallbackArticles = await scrapeMusicCategoryPage(sourceUrl);
      if (fallbackArticles.length === 0) {
        throw new Error("Aucun article Musique détecté sur la page.");
      }
      return fallbackArticles;
    } catch (fallbackError) {
      const apiMessage =
        apiError instanceof Error ? apiError.message : "API WordPress indisponible.";
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : "Page Musique indisponible.";

      throw new Error(
        `Chokarella ne répond pas correctement. API : ${apiMessage} Page Musique : ${fallbackMessage}`
      );
    }
  }
}

function validateMusicSource(baseUrl: string): URL {
  const sourceUrl = new URL(baseUrl);

  if (!ALLOWED_HOSTS.has(sourceUrl.hostname.toLowerCase())) {
    throw new Error("Source Chokarella non autorisée.");
  }

  const sourceCategory = sourceUrl.pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase();

  if (sourceCategory !== MUSIC_CATEGORY_SLUG) {
    throw new Error("La source doit cibler exclusivement la catégorie Musique.");
  }

  return sourceUrl;
}

async function scrapeWordPress(sourceUrl: URL): Promise<ScrapedArticle[]> {
  const wpBase = new URL("/wp-json/wp/v2/", sourceUrl.origin);
  const categoryUrl = new URL("categories", wpBase);
  categoryUrl.searchParams.set("slug", MUSIC_CATEGORY_SLUG);

  const categoryResponse = await fetchWithTimeout(categoryUrl);
  if (!categoryResponse.ok) {
    throw new Error(`Catégorie Musique indisponible (HTTP ${categoryResponse.status}).`);
  }

  const categories: unknown = await categoryResponse.json();
  if (!Array.isArray(categories)) {
    throw new Error("Réponse de catégorie Chokarella invalide.");
  }

  const musicCategory = categories.find(isMusicCategory);
  if (!musicCategory) {
    throw new Error("La catégorie Musique n'a pas pu être confirmée.");
  }

  const postsUrl = new URL("posts", wpBase);
  postsUrl.searchParams.set("per_page", "20");
  postsUrl.searchParams.set("_embed", "1");
  postsUrl.searchParams.set("categories", String(musicCategory.id));

  const postsResponse = await fetchWithTimeout(postsUrl);
  if (!postsResponse.ok) {
    throw new Error(`Articles Musique indisponibles (HTTP ${postsResponse.status}).`);
  }

  const posts: unknown = await postsResponse.json();
  if (!Array.isArray(posts)) {
    throw new Error("Réponse des articles Chokarella invalide.");
  }

  return posts
    .filter(
      (post): post is WPPost =>
        isWpPost(post) && post.categories.includes(musicCategory.id)
    )
    .map((post) => ({
      sourceUrl: post.link,
      title: decodeHtmlEntities(post.title?.rendered ?? ""),
      imageUrl: extractFeaturedImage(post),
      excerpt: decodeHtmlEntities(stripHtml(post.excerpt?.rendered ?? "")),
      author: extractAuthorName(post),
      date: formatWpDate(post.date),
      categorySlug: MUSIC_CATEGORY_SLUG as typeof MUSIC_CATEGORY_SLUG,
    }))
    .filter((article) => article.title.length > 3);
}

async function scrapeMusicCategoryPage(sourceUrl: URL): Promise<ScrapedArticle[]> {
  const response = await fetchWithTimeout(sourceUrl);
  if (!response.ok) {
    throw new Error(`Page Musique indisponible (HTTP ${response.status}).`);
  }

  const html = await response.text();
  const articles: ScrapedArticle[] = [];
  const seen = new Set<string>();
  // Images d'articles rencontrées dans une ancre « visuel » (image seule,
  // sans texte) et à replacer sur l'ancre titre correspondante.
  const pendingImages = new Map<string, string>();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    let articleUrl: URL;
    try {
      articleUrl = new URL(decodeHtmlEntities(match[1]), sourceUrl);
    } catch {
      continue;
    }

    if (
      !ALLOWED_HOSTS.has(articleUrl.hostname.toLowerCase()) ||
      !/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/.test(articleUrl.pathname) ||
      seen.has(articleUrl.href)
    ) {
      continue;
    }

    const title = decodeHtmlEntities(stripHtml(match[2]));
    const anchorImage = extractImageFromHtml(match[0], sourceUrl);

    // Ancre « visuel » : l'image de l'article est ici, mais pas le titre.
    // On la mémorise par URL d'article pour l'ancre titre qui suit.
    if (title.length <= 3) {
      if (anchorImage && !pendingImages.has(articleUrl.href)) {
        pendingImages.set(articleUrl.href, anchorImage);
      }
      continue;
    }

    const contextStart = Math.max(0, (match.index ?? 0) - 400);
    const contextEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 300);
    const context = html.slice(contextStart, contextEnd);

    seen.add(articleUrl.href);
    articles.push({
      sourceUrl: articleUrl.href,
      title,
      imageUrl:
        pendingImages.get(articleUrl.href) ??
        anchorImage ??
        extractImageFromHtml(context, sourceUrl),
      excerpt: null,
      author: "Chokarella",
      date: formatDateFromArticleUrl(articleUrl),
      categorySlug: MUSIC_CATEGORY_SLUG,
    });

    if (articles.length === 20) break;
  }

  return articles;
}

async function fetchWithTimeout(url: URL): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { ...REQUEST_HEADERS, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new Error(`Délai dépassé après ${FETCH_TIMEOUT_MS / 1000} secondes.`);
    }
    throw error;
  }
}

function extractImageFromHtml(html: string, sourceUrl: URL): string | null {
  // Chercher les <img> complets avec leurs attributs pour pouvoir filtrer par class/size
  const imgTagPattern = /<img\b[^>]*\b(?:data-lazy-src|data-src|src)=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgTagPattern)];

  // Patterns d'images à exclure (avatars, editeurs, gravatar, icônes)
  const EXCLUDED_URL_PATTERNS = [
    /gravatar\.com/i,
    /secure\.gravatar/i,
    /\/author\//i,
    /\/avatar/i,
    /\/profile/i,
    /\/favicon/i,
    /\/logo/i,
    /\bicon\b/i,
  ];

  // Classes CSS d'avatars/auteurs à exclure
  const EXCLUDED_CLASS_PATTERNS = [
    /avatar/i,
    /author/i,
    /profile/i,
    /user-photo/i,
    /byline/i,
  ];

  // Itérer du premier au dernier (l'image la plus proche du lien article est la bonne)
  for (let index = 0; index < matches.length; index++) {
    const fullTag = matches[index][0];
    const rawUrl = matches[index][1];

    try {
      const imageUrl = new URL(decodeHtmlEntities(rawUrl), sourceUrl);

      // Vérifier que c'est un host autorisé
      if (!ALLOWED_HOSTS.has(imageUrl.hostname.toLowerCase())) continue;

      // Exclure par URL pattern
      if (EXCLUDED_URL_PATTERNS.some((pattern) => pattern.test(imageUrl.href))) continue;

      // Exclure par classe CSS du <img>
      const classMatch = fullTag.match(/class=["']([^"']+)["']/i);
      if (classMatch) {
        const classes = classMatch[1];
        if (EXCLUDED_CLASS_PATTERNS.some((pattern) => pattern.test(classes))) continue;
      }

      // Exclure les images avec width/height explicitement petits (< 200px)
      const widthMatch = fullTag.match(/\bwidth=["']?(\d+)/i);
      const heightMatch = fullTag.match(/\bheight=["']?(\d+)/i);
      if (widthMatch && parseInt(widthMatch[1], 10) < 200) continue;
      if (heightMatch && parseInt(heightMatch[1], 10) < 200) continue;

      // Exclure les images trop petites par nom de fichier (WordPress resize suffix)
      const smallThumb = imageUrl.href.match(/-(\d+)x(\d+)\./);
      if (smallThumb) {
        const w = parseInt(smallThumb[1], 10);
        const h = parseInt(smallThumb[2], 10);
        if (w < 200 || h < 100) continue;
      }

      // Upgrader vers l'original sans suffixe de redimensionnement (-615x410.jpg → .jpg)
      return upgradeWpImageUrl(imageUrl.href);
    } catch {
      // Ignore les attributs qui ne sont pas des URL valides.
    }
  }
  return null;
}

function formatDateFromArticleUrl(articleUrl: URL): string | null {
  const match = articleUrl.pathname.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!match) return null;
  return formatWpDate(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
}

function isMusicCategory(value: unknown): value is WPCategory {
  if (!value || typeof value !== "object") return false;
  const category = value as Partial<WPCategory>;

  return (
    Number.isInteger(category.id) &&
    Number(category.id) > 0 &&
    category.slug?.toLowerCase() === MUSIC_CATEGORY_SLUG
  );
}

function isWpPost(value: unknown): value is WPPost {
  if (!value || typeof value !== "object") return false;
  const post = value as Partial<WPPost>;

  return (
    typeof post.link === "string" &&
    ALLOWED_HOSTS.has(safeHostname(post.link)) &&
    typeof post.date === "string" &&
    Array.isArray(post.categories) &&
    post.categories.every((categoryId) => Number.isInteger(categoryId))
  );
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function extractFeaturedImage(post: WPPost): string | null {
  const media = post._embedded?.["wp:featuredmedia"];
  
  if (Array.isArray(media) && media.length > 0) {
    const m = media[0];
    // Préférer la taille "full" (original) puis "large" — qualité maximale
    const sizes = m.media_details?.sizes;
    if (sizes) {
      const preferred = sizes["full"]?.source_url ?? sizes["large"]?.source_url ?? sizes["medium_large"]?.source_url;
      if (preferred) return preferred;
    }
    if (m.source_url) return m.source_url;
  }
  
  // Fallback : extraire la première image du contenu HTML de l'article
  const content = post.content?.rendered ?? "";
  if (content) {
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch?.[1]) {
      const url = imgMatch[1];
      // Vérifier que c'est bien une image de Chokarella, pas un emoji/icon
      if (ALLOWED_HOSTS.has(new URL(url, "https://chokarella.com").hostname.toLowerCase())) {
        return upgradeWpImageUrl(url);
      }
    }
  }
  
  return null;
}

/**
 * Upgrade une URL d'image WordPress redimensionnée (`-615x410.jpg`) vers
 * l'original sans suffixe (`hero.jpg`). WordPress génère toujours les
 * miniatures depuis l'original, qui reste accessible à la même date/chemin.
 */
export function upgradeWpImageUrl(url: string): string {
  return url.replace(/-\d{2,5}x\d{2,5}(\.\w{3,4})(\?.*)?$/, "$1");
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
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, "«")
    .replace(/&#8221;/g, "»")
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
