/**
 * Collecteur d'actualités depuis Chokarella.
 * Utilise l'API REST WordPress avec un filtrage strict sur la catégorie Musique.
 */
import "server-only";

const MUSIC_CATEGORY_SLUG = "musique";
const ALLOWED_HOSTS = new Set(["chokarella.com", "www.chokarella.com"]);

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
  date: string;
  _embedded?: {
    author?: Array<{ name: string }>;
    "wp:featuredmedia"?: Array<{ source_url: string }>;
  };
}

interface WPCategory {
  id: number;
  slug: string;
}

/**
 * Collecte uniquement les articles rattachés à la catégorie WordPress Musique.
 * Si cette catégorie ne peut pas être confirmée, la collecte échoue sans
 * demander les derniers articles globaux du site.
 */
export async function scrapeChokarella(baseUrl: string): Promise<ScrapedArticle[]> {
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

  const wpBase = new URL("/wp-json/wp/v2/", sourceUrl.origin);
  const categoryUrl = new URL("categories", wpBase);
  categoryUrl.searchParams.set("slug", MUSIC_CATEGORY_SLUG);

  const categoryResponse = await fetch(categoryUrl, {
    headers: { "User-Agent": "PlaneteHMI-NewsBot/1.0" },
    cache: "no-store",
  });

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

  const postsResponse = await fetch(postsUrl, {
    headers: { "User-Agent": "PlaneteHMI-NewsBot/1.0" },
    cache: "no-store",
  });

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
