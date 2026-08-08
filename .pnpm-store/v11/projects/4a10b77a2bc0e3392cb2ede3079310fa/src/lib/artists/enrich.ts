/**
 * Collecte contrôlée des données publiques d'une fiche artiste.
 *
 * Chaque extracteur part exclusivement de l'URL enregistrée dans la fiche.
 * Les résultats sont persistés et les médias choisis sont archivés dans
 * Supabase Storage afin de ne pas dépendre d'URL temporaires.
 */
import "server-only";

import { lookup } from "node:dns/promises";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSpotifyArtistById,
  getSpotifyArtistMonthlyListeners,
  isSpotifyConfigured,
  nameSimilarity,
} from "@/lib/spotify/api-client";
import {
  extractPageMetadata,
  mergeImages,
  type ExtractedImage,
} from "@/lib/artists/enrich-html";
import {
  ARTIST_METRIC_KEYS,
  buildMetricSummaries,
  type ArtistMetricDatabaseRow,
  type ArtistMetricSummary,
  type ArtistMetricValues,
} from "@/lib/artists/artist-metrics";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 PlaneteHMI/1.0";

export const ENRICHABLE_FIELDS = [
  "url_spotify",
  "url_deezer",
  "url_youtube",
  "url_youtube_music",
  "url_audiomack",
  "url_apple_music",
  "url_soundcloud",
  "url_tidal",
  "url_instagram",
  "url_tiktok",
  "url_facebook",
  "url_twitter",
  "url_threads",
  "url_website",
  "url_wikipedia",
  "url_chartmetric",
  "url_shazam",
] as const;

export type EnrichableField = (typeof ENRICHABLE_FIELDS)[number];

const EXPECTED_HOSTS: Partial<Record<EnrichableField, string[]>> = {
  url_spotify: ["spotify.com"],
  url_deezer: ["deezer.com"],
  url_youtube: ["youtube.com", "youtu.be"],
  url_youtube_music: ["youtube.com"],
  url_audiomack: ["audiomack.com"],
  url_apple_music: ["music.apple.com"],
  url_soundcloud: ["soundcloud.com"],
  url_tidal: ["tidal.com"],
  url_instagram: ["instagram.com"],
  url_tiktok: ["tiktok.com"],
  url_facebook: ["facebook.com", "fb.com"],
  url_twitter: ["x.com", "twitter.com"],
  url_threads: ["threads.net"],
  url_wikipedia: ["wikipedia.org", "fr.wikipedia.org", "en.wikipedia.org"],
  url_chartmetric: ["chartmetric.com"],
  url_shazam: ["shazam.com"],
};

export interface PlatformData {
  platform: string;
  field: EnrichableField;
  externalId: string | null;
  externalUrl: string;
  name: string | null;
  description: string | null;
  images: ExtractedImage[];
  monthlyListeners: number | null;
  followers: number | null;
  subscriberCount: number | null;
  totalViews: number | null;
  popularity: number | null;
  genres: string[];
  albumCount: number | null;
  trackCount: number | null;
  details: Record<string, string | number | boolean | string[] | null>;
  method: string;
  warnings: string[];
  error: string | null;
  fetchedAt: string;
}

interface ArtistUrlRecord extends Record<EnrichableField, string | null> {
  id: string;
  name: string;
}

interface StoredIdentity {
  platform: string;
  external_id: string | null;
  external_url: string | null;
  platform_name: string | null;
  metadata: Record<string, unknown> | null;
}

interface YouTubeChannelPayload {
  snippet?: {
    title?: string;
    description?: string;
    country?: string;
    publishedAt?: string;
    customUrl?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  brandingSettings?: {
    channel?: { country?: string };
    image?: { bannerExternalUrl?: string };
  };
  topicDetails?: { topicCategories?: string[] };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

export interface StoredEnrichment {
  results: Record<string, PlatformData>;
  availableFields: EnrichableField[];
  metricSummaries: ArtistMetricSummary[];
}

function makeBase(field: EnrichableField, url: string): PlatformData {
  return {
    platform: field.replace(/^url_/, ""),
    field,
    externalId: null,
    externalUrl: url,
    name: null,
    description: null,
    images: [],
    monthlyListeners: null,
    followers: null,
    subscriberCount: null,
    totalViews: null,
    popularity: null,
    genres: [],
    albumCount: null,
    trackCount: null,
    details: {},
    method: "none",
    warnings: [],
    error: null,
    fetchedAt: new Date().toISOString(),
  };
}

function safeMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message
    .replace(/([?&](?:key|token|access_token|client_secret)=)[^&\s]+/gi, "$1[masqué]")
    .replace(/\bAIza[\w-]{20,}\b/g, "[clé masquée]")
    .slice(0, 300);
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "0.0.0.0") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) return true;
  if (isIP(normalized) !== 4) return false;
  const [a, b] = normalized.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function assertPublicUrl(rawUrl: string, expectedHosts?: string[]): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL invalide.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Seules les URL HTTP et HTTPS sont acceptées.");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (
    expectedHosts?.length &&
    !expectedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  ) {
    throw new Error(`Cette URL ne correspond pas à la plateforme attendue (${expectedHosts.join(", ")}).`);
  }
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Adresse locale refusée.");
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) throw new Error("Adresse réseau privée refusée.");

  try {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("Adresse réseau non publique refusée.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("refusée")) throw error;
    throw new Error("Le domaine indiqué est introuvable.");
  }
  return parsed;
}

async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  expectedHosts?: string[],
): Promise<Response> {
  let current = await assertPublicUrl(rawUrl, expectedHosts);
  for (let redirect = 0; redirect < 4; redirect++) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "*/*",
        "User-Agent": USER_AGENT,
        ...init.headers,
      },
      cache: "no-store",
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    current = await assertPublicUrl(new URL(location, current).toString());
  }
  throw new Error("Trop de redirections.");
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > limit) throw new Error("Réponse trop volumineuse.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new Error("Réponse trop volumineuse.");
  return bytes;
}

async function fetchPageMetadata(
  url: string,
  label: string,
  expectedHosts?: string[],
): Promise<ReturnType<typeof extractPageMetadata>> {
  const response = await safeFetch(url, { headers: { Accept: "text/html,application/xhtml+xml" } }, expectedHosts);
  if (!response.ok) throw new Error(`${label} a répondu HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error(`${label} n'a pas renvoyé une page web exploitable.`);
  }
  const html = new TextDecoder().decode(await readLimited(response, MAX_HTML_BYTES));
  return extractPageMetadata(html, response.url || url, label);
}

function applyPageMetadata(base: PlatformData, page: ReturnType<typeof extractPageMetadata>, method: string) {
  base.name ??= page.name;
  base.description ??= page.description;
  base.images = mergeImages(base.images, page.images);
  base.details = { ...page.details, ...base.details };
  base.method = base.method === "none" ? method : `${base.method}+${method}`;
}

async function enrichGeneric(field: EnrichableField, url: string, label: string): Promise<PlatformData> {
  const base = makeBase(field, url);
  try {
    const page = await fetchPageMetadata(url, label, EXPECTED_HOSTS[field]);
    applyPageMetadata(base, page, "page_metadata");
    const hasOnlyInstagramShell =
      field === "url_instagram" &&
      base.name?.trim().toLowerCase() === "instagram" &&
      !base.description &&
      base.images.length === 0;
    if ((!base.name && !base.description && base.images.length === 0) || hasOnlyInstagramShell) {
      base.error = field === "url_instagram"
        ? "Instagram n'a transmis aucune donnée publique exploitable. La collecte officielle d'un profil nécessite une connexion Meta autorisée."
        : "La plateforme n'a exposé aucune donnée publique exploitable sur cette page.";
    }
  } catch (error) {
    base.error = safeMessage(error, `Collecte ${label} impossible.`);
  }
  return base;
}

export async function enrichSpotify(url: string): Promise<PlatformData> {
  const field: EnrichableField = "url_spotify";
  const base = makeBase(field, url);
  try {
    await assertPublicUrl(url, EXPECTED_HOSTS[field]);
    const id = /artist\/([A-Za-z0-9]{22})/.exec(url)?.[1] ?? null;
    if (!id) throw new Error("URL Spotify invalide : identifiant artiste absent.");
    base.externalId = id;

    const metrics = await getSpotifyArtistMonthlyListeners(id);
    base.monthlyListeners = metrics.monthlyListeners;
    base.followers = metrics.followers;
    base.method = metrics.method;

    if (isSpotifyConfigured()) {
      try {
        const profile = await getSpotifyArtistById(id);
        if (profile) {
          base.name = profile.name;
          base.followers ??= profile.followers;
          base.genres = profile.genres;
          base.popularity = profile.popularity;
          if (profile.imageUrl) {
            base.images.push({ url: profile.imageUrl, label: "Photo Spotify (API)", type: "avatar" });
          }
          if (!base.method.split("+").includes("web_api")) {
            base.method = base.method === "none" ? "web_api" : `${base.method}+web_api`;
          }
        }
      } catch (error) {
        base.warnings.push(safeMessage(error, "API Spotify temporairement indisponible."));
      }
    } else {
      base.warnings.push(
        "API Spotify non configurée : le nom et l'image publics sont collectés, mais les abonnés et la popularité ne sont pas disponibles.",
      );
    }

    try {
      const response = await safeFetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/artist/${id}`)}`,
        { headers: { Accept: "application/json" } },
        EXPECTED_HOSTS[field],
      );
      if (!response.ok) throw new Error(`Spotify oEmbed a répondu HTTP ${response.status}.`);
      const data = await response.json() as {
        title?: string;
        thumbnail_url?: string;
        provider_name?: string;
      };
      base.name ??= data.title?.trim() || null;
      if (data.thumbnail_url) {
        base.images = mergeImages(
          base.images,
          [{ url: data.thumbnail_url, label: "Photo Spotify (oEmbed)", type: "avatar" }],
        );
      }
      base.details.provider = data.provider_name ?? "Spotify";
      base.method = base.method === "none" ? "spotify_oembed" : `${base.method}+spotify_oembed`;
    } catch (error) {
      base.warnings.push(safeMessage(error, "Métadonnées visuelles Spotify indisponibles."));
    }
  } catch (error) {
    base.error = safeMessage(error, "Erreur Spotify.");
  }
  return base;
}

export async function enrichDeezer(url: string): Promise<PlatformData> {
  const field: EnrichableField = "url_deezer";
  const base = makeBase(field, url);
  try {
    await assertPublicUrl(url, EXPECTED_HOSTS[field]);
    const id = /artist\/(\d+)/.exec(url)?.[1] ?? null;
    if (!id) throw new Error("URL Deezer invalide : identifiant artiste absent.");
    base.externalId = id;
    const response = await safeFetch(`https://api.deezer.com/artist/${id}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Deezer a répondu HTTP ${response.status}.`);
    const data = await response.json() as Record<string, unknown>;
    if (data.error) throw new Error("Deezer ne reconnaît pas cet artiste.");
    base.name = typeof data.name === "string" ? data.name : null;
    base.followers = typeof data.nb_fan === "number" ? data.nb_fan : null;
    base.albumCount = typeof data.nb_album === "number" ? data.nb_album : null;
    base.method = "public_api";
    for (const [key, label] of [
      ["picture_xl", "Photo Deezer XL"],
      ["picture_big", "Photo Deezer grande"],
      ["picture_medium", "Photo Deezer moyenne"],
      ["picture", "Photo Deezer"],
    ] as const) {
      if (typeof data[key] === "string") base.images.push({ url: data[key], label, type: "avatar" });
    }
    base.images = mergeImages(base.images);

    const topResponse = await safeFetch(`https://api.deezer.com/artist/${id}/top?limit=100`, { headers: { Accept: "application/json" } });
    if (topResponse.ok) {
      const top = await topResponse.json() as { total?: number };
      base.trackCount = typeof top.total === "number" ? top.total : null;
    }
  } catch (error) {
    base.error = safeMessage(error, "Erreur Deezer.");
  }
  return base;
}

async function resolveYouTubeChannelId(url: string): Promise<string | null> {
  const direct = /(UC[\w-]{22})/.exec(url)?.[1];
  if (direct) return direct;
  const apiKey = process.env.YOUTUBE_API_KEY;
  const handle = /@([\w.-]+)/.exec(url)?.[1];
  if (handle && apiKey) {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
      { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (response.ok) {
      const data = await response.json() as { items?: { id?: string }[] };
      if (data.items?.[0]?.id) return data.items[0].id;
    }
  }
  try {
    const response = await safeFetch(url, { headers: { Accept: "text/html" } }, EXPECTED_HOSTS.url_youtube);
    if (!response.ok) return null;
    const html = new TextDecoder().decode(await readLimited(response, MAX_HTML_BYTES));
    return /(?:"channelId"|"externalId")\s*:\s*"(UC[\w-]{22})"/.exec(html)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function enrichYouTube(
  url: string,
  field: EnrichableField = "url_youtube",
  preferredChannelId?: string,
): Promise<PlatformData> {
  const base = makeBase(field, url);
  try {
    await assertPublicUrl(url, EXPECTED_HOSTS[field]);
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("La clé YouTube n'est pas configurée sur le serveur.");
    const channelId = preferredChannelId || await resolveYouTubeChannelId(url);
    if (!channelId) throw new Error("Impossible d'identifier la chaîne YouTube depuis cette URL.");
    base.externalId = channelId;

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,topicDetails,contentDetails,status&id=${channelId}&key=${apiKey}`,
      { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { errors?: { reason?: string }[] } } | null;
      const reason = payload?.error?.errors?.[0]?.reason;
      throw new Error(reason ? `YouTube a refusé la collecte (${reason}).` : `YouTube a répondu HTTP ${response.status}.`);
    }
    const data = await response.json() as { items?: YouTubeChannelPayload[] };
    const channel = data.items?.[0];
    if (!channel) throw new Error("Chaîne YouTube introuvable.");

    base.name = channel.snippet?.title ?? null;
    base.description = channel.snippet?.description ?? null;
    base.subscriberCount = channel.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount) : null;
    base.totalViews = channel.statistics?.viewCount ? Number(channel.statistics.viewCount) : null;
    base.trackCount = channel.statistics?.videoCount ? Number(channel.statistics.videoCount) : null;
    base.details = {
      country: channel.snippet?.country ?? channel.brandingSettings?.channel?.country ?? null,
      channel_created_at: channel.snippet?.publishedAt ?? null,
      custom_url: channel.snippet?.customUrl ?? null,
      uploads_playlist_id: channel.contentDetails?.relatedPlaylists?.uploads ?? null,
      hidden_subscribers: channel.statistics?.hiddenSubscriberCount ?? null,
      topics: channel.topicDetails?.topicCategories ?? [],
    };
    for (const [size, thumbnail] of Object.entries(channel.snippet?.thumbnails ?? {})) {
      const image = thumbnail as { url?: string };
      if (image.url) base.images.push({ url: image.url, label: `Photo YouTube (${size})`, type: "avatar" });
    }
    const banner = channel.brandingSettings?.image?.bannerExternalUrl;
    if (banner) base.images.push({ url: banner, label: "Bannière YouTube", type: "banner" });
    base.images = mergeImages(base.images);
    base.method = "youtube_data_api";
  } catch (error) {
    base.error = safeMessage(error, "Erreur YouTube.");
  }
  return base;
}

export async function enrichAudiomack(url: string): Promise<PlatformData> {
  const field: EnrichableField = "url_audiomack";
  const base = makeBase(field, url);
  try {
    const response = await safeFetch(url, { headers: { Accept: "text/html" } }, EXPECTED_HOSTS[field]);
    if (!response.ok) throw new Error(`Audiomack a répondu HTTP ${response.status}.`);
    const html = new TextDecoder().decode(await readLimited(response, MAX_HTML_BYTES));
    applyPageMetadata(base, extractPageMetadata(html, response.url || url, "Audiomack"), "page_metadata");

    const nextData = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (nextData) {
      try {
        const payload = JSON.parse(nextData[1]);
        const artist = payload?.props?.pageProps?.artist ?? payload?.props?.pageProps?.data?.artist;
        if (artist) {
          base.name = artist.name ?? base.name;
          base.followers = artist.followers_count ?? artist.total_followers ?? null;
          base.totalViews = artist.total_plays ?? null;
          base.externalId = artist.id ? String(artist.id) : artist.url_slug ?? null;
          if (artist.image) base.images.push({ url: artist.image, label: "Photo Audiomack", type: "avatar" });
          if (artist.image_banner) base.images.push({ url: artist.image_banner, label: "Bannière Audiomack", type: "banner" });
          base.method += "+next_data";
        }
      } catch {
        base.warnings.push("Les données internes Audiomack étaient illisibles ; les métadonnées publiques ont été conservées.");
      }
    }
    base.images = mergeImages(base.images);
  } catch (error) {
    base.error = safeMessage(error, "Erreur Audiomack.");
  }
  return base;
}

export async function enrichSoundCloud(url: string): Promise<PlatformData> {
  const field: EnrichableField = "url_soundcloud";
  const base = await enrichGeneric(field, url, "SoundCloud");
  try {
    const response = await safeFetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      { headers: { Accept: "application/json" } },
    );
    if (response.ok) {
      const data = await response.json() as { author_name?: string; author_url?: string; thumbnail_url?: string; title?: string };
      base.name ??= data.author_name ?? data.title ?? null;
      if (data.thumbnail_url) {
        base.images = mergeImages(
          [{ url: data.thumbnail_url, label: "Photo SoundCloud (oEmbed)", type: "avatar" }],
          base.images,
        );
      }
      base.details.author_url = data.author_url ?? null;
      base.method = base.method === "none" ? "oembed" : `${base.method}+oembed`;
    }
  } catch (error) {
    base.warnings.push(safeMessage(error, "oEmbed SoundCloud indisponible."));
  }
  return base;
}

export async function enrichTikTok(url: string): Promise<PlatformData> {
  const field: EnrichableField = "url_tiktok";
  const base = await enrichGeneric(field, url, "TikTok");
  try {
    const response = await safeFetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { Accept: "application/json" } },
    );
    if (response.ok) {
      const data = await response.json() as { author_name?: string; author_url?: string; thumbnail_url?: string; title?: string };
      base.name ??= data.author_name ?? null;
      base.description ??= data.title ?? null;
      if (data.thumbnail_url) {
        base.images = mergeImages(
          [{ url: data.thumbnail_url, label: "Image TikTok (oEmbed)", type: "cover" }],
          base.images,
        );
      }
      base.details.author_url = data.author_url ?? null;
      base.method = base.method === "none" ? "oembed" : `${base.method}+oembed`;
    }
  } catch (error) {
    base.warnings.push(safeMessage(error, "oEmbed TikTok indisponible."));
  }
  return base;
}

/**
 * Enrichit depuis Wikipedia en extrayant automatiquement :
 * - Bio (premier paragraphe)
 * - Date et lieu de naissance (infobox)
 * - Nom réel (infobox)
 * - Image principale
 * - Genres musicaux
 */
export async function enrichWikipedia(url: string): Promise<PlatformData> {
  const field: EnrichableField = "url_wikipedia";
  const base = makeBase(field, url);
  base.platform = "wikipedia";

  try {
    // Extraire le titre de la page depuis l'URL
    // Format: https://fr.wikipedia.org/wiki/Nom_de_l'artiste
    const urlObj = new URL(url);
    const titleMatch = urlObj.pathname.match(/\/wiki\/(.+)/);
    if (!titleMatch) {
      throw new Error("URL Wikipedia invalide (format attendu: /wiki/Titre)");
    }

    const pageTitle = decodeURIComponent(titleMatch[1]);
    const lang = urlObj.hostname.split('.')[0] || 'fr'; // fr ou en

    // 1. Récupérer les données via l'API Wikipedia
    const apiUrl = `https://${lang}.wikipedia.org/w/api.php?` +
      `action=query&titles=${encodeURIComponent(pageTitle)}&` +
      `prop=extracts|pageimages|categories|revisions&` +
      `exintro=1&explaintext=1&` +
      `piprop=original&` +
      `rvprop=content&rvsection=0&` +
      `format=json&origin=*`;

    const response = await safeFetch(apiUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`API Wikipedia a répondu HTTP ${response.status}`);
    }

    const data = await response.json() as {
      query?: {
        pages?: Record<string, {
          title?: string;
          extract?: string;
          original?: { source?: string };
          categories?: Array<{ title?: string }>;
          revisions?: Array<{ '*'?: string }>;
        }>;
      };
    };

    const pages = data.query?.pages;
    if (!pages) {
      throw new Error("Aucune donnée retournée par l'API Wikipedia");
    }

    const page = Object.values(pages)[0];
    if (!page || page.title === undefined) {
      throw new Error("Page Wikipedia introuvable");
    }

    // 2. Extraire le nom de l'artiste
    base.name = page.title;
    base.method = "wikipedia_api";

    // 3. Extraire la bio (premier paragraphe)
    if (page.extract) {
      // Nettoyer et limiter la bio
      const bio = page.extract
        .split('\n')[0] // Premier paragraphe seulement
        .trim()
        .substring(0, 500); // Limiter à 500 caractères
      
      if (bio.length > 0) {
        base.description = bio;
        base.details.bio_source = "wikipedia_extract";
      }
    }

    // 4. Extraire l'image principale
    if (page.original?.source) {
      base.images.push({
        url: page.original.source,
        label: "Photo Wikipedia",
        type: "avatar",
      });
    }

    // 5. Extraire les genres depuis les catégories
    if (page.categories) {
      const genres: string[] = [];
      const categoryPatterns = [
        /musicien.*\b(konpa|raboday|rap|hip-hop|r&b|jazz|blues|gospel|pop|dancehall)\b/i,
        /artiste.*\b(konpa|raboday|rap|hip-hop|r&b|jazz|blues|gospel|pop|dancehall)\b/i,
      ];

      for (const cat of page.categories) {
        if (!cat.title) continue;
        for (const pattern of categoryPatterns) {
          const match = cat.title.match(pattern);
          if (match && match[1]) {
            genres.push(match[1].toLowerCase());
          }
        }
      }

      if (genres.length > 0) {
        base.genres = [...new Set(genres)];
      }
    }

    // 6. Parser l'infobox depuis le wikitext pour extraire date/lieu de naissance, nom réel
    if (page.revisions && page.revisions[0] && page.revisions[0]['*']) {
      const wikitext = page.revisions[0]['*'];
      
      // Extraire l'infobox
      const infoboxMatch = wikitext.match(/\{\{Infobox.*?\n([\s\S]*?)\n\}\}/i);
      if (infoboxMatch) {
        const infobox = infoboxMatch[1];

        // Date de naissance (formats: |date de naissance=, |naissance=, |birth_date=)
        const birthDatePatterns = [
          /\|.*?(?:date[_ ]de[_ ]naissance|naissance|birth[_ ]date)\s*=\s*\{\{(?:date|Date)[^}]*\|([^}|]+)\|([^}|]+)\|([^}|]+)/i,
          /\|.*?(?:date[_ ]de[_ ]naissance|naissance|birth[_ ]date)\s*=\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i,
        ];

        for (const pattern of birthDatePatterns) {
          const match = infobox.match(pattern);
          if (match) {
            base.details.birth_date_raw = `${match[1]}/${match[2]}/${match[3]}`;
            break;
          }
        }

        // Lieu de naissance (formats: |lieu de naissance=, |birth_place=)
        const birthPlaceMatch = infobox.match(/\|.*?(?:lieu[_ ]de[_ ]naissance|birth[_ ]place)\s*=\s*\[\[([^\]|]+)/i);
        if (birthPlaceMatch) {
          base.details.birth_place = birthPlaceMatch[1].trim();
        }

        // Nom réel (formats: |nom de naissance=, |birth_name=, |vrai nom=)
        const realNameMatch = infobox.match(/\|.*?(?:nom[_ ]de[_ ]naissance|birth[_ ]name|vrai[_ ]nom|real[_ ]name)\s*=\s*([^\n|]+)/i);
        if (realNameMatch) {
          base.details.real_name = realNameMatch[1]
            .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1') // Enlever les liens wiki
            .replace(/<[^>]+>/g, '') // Enlever les balises HTML
            .trim();
        }

        // Genres musicaux de l'infobox
        const genreMatch = infobox.match(/\|.*?genre[s]?\s*=\s*([^\n]+)/i);
        if (genreMatch) {
          const genresText = genreMatch[1]
            .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
            .replace(/<[^>]+>/g, '')
            .trim();
          
          const extractedGenres = genresText
            .split(/[,;]/)
            .map(g => g.trim().toLowerCase())
            .filter(g => g.length > 0 && g.length < 30);
          
          if (extractedGenres.length > 0) {
            base.genres = [...new Set([...base.genres, ...extractedGenres])];
          }
        }

        // Années actives (pour career_start_year)
        const yearsMatch = infobox.match(/\|.*?(?:années[_ ]actives?|years[_ ]active)\s*=\s*(?:depuis\s+)?(\d{4})/i);
        if (yearsMatch) {
          base.details.career_start_year = parseInt(yearsMatch[1]);
        }
      }
    }

    base.details.language = lang;
    base.details.page_title = pageTitle;

  } catch (error) {
    base.error = safeMessage(error, "Erreur Wikipedia.");
    base.warnings.push("Impossible d'extraire les données de Wikipedia. Vérifiez l'URL.");
  }

  return base;
}

const ENRICHERS: Record<EnrichableField, (url: string) => Promise<PlatformData>> = {
  url_spotify: enrichSpotify,
  url_deezer: enrichDeezer,
  url_youtube: (url) => enrichYouTube(url, "url_youtube"),
  url_youtube_music: (url) => enrichYouTube(url, "url_youtube_music"),
  url_audiomack: enrichAudiomack,
  url_apple_music: (url) => enrichGeneric("url_apple_music", url, "Apple Music"),
  url_soundcloud: enrichSoundCloud,
  url_tidal: (url) => enrichGeneric("url_tidal", url, "TIDAL"),
  url_instagram: (url) => enrichGeneric("url_instagram", url, "Instagram"),
  url_tiktok: enrichTikTok,
  url_facebook: (url) => enrichGeneric("url_facebook", url, "Facebook"),
  url_twitter: (url) => enrichGeneric("url_twitter", url, "X"),
  url_threads: (url) => enrichGeneric("url_threads", url, "Threads"),
  url_website: (url) => enrichGeneric("url_website", url, "Site officiel"),
  url_wikipedia: enrichWikipedia,
  url_chartmetric: (url) => enrichGeneric("url_chartmetric", url, "Chartmetric"),
  url_shazam: (url) => enrichGeneric("url_shazam", url, "Shazam"),
};

export function hasCollectedData(result: PlatformData): boolean {
  const hasSpecificName = Boolean(
    result.name &&
    !(result.platform === "instagram" && result.name.trim().toLowerCase() === "instagram"),
  );
  return Boolean(
    hasSpecificName ||
    result.description ||
    result.images.length ||
    result.genres.length ||
    ARTIST_METRIC_KEYS.some((key) => result[key] !== null),
  );
}

export function validateCollectedIdentity(
  result: PlatformData,
  artistName: string,
  trustedIdentity = false,
): PlatformData {
  if (result.error) return result;

  if (!hasCollectedData(result)) {
    result.error = "La plateforme n'a retourné aucune donnée exploitable pour cette URL.";
    return result;
  }

  if (
    !trustedIdentity &&
    (result.field === "url_youtube" || result.field === "url_youtube_music") &&
    result.name &&
    nameSimilarity(artistName, result.name) < 0.45
  ) {
    result.error =
      `La chaîne YouTube « ${result.name} » ne correspond pas à l'artiste « ${artistName} ». ` +
      "L'URL n'a pas été enregistrée et aucune donnée n'a été associée.";
  }
  return result;
}

async function getArtistUrls(supabase: SupabaseClient, artistId: string): Promise<ArtistUrlRecord> {
  const { data, error } = await supabase
    .from("artists")
    .select(`id, name, ${ENRICHABLE_FIELDS.join(", ")}`)
    .eq("id", artistId)
    .single();
  if (error || !data) throw new Error("Artiste introuvable.");
  return data as unknown as ArtistUrlRecord;
}

async function collectFromArtistUrl(
  supabase: SupabaseClient,
  artist: ArtistUrlRecord,
  field: EnrichableField,
  url: string,
): Promise<PlatformData> {
  if (field !== "url_youtube" && field !== "url_youtube_music") {
    return validateCollectedIdentity(await ENRICHERS[field](url), artist.name);
  }

  const { data: mappedChannel, error } = await supabase
    .from("youtube_channels")
    .select("channel_id, channel_url, channel_handle")
    .eq("artist_id", artist.id)
    .eq("status", "active")
    .eq("is_active", true)
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Impossible de vérifier la chaîne YouTube approuvée de cet artiste.");

  const normalizedUrl = url.trim().replace(/\/+$/, "").toLowerCase();
  const mappedUrl = typeof mappedChannel?.channel_url === "string"
    ? mappedChannel.channel_url.trim().replace(/\/+$/, "").toLowerCase()
    : "";
  const mappedHandle = typeof mappedChannel?.channel_handle === "string"
    ? mappedChannel.channel_handle.trim().toLowerCase()
    : "";
  const urlMatchesMappedChannel =
    Boolean(mappedUrl && normalizedUrl === mappedUrl) ||
    Boolean(mappedHandle && normalizedUrl.includes(`/${mappedHandle}`));
  const preferredChannelId =
    urlMatchesMappedChannel && mappedChannel && typeof mappedChannel.channel_id === "string"
      ? mappedChannel.channel_id
      : undefined;
  const result = await enrichYouTube(url, field, preferredChannelId);
  return validateCollectedIdentity(result, artist.name, Boolean(preferredChannelId));
}

async function persistResult(
  supabase: SupabaseClient,
  artistId: string,
  result: PlatformData,
): Promise<void> {
  if (result.error || !hasCollectedData(result)) return;

  const freshMetrics: ArtistMetricValues = {
    monthlyListeners: result.monthlyListeners,
    followers: result.followers,
    subscriberCount: result.subscriberCount,
    totalViews: result.totalViews,
    popularity: result.popularity,
    albumCount: result.albumCount,
    trackCount: result.trackCount,
  };
  const { data: existing } = await supabase
    .from("artist_platform_identities")
    .select("platform, external_id, external_url, platform_name, metadata")
    .eq("artist_id", artistId)
    .eq("platform", result.platform)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previous = existing ? storedToPlatformData(existing as StoredIdentity) : null;
  if (previous) {
    result.name ??= previous.name;
    result.description ??= previous.description;
    result.images = mergeImages(result.images, previous.images);
    result.monthlyListeners ??= previous.monthlyListeners;
    result.followers ??= previous.followers;
    result.subscriberCount ??= previous.subscriberCount;
    result.totalViews ??= previous.totalViews;
    result.popularity ??= previous.popularity;
    result.albumCount ??= previous.albumCount;
    result.trackCount ??= previous.trackCount;
    if (!result.genres.length) result.genres = previous.genres;
    result.details = { ...previous.details, ...result.details };
  }
  const metadata = {
    field: result.field,
    description: result.description,
    monthly_listeners: result.monthlyListeners,
    followers: result.followers,
    subscriber_count: result.subscriberCount,
    total_views: result.totalViews,
    popularity: result.popularity,
    genres: result.genres,
    album_count: result.albumCount,
    track_count: result.trackCount,
    images: result.images,
    details: result.details,
    warnings: result.warnings,
    error: result.error,
    fetched_at: result.fetchedAt,
    method: result.method,
  };
  const { error } = await supabase.from("artist_platform_identities").upsert(
    {
      artist_id: artistId,
      platform: result.platform,
      external_id: result.externalId ?? `manual_${artistId}_${result.platform}`,
      external_url: result.externalUrl,
      platform_name: result.name,
      platform_image_url: result.images.find((image) => image.type === "avatar")?.url ?? result.images[0]?.url ?? null,
      metadata,
      match_method: "manual_admin",
      last_seen_at: result.fetchedAt,
      updated_at: result.fetchedAt,
    },
    { onConflict: "artist_id,platform" },
  );
  if (error) throw new Error(`Impossible d'enregistrer la collecte ${result.platform}.`);

  if (ARTIST_METRIC_KEYS.some((key) => freshMetrics[key] !== null)) {
    const { error: snapshotError } = await supabase
      .from("artist_metric_snapshots")
      .upsert(
        {
          artist_id: artistId,
          platform: result.platform,
          source_field: result.field,
          collected_at: result.fetchedAt,
          monthly_listeners: freshMetrics.monthlyListeners,
          followers: freshMetrics.followers,
          subscriber_count: freshMetrics.subscriberCount,
          total_views: freshMetrics.totalViews,
          popularity: freshMetrics.popularity,
          album_count: freshMetrics.albumCount,
          track_count: freshMetrics.trackCount,
        },
        {
          onConflict: "artist_id,platform,collected_at",
          ignoreDuplicates: true,
        },
      );
    if (snapshotError) {
      throw new Error(`Les indicateurs ${result.platform} n'ont pas pu être enregistrés.`);
    }
  }
}

export async function enrichArtistFromField(
  supabase: SupabaseClient,
  artistId: string,
  field: EnrichableField,
  urlOverride?: string,
): Promise<PlatformData> {
  const artist = await getArtistUrls(supabase, artistId);
  const url = urlOverride?.trim() || artist[field]?.trim();
  if (!url) throw new Error(`L'URL ${field.replace(/^url_/, "")} est vide. Enregistrez-la avant de collecter.`);
  const result = await collectFromArtistUrl(supabase, artist, field, url);
  await persistResult(supabase, artistId, result);
  if (!result.error && urlOverride?.trim() && urlOverride.trim() !== artist[field]?.trim()) {
    const { error } = await supabase.from("artists").update({ [field]: url }).eq("id", artistId);
    if (error) throw new Error("Données collectées, mais impossible d'enregistrer cette URL.");
  }
  return result;
}

export async function enrichArtistFromAllFields(
  supabase: SupabaseClient,
  artistId: string,
  urlOverrides?: Partial<Record<EnrichableField, string>>,
): Promise<Record<string, PlatformData>> {
  const artist = await getArtistUrls(supabase, artistId);
  const fields = ENRICHABLE_FIELDS.filter(
    (field) => Boolean(urlOverrides?.[field]?.trim() || artist[field]?.trim()),
  );
  if (!fields.length) throw new Error("Aucune URL n'est enregistrée sur cette fiche.");

  const entries = await Promise.all(fields.map(async (field) => {
    const url = urlOverrides?.[field]?.trim() || artist[field]!.trim();
    const result = await collectFromArtistUrl(supabase, artist, field, url);
    try {
      await persistResult(supabase, artistId, result);
      if (!result.error && url !== artist[field]?.trim()) {
        const { error } = await supabase.from("artists").update({ [field]: url }).eq("id", artistId);
        if (error) throw new Error(`L'URL ${result.platform} n'a pas pu être enregistrée.`);
      }
    } catch (error) {
      result.error ??= safeMessage(error, "Persistance impossible.");
    }
    return [field, result] as const;
  }));
  return Object.fromEntries(entries);
}

function storedToPlatformData(identity: StoredIdentity): PlatformData | null {
  const metadata = identity.metadata ?? {};
  const fieldValue = typeof metadata.field === "string" ? metadata.field : `url_${identity.platform}`;
  if (!ENRICHABLE_FIELDS.includes(fieldValue as EnrichableField)) return null;
  const field = fieldValue as EnrichableField;
  const base = makeBase(field, identity.external_url ?? "");
  return {
    ...base,
    externalId: identity.external_id,
    name: identity.platform_name,
    description: typeof metadata.description === "string" ? metadata.description : null,
    images: Array.isArray(metadata.images) ? metadata.images as ExtractedImage[] : [],
    monthlyListeners: typeof metadata.monthly_listeners === "number" ? metadata.monthly_listeners : null,
    followers: typeof metadata.followers === "number" ? metadata.followers : null,
    subscriberCount: typeof metadata.subscriber_count === "number" ? metadata.subscriber_count : null,
    totalViews: typeof metadata.total_views === "number" ? metadata.total_views : null,
    popularity: typeof metadata.popularity === "number" ? metadata.popularity : null,
    genres: Array.isArray(metadata.genres) ? metadata.genres.filter((item): item is string => typeof item === "string") : [],
    albumCount: typeof metadata.album_count === "number" ? metadata.album_count : null,
    trackCount: typeof metadata.track_count === "number" ? metadata.track_count : null,
    details: metadata.details && typeof metadata.details === "object" ? metadata.details as PlatformData["details"] : {},
    warnings: Array.isArray(metadata.warnings) ? metadata.warnings.filter((item): item is string => typeof item === "string") : [],
    error: typeof metadata.error === "string" ? metadata.error : null,
    fetchedAt: typeof metadata.fetched_at === "string" ? metadata.fetched_at : base.fetchedAt,
    method: typeof metadata.method === "string" ? metadata.method : "historique",
  };
}

export async function getStoredEnrichment(
  supabase: SupabaseClient,
  artistId: string,
): Promise<StoredEnrichment> {
  const [artist, identities, metricSnapshots] = await Promise.all([
    getArtistUrls(supabase, artistId),
    supabase
      .from("artist_platform_identities")
      .select("platform, external_id, external_url, platform_name, metadata")
      .eq("artist_id", artistId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("artist_metric_snapshots")
      .select(`
        id, platform, source_field, collected_at,
        monthly_listeners, followers, subscriber_count, total_views,
        popularity, album_count, track_count
      `)
      .eq("artist_id", artistId)
      .order("collected_at", { ascending: false })
      .limit(500),
  ]);
  if (identities.error) throw new Error("Impossible de charger l'historique de collecte.");
  if (metricSnapshots.error) throw new Error("Impossible de charger les indicateurs enregistrés.");
  const results: Record<string, PlatformData> = {};
  for (const identity of identities.data ?? []) {
    const result = storedToPlatformData(identity as StoredIdentity);
    if (result && !results[result.field]) results[result.field] = result;
  }
  return {
    results,
    availableFields: ENRICHABLE_FIELDS.filter((field) => Boolean(artist[field]?.trim())),
    metricSummaries: buildMetricSummaries(
      (metricSnapshots.data ?? []) as ArtistMetricDatabaseRow[],
    ),
  };
}

function imageFormat(contentType: string, bytes: Uint8Array): { contentType: string; extension: string } {
  const formats: Record<string, { contentType: string; extension: string }> = {
    "image/jpeg": { contentType: "image/jpeg", extension: "jpg" },
    "image/png": { contentType: "image/png", extension: "png" },
    "image/webp": { contentType: "image/webp", extension: "webp" },
    "image/gif": { contentType: "image/gif", extension: "gif" },
    "image/avif": { contentType: "image/avif", extension: "avif" },
  };
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  if (formats[normalized]) return formats[normalized];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return formats["image/jpeg"];
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return formats["image/png"];
  const ascii = new TextDecoder("ascii").decode(bytes.slice(0, 16));
  if (ascii.startsWith("GIF8")) return formats["image/gif"];
  if (ascii.slice(0, 4) === "RIFF" && ascii.slice(8, 12) === "WEBP") return formats["image/webp"];
  if (ascii.includes("ftypavif") || ascii.includes("ftypavis")) return formats["image/avif"];
  throw new Error(`Format d'image non accepté (${normalized || "inconnu"}).`);
}

export async function applyCollectedImage(
  supabase: SupabaseClient,
  artistId: string,
  imageUrl: string,
  target: "image_url" | "banner_url",
): Promise<{ url: string; archived: boolean }> {
  const { data: identities, error: identityError } = await supabase
    .from("artist_platform_identities")
    .select("metadata")
    .eq("artist_id", artistId);
  if (identityError) throw new Error("Impossible de vérifier l'origine de l'image.");

  const isCollected = (identities ?? []).some((identity) => {
    const metadata = identity.metadata as Record<string, unknown> | null;
    return Array.isArray(metadata?.images) && metadata.images.some((image) => {
      return image && typeof image === "object" && (image as Record<string, unknown>).url === imageUrl;
    });
  });
  if (!isCollected) throw new Error("Cette image ne fait pas partie des médias collectés pour cet artiste.");

  const response = await safeFetch(imageUrl, { headers: { Accept: "image/*" } });
  if (!response.ok) throw new Error(`Le serveur de l'image a répondu HTTP ${response.status}.`);
  const bytes = await readLimited(response, MAX_IMAGE_BYTES);
  const format = imageFormat(response.headers.get("content-type") ?? "", bytes);
  const hash = createHash("sha256").update(imageUrl).digest("hex").slice(0, 20);
  const path = `${artistId}/${target}/${hash}.${format.extension}`;

  const { error: uploadError } = await supabase.storage
    .from("artist-media")
    .upload(path, bytes, {
      contentType: format.contentType,
      cacheControl: "31536000",
      upsert: true,
    });
  if (uploadError) throw new Error("Impossible d'archiver cette image dans le stockage du site.");
  const { data: publicUrl } = supabase.storage.from("artist-media").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("artists")
    .update({ [target]: publicUrl.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", artistId);
  if (updateError) throw new Error("Image archivée, mais la fiche artiste n'a pas pu être mise à jour.");
  return { url: publicUrl.publicUrl, archived: true };
}
