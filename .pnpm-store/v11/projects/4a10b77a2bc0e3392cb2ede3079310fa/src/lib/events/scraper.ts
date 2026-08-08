/**
 * Collecteur d'événements multi-sources.
 *
 * Stratégie : on privilégie toujours les données structurées publiées par la
 * source (schema.org `Event` en JSON-LD, API REST WordPress) plutôt que le
 * grattage de balises HTML, qui casse au moindre changement de gabarit.
 *
 * Chaque collecte renvoie aussi des avertissements : une source qui bloque la
 * collecte serveur doit être signalée à l'administrateur, jamais silencieuse.
 */
import "server-only";

export interface ScrapedEvent {
  sourceUrl: string;
  title: string;
  imageUrl: string | null;
  /** Libellé lisible affiché tel quel (ex. « 18 août 2026 »). */
  date: string | null;
  /** Date de début normalisée ISO 8601, utilisée pour le tri et le filtrage. */
  startsAt: string | null;
  time: string | null;
  location: string | null;
  price: string | null;
  excerpt: string | null;
}

export interface ScrapeResult {
  events: ScrapedEvent[];
  /** Anomalies non bloquantes, remontées à l'admin. */
  warnings: string[];
}

/** Familles de parseurs disponibles. */
export type EventSourceType = "eventbrite" | "wordpress" | "bandsintown" | "jsonld";

/** Entêtes proches d'un navigateur : plusieurs sites refusent les UA vides. */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  "Upgrade-Insecure-Requests": "1",
};

/** Déduit la famille de parseur depuis l'URL quand elle n'est pas déclarée. */
export function detectSourceType(slug: string, url: string): EventSourceType {
  const haystack = `${slug} ${url}`.toLowerCase();
  if (haystack.includes("eventbrite")) return "eventbrite";
  if (haystack.includes("bandsintown")) return "bandsintown";
  if (haystack.includes("chokarella")) return "wordpress";
  return "jsonld";
}

/**
 * Collecte les événements d'une source.
 * @param sourceType force le parseur ; sinon il est déduit de l'URL.
 */
export async function scrapeEvents(
  slug: string,
  url: string,
  sourceType?: EventSourceType | null,
): Promise<ScrapeResult> {
  const type = sourceType && sourceType !== "jsonld" ? sourceType : detectSourceType(slug, url);

  switch (type) {
    case "eventbrite":
      return scrapeEventbrite(url);
    case "wordpress":
      return scrapeWordPressEvents(url);
    case "bandsintown":
      return scrapeBandsintown(url);
    default:
      return scrapeGenericJsonLd(url);
  }
}

// ============================================================
// Lecture des données structurées schema.org
// ============================================================

interface JsonLdEvent {
  "@type"?: string;
  name?: string;
  url?: string;
  image?: string | string[];
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: {
    name?: string;
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
      streetAddress?: string;
    };
  };
  offers?: unknown;
}

const EVENT_TYPES = new Set([
  "Event",
  "MusicEvent",
  "Festival",
  "SocialEvent",
  "TheaterEvent",
  "DanceEvent",
  "ExhibitionEvent",
]);

function isEventNode(node: unknown): node is JsonLdEvent {
  if (!node || typeof node !== "object") return false;
  const type = (node as { "@type"?: unknown })["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && EVENT_TYPES.has(t));
}

/** Extrait tous les nœuds `Event` des balises `application/ld+json` d'une page. */
export function extractJsonLdEvents(html: string): JsonLdEvent[] {
  const found: JsonLdEvent[] = [];
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue; // bloc tronqué ou non conforme : on passe au suivant
    }
    walk(parsed, found, 0);
  }

  return found;
}

function walk(node: unknown, out: JsonLdEvent[], depth: number): void {
  if (depth > 6 || !node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) walk(child, out, depth + 1);
    return;
  }

  if (isEventNode(node)) {
    out.push(node);
    return;
  }

  const record = node as Record<string, unknown>;
  // Conteneurs usuels : ItemList, @graph, ListItem.
  for (const key of ["itemListElement", "@graph", "item", "mainEntity", "subEvent"]) {
    if (key in record) walk(record[key], out, depth + 1);
  }
}

/** Convertit un nœud schema.org en événement collecté. */
function fromJsonLd(node: JsonLdEvent, fallbackUrl: string): ScrapedEvent | null {
  const title = decodeHtml(stripHtml(node.name ?? "")).trim();
  const sourceUrl = (node.url ?? "").trim() || fallbackUrl;
  if (!title || title.length < 3 || !sourceUrl.startsWith("http")) return null;

  const image = Array.isArray(node.image) ? node.image[0] : node.image;

  return {
    sourceUrl,
    title,
    imageUrl: typeof image === "string" && image.startsWith("http") ? image : null,
    date: formatDateLabel(node.startDate),
    startsAt: toIsoDate(node.startDate),
    time: extractTime(node.startDate),
    location: formatLocation(node.location),
    price: formatOffers(node.offers),
    excerpt: node.description ? decodeHtml(stripHtml(node.description)).slice(0, 400) : null,
  };
}

// ============================================================
// Eventbrite
// ============================================================

/** `https://www.eventbrite.fr/e/mon-event-tickets-123456` → `123456`. */
function eventbriteId(url: string): string | null {
  return /-tickets-(\d+)/.exec(url)?.[1] ?? null;
}

async function scrapeEventbrite(url: string): Promise<ScrapeResult> {
  const warnings: string[] = [];
  const response = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `Eventbrite a refusé la requête (HTTP ${response.status}). Vérifiez que l'URL de collecte est toujours valide.`,
    );
  }

  const html = await response.text();
  const nodes = extractJsonLdEvents(html);
  const events: ScrapedEvent[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (const node of nodes) {
    const event = fromJsonLd(node, url);
    if (!event) continue;
    const id = eventbriteId(event.sourceUrl);
    const key = id ?? event.sourceUrl;
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    seenUrls.add(event.sourceUrl);
    events.push(event);
  }

  // Les pages listent parfois plus d'événements que le JSON-LD n'en décrit.
  // On complète avec les liens billetterie, titre déduit du slug.
  const anchors = html.matchAll(
    /https:\/\/www\.eventbrite\.[a-z.]{2,6}\/e\/([a-z0-9-]+)-tickets-(\d+)/gi,
  );
  for (const anchor of anchors) {
    const [fullUrl, slug, id] = anchor;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const title = slug
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    if (title.length < 3) continue;

    events.push({
      sourceUrl: fullUrl,
      title,
      imageUrl: null,
      date: null,
      startsAt: null,
      time: null,
      location: null,
      price: null,
      excerpt: null,
    });
  }

  if (events.length === 0) {
    warnings.push(
      "Aucune donnée structurée trouvée sur la page Eventbrite : le gabarit a peut-être changé.",
    );
  } else if (nodes.length === 0) {
    warnings.push(
      "Eventbrite n'a fourni aucun JSON-LD : les titres proviennent des URLs et les dates sont absentes.",
    );
  }

  return { events: dropFinishedEvents(events, warnings).slice(0, 40), warnings };
}

// ============================================================
// WordPress (Chokarella et tout site WordPress ouvert)
// ============================================================

interface WpPost {
  link?: string;
  date?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  _embedded?: { "wp:featuredmedia"?: { source_url?: string }[] };
}

/**
 * Lit la catégorie ciblée par l'URL (`/category/<slug>/`) via l'API REST.
 * Le rendu HTML de Chokarella étant produit en JavaScript, l'API est le seul
 * point d'entrée fiable.
 */
async function scrapeWordPressEvents(url: string): Promise<ScrapeResult> {
  const warnings: string[] = [];
  const site = new URL(url);
  const wpBase = `${site.origin}/wp-json/wp/v2`;
  const categorySlug = /\/category\/([^/]+)/.exec(site.pathname)?.[1] ?? "evenements";

  let categoryId: number | null = null;
  const catRes = await fetch(`${wpBase}/categories?slug=${encodeURIComponent(categorySlug)}`, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
  });
  if (catRes.ok) {
    const cats = (await catRes.json()) as { id?: number }[];
    if (Array.isArray(cats) && cats[0]?.id) categoryId = cats[0].id;
  }
  if (categoryId === null) {
    warnings.push(
      `Catégorie « ${categorySlug} » introuvable : collecte élargie à tous les articles récents.`,
    );
  }

  const postsUrl =
    `${wpBase}/posts?per_page=20&_embed` + (categoryId ? `&categories=${categoryId}` : "");
  const postsRes = await fetch(postsUrl, { headers: BROWSER_HEADERS, cache: "no-store" });
  if (!postsRes.ok) {
    throw new Error(`API WordPress indisponible (HTTP ${postsRes.status}) sur ${site.host}.`);
  }

  const posts = (await postsRes.json()) as WpPost[];
  if (!Array.isArray(posts)) {
    throw new Error("Réponse WordPress inattendue : liste d'articles absente.");
  }

  const events: ScrapedEvent[] = [];
  for (const post of posts) {
    const title = decodeHtml(stripHtml(post.title?.rendered ?? "")).trim();
    if (!post.link || title.length < 4) continue;

    const excerpt = decodeHtml(stripHtml(post.excerpt?.rendered ?? ""));
    // Un article de presse n'est pas une fiche événement : sa date de
    // publication n'est pas celle du concert. On ne retient une date de début
    // que si le titre porte une date complète et explicite ; sinon on laisse
    // `startsAt` vide plutôt que d'inventer une échéance.
    const detected = findFrenchDate(title);
    const publishedAt = toIsoDate(post.date);

    events.push({
      sourceUrl: post.link,
      title,
      imageUrl: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
      date: detected
        ? formatDateFr(detected)
        : publishedAt
          ? `Publié le ${formatDateFr(publishedAt)}`
          : null,
      startsAt: detected,
      time: null,
      location: null,
      price: null,
      excerpt: excerpt || null,
    });
  }

  return { events: dropFinishedEvents(events, warnings), warnings };
}

// ============================================================
// Bandsintown
// ============================================================

/**
 * Bandsintown protège ses pages ville derrière Cloudflare et refuse
 * explicitement son API publique (403). La collecte serveur est donc
 * impossible : on le dit clairement au lieu de renvoyer une liste vide.
 */
async function scrapeBandsintown(url: string): Promise<ScrapeResult> {
  const response = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });

  if (response.status === 403 || response.status === 503) {
    throw new Error(
      "Bandsintown bloque la collecte serveur (protection Cloudflare, HTTP " +
        `${response.status}). Cette source doit rester désactivée : ses pages ville ` +
        "ne sont accessibles que depuis un navigateur, et son API publique refuse les accès applicatifs.",
    );
  }
  if (!response.ok) {
    throw new Error(`Bandsintown a répondu HTTP ${response.status}.`);
  }

  const html = await response.text();
  const warnings: string[] = [];
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const node of extractJsonLdEvents(html)) {
    const event = fromJsonLd(node, url);
    if (!event || seen.has(event.sourceUrl)) continue;
    seen.add(event.sourceUrl);
    events.push(event);
  }

  if (events.length === 0) {
    warnings.push("Bandsintown a répondu mais sans aucune donnée structurée exploitable.");
  }

  return { events: dropFinishedEvents(events, warnings).slice(0, 40), warnings };
}

// ============================================================
// Générique : tout site publiant du schema.org Event
// ============================================================

async function scrapeGenericJsonLd(url: string): Promise<ScrapeResult> {
  const response = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`La source a répondu HTTP ${response.status}.`);
  }

  const html = await response.text();
  const warnings: string[] = [];
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const node of extractJsonLdEvents(html)) {
    const event = fromJsonLd(node, url);
    if (!event || seen.has(event.sourceUrl)) continue;
    seen.add(event.sourceUrl);
    events.push(event);
  }

  if (events.length === 0) {
    warnings.push(
      "Aucun événement schema.org trouvé sur cette page. Un parseur dédié est nécessaire pour cette source.",
    );
  }

  return { events: dropFinishedEvents(events, warnings).slice(0, 40), warnings };
}

// ============================================================
// Helpers
// ============================================================

/** Écarte les événements déjà terminés depuis plus d'un jour. */
export function dropFinishedEvents(
  events: ScrapedEvent[],
  warnings: string[],
  now: Date = new Date(),
): ScrapedEvent[] {
  const cutoff = now.getTime() - 24 * 3600 * 1000;
  const kept = events.filter((event) => {
    if (!event.startsAt) return true; // sans date connue, on laisse l'admin trancher
    const time = Date.parse(event.startsAt);
    return !Number.isFinite(time) || time >= cutoff;
  });

  const dropped = events.length - kept.length;
  if (dropped > 0) warnings.push(`${dropped} événement(s) déjà passé(s) ignoré(s).`);
  return kept;
}

const YMD_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Normalise une date schema.org (ou WordPress) en ISO 8601, sinon null.
 *
 * Les dates sans heure (`2026-08-18`) sont ancrées à midi UTC : parsées à
 * minuit, elles basculeraient d'un jour dès que le fuseau du serveur est
 * négatif — c'est ce qui affichait « 17 août » pour un concert du 18.
 */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12)).toISOString();
  }

  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

/**
 * Libellé affiché. On lit les composants Y-M-D tels que publiés par la source
 * plutôt que de reconvertir depuis un instant : la date d'un concert est celle
 * du lieu, pas celle du fuseau du serveur.
 */
export function formatDateLabel(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  const ymd = YMD_PREFIX.exec(raw);
  if (ymd) {
    return formatDateFr(
      new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12)).toISOString(),
    );
  }

  const iso = toIsoDate(raw);
  return iso ? formatDateFr(iso) : null;
}

/** `2026-08-18T21:30:00-04:00` → `21:30`. Renvoie null si l'heure est absente. */
export function extractTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /T(\d{2}:\d{2})/.exec(value)?.[1] ?? null;
}

export function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, fevrier: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5,
  juin: 6, juillet: 7, juil: 7, aout: 8, septembre: 9, sept: 9, octobre: 10,
  oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12,
};

/**
 * Cherche une date française COMPLÈTE dans un texte (« 18 août 2026 »).
 *
 * L'année doit être écrite. Deviner l'année à partir du jour et du mois
 * produisait des échéances fantaisistes (un article du 24 juillet devenait un
 * événement du 24 juillet de l'année suivante) : mieux vaut aucune date.
 */
export function findFrenchDate(text: string): string | null {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const match = /\b(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{4})\b/.exec(normalized);
  if (!match) return null;

  const day = Number(match[1]);
  const month = FRENCH_MONTHS[match[2]];
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31 || year < 2000 || year > 2100) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  // Rejette les dates inexistantes du type « 31 février ».
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed.toISOString();
}

function formatLocation(location: JsonLdEvent["location"]): string | null {
  if (!location) return null;
  const parts = [
    location.name,
    location.address?.addressLocality,
    location.address?.addressRegion,
  ]
    .map((part) => (typeof part === "string" ? decodeHtml(part).trim() : ""))
    .filter(Boolean);

  // Évite « Cap Haitien, Cap haitien » : la comparaison ignore casse et accents.
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }

  return unique.length > 0 ? unique.slice(0, 2).join(", ") : null;
}

function formatOffers(offers: unknown): string | null {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of list) {
    if (!offer || typeof offer !== "object") continue;
    const record = offer as Record<string, unknown>;
    const raw = record.price ?? record.lowPrice;
    if (raw === undefined || raw === null || raw === "") continue;

    const amount = Number(raw);
    if (Number.isFinite(amount) && amount === 0) return "Gratuit";
    const currency = typeof record.priceCurrency === "string" ? ` ${record.priceCurrency}` : "";
    return `${raw}${currency}`.trim();
  }
  return null;
}

/** Entités nommées rencontrées dans les flux WordPress et les pages FR. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "\u2019", lsquo: "\u2018", sbquo: "\u201a",
  ldquo: "\u201c", rdquo: "\u201d", bdquo: "\u201e",
  laquo: "\u00ab", raquo: "\u00bb", hellip: "\u2026",
  ndash: "\u2013", mdash: "\u2014", middot: "\u00b7", bull: "\u2022",
  deg: "\u00b0", euro: "\u20ac", pound: "\u00a3", cent: "\u00a2",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  agrave: "à", acirc: "â", ccedil: "ç",
  icirc: "î", iuml: "ï", ocirc: "ô", ugrave: "ù", ucirc: "û", uuml: "ü",
  Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç",
};

export function decodeHtml(str: string): string {
  return str
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name] ?? match)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\u00a0/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
