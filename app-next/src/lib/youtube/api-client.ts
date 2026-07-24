/**
 * Client serveur YouTube Data API v3 (K2)
 *
 * - Validation chaîne (channels.list)
 * - Playlist d'uploads (contentDetails.relatedPlaylists.uploads)
 * - Pagination playlistItems.list
 * - videos.list par lots de 50 max
 * - Métadonnées, disponibilités, statistiques
 *
 * Contraintes :
 * - Clé API exclusivement serveur, jamais dans les logs
 * - Timeouts, quota épuisé, clé invalide, introuvable
 * - Vidéos privées/supprimées vs IDs invalides
 * - Validation Zod de toutes les réponses
 */
import "server-only";

import { z } from "zod";
import { YOUTUBE_VIDEO_BATCH_SIZE } from "./constants";
import {
  youtubeChannelIdSchema,
  youtubePlaylistIdSchema,
  youtubeVideoIdSchema,
  youtubeVideoListResponseSchema,
} from "./schemas";

// ============================================================
// Configuration
// ============================================================

const API_BASE = "https://www.googleapis.com/youtube/v3";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PLAYLIST_ITEMS = 2000;

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new YouTubeApiError("YOUTUBE_API_KEY non configurée.", "config_missing", 0);
  return key;
}

// ============================================================
// Erreurs
// ============================================================

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }

  /** Vrai uniquement pour quotaExceeded ou dailyLimitExceeded. */
  get isQuotaExhausted(): boolean {
    return this.code === "quota_exceeded";
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === "not_found";
  }

  get isInvalidKey(): boolean {
    return this.code === "invalid_key";
  }
}

// ============================================================
// Schémas Zod pour channels.list et playlistItems.list
// ============================================================

const channelSnippetSchema = z.object({
  title: z.string(),
  customUrl: z.string().optional(),
  thumbnails: z.record(z.string(), z.object({ url: z.string().url() }).passthrough()).optional(),
}).passthrough();

const channelContentDetailsSchema = z.object({
  relatedPlaylists: z.object({
    uploads: z.string().optional(),
  }).passthrough(),
}).passthrough();

const channelStatisticsSchema = z.object({
  subscriberCount: z.string().optional(),
  videoCount: z.string().optional(),
}).passthrough();

const channelsListResponseSchema = z.object({
  items: z.array(z.object({
    snippet: channelSnippetSchema,
    contentDetails: channelContentDetailsSchema,
    statistics: channelStatisticsSchema.optional(),
  }).passthrough()).default([]),
}).passthrough();

const playlistItemSchema = z.object({
  snippet: z.object({
    title: z.string().default(""),
    publishedAt: z.string().optional(),
    position: z.number().int().nonnegative().optional(),
    thumbnails: z.record(z.string(), z.object({ url: z.string().url() }).passthrough()).optional(),
    resourceId: z.object({ videoId: z.string() }).passthrough().optional(),
  }).passthrough(),
  contentDetails: z.object({
    videoId: z.string().optional(),
    videoPublishedAt: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

const playlistItemsListResponseSchema = z.object({
  items: z.array(playlistItemSchema).default([]),
  nextPageToken: z.string().optional(),
}).passthrough();

// ============================================================
// Types de réponse
// ============================================================

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
}

export interface YouTubePlaylistItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  position: number;
}

export interface YouTubeVideoDetails {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: string;
  categoryId: string;
  tags: string[];
  thumbnailUrl: string | null;
  durationIso: string;
  durationSeconds: number;
  privacyStatus: "public" | "private" | "unlisted";
  embeddable: boolean;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
}

// ============================================================
// Transport
// ============================================================

async function fetchYouTube(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new YouTubeApiError("Timeout YouTube Data API.", "timeout", 0, true);
    }
    throw new YouTubeApiError("Erreur réseau YouTube.", "network_error", 0, true);
  }

  const body = await safeJson(response);

  if (response.status === 403) {
    const reason = extractErrorReason(body);
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new YouTubeApiError("Quota YouTube Data API épuisé.", "quota_exceeded", 403);
    }
    // Conserver la raison exacte retournée par Google
    throw new YouTubeApiError(
      `Accès refusé par YouTube : ${reason ?? "raison inconnue"}.`,
      reason ?? "forbidden",
      403
    );
  }

  if (response.status === 404) {
    throw new YouTubeApiError("Ressource YouTube introuvable.", "not_found", 404);
  }

  if (response.status === 400) {
    const reason = extractErrorReason(body);
    if (reason === "keyInvalid") {
      throw new YouTubeApiError("Clé API YouTube invalide.", "invalid_key", 400);
    }
    throw new YouTubeApiError(
      `Requête invalide : ${reason ?? "paramètres incorrects"}.`,
      reason ?? "bad_request",
      400
    );
  }

  if (!response.ok) {
    throw new YouTubeApiError(
      `YouTube a répondu HTTP ${response.status}.`,
      "http_error",
      response.status,
      response.status >= 500
    );
  }

  return body;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorReason(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const err = (body as Record<string, unknown>).error;
  if (!err || typeof err !== "object") return null;
  const errors = (err as Record<string, unknown>).errors;
  if (!Array.isArray(errors) || !errors[0]) return null;
  return ((errors[0] as Record<string, unknown>).reason as string) ?? null;
}

// ============================================================
// Helpers
// ============================================================

function parseDurationIso(iso: string): number {
  const match = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const days = parseInt(match[1] ?? "0", 10);
  const hours = parseInt(match[2] ?? "0", 10);
  const minutes = parseInt(match[3] ?? "0", 10);
  const seconds = parseInt(match[4] ?? "0", 10);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function bestThumbnail(thumbnails: Record<string, { url: string }> | undefined): string | null {
  if (!thumbnails) return null;
  return thumbnails.maxres?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ============================================================
// API publique
// ============================================================

/**
 * Valide une chaîne YouTube et récupère ses métadonnées + playlist d'uploads.
 */
export async function validateChannel(channelId: string): Promise<YouTubeChannelInfo> {
  youtubeChannelIdSchema.parse(channelId);

  const raw = await fetchYouTube("channels", {
    part: "snippet,contentDetails,statistics",
    id: channelId,
  });

  const parsed = channelsListResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new YouTubeApiError("Réponse channels.list invalide.", "invalid_response", 200);
  }

  if (parsed.data.items.length === 0) {
    throw new YouTubeApiError(`Chaîne ${channelId} introuvable.`, "not_found", 404);
  }

  const item = parsed.data.items[0];
  return {
    channelId,
    title: item.snippet.title,
    handle: item.snippet.customUrl ?? null,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails as Record<string, { url: string }> | undefined),
    subscriberCount: item.statistics?.subscriberCount ? parseInt(item.statistics.subscriberCount, 10) : null,
    videoCount: item.statistics?.videoCount ? parseInt(item.statistics.videoCount, 10) : null,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads ?? null,
  };
}

/**
 * Récupère les éléments d'une playlist avec pagination.
 */
export async function listPlaylistItems(
  playlistId: string,
  maxItems: number = 500
): Promise<YouTubePlaylistItem[]> {
  youtubePlaylistIdSchema.parse(playlistId);
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_PLAYLIST_ITEMS) {
    throw new YouTubeApiError(
      `maxItems doit être un entier entre 1 et ${MAX_PLAYLIST_ITEMS}.`,
      "invalid_params",
      0
    );
  }

  const items: YouTubePlaylistItem[] = [];
  let pageToken: string | undefined;

  while (items.length < maxItems) {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const raw = await fetchYouTube("playlistItems", params);
    const parsed = playlistItemsListResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new YouTubeApiError("Réponse playlistItems.list invalide.", "invalid_response", 200);
    }

    for (const entry of parsed.data.items) {
      const videoId = entry.contentDetails?.videoId ?? entry.snippet.resourceId?.videoId;
      if (!videoId) continue;

      items.push({
        videoId,
        title: entry.snippet.title,
        publishedAt: entry.snippet.publishedAt ?? entry.contentDetails?.videoPublishedAt ?? "",
        thumbnailUrl: bestThumbnail(entry.snippet.thumbnails as Record<string, { url: string }> | undefined),
        position: entry.snippet.position ?? items.length,
      });
    }

    pageToken = parsed.data.nextPageToken;
    if (!pageToken) break;
  }

  return items.slice(0, maxItems);
}

/**
 * Récupère les détails de vidéos par lots de 50 max.
 * - IDs invalides rejetés avant l'appel (pas envoyés à YouTube).
 * - IDs valides absents de la réponse = privés/supprimés/indisponibles → dans `missing`.
 * - IDs invalides → dans `invalid` (pas confondus avec missing).
 */
export async function getVideoDetails(
  videoIds: string[]
): Promise<{ found: YouTubeVideoDetails[]; missing: string[]; invalid: string[] }> {
  if (videoIds.length === 0) return { found: [], missing: [], invalid: [] };

  const validIds: string[] = [];
  const invalid: string[] = [];
  for (const id of videoIds) {
    if (youtubeVideoIdSchema.safeParse(id).success) {
      validIds.push(id);
    } else {
      invalid.push(id);
    }
  }

  const found: YouTubeVideoDetails[] = [];
  const missing: string[] = [];

  for (const batch of chunks(validIds, YOUTUBE_VIDEO_BATCH_SIZE)) {
    const raw = await fetchYouTube("videos", {
      part: "snippet,contentDetails,statistics,status",
      id: batch.join(","),
    });

    const parsed = youtubeVideoListResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new YouTubeApiError("Réponse videos.list invalide.", "invalid_response", 200);
    }

    const returnedIds = new Set<string>();
    for (const item of parsed.data.items) {
      returnedIds.add(item.id);
      found.push({
        videoId: item.id,
        channelId: item.snippet.channelId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        categoryId: item.snippet.categoryId,
        tags: item.snippet.tags ?? [],
        thumbnailUrl: bestThumbnail(item.snippet.thumbnails as Record<string, { url: string }>),
        durationIso: item.contentDetails.duration,
        durationSeconds: parseDurationIso(item.contentDetails.duration),
        privacyStatus: item.status.privacyStatus,
        embeddable: item.status.embeddable,
        viewCount: parseInt(item.statistics.viewCount, 10),
        likeCount: item.statistics.likeCount ? parseInt(item.statistics.likeCount, 10) : null,
        commentCount: item.statistics.commentCount ? parseInt(item.statistics.commentCount, 10) : null,
      });
    }

    // IDs valides absents = privés/supprimés
    for (const id of batch) {
      if (!returnedIds.has(id)) missing.push(id);
    }
  }

  return { found, missing, invalid };
}

/**
 * Récupère les uploads d'une chaîne (raccourci).
 */
export async function getChannelUploads(
  channelId: string,
  maxItems: number = 200
): Promise<YouTubePlaylistItem[]> {
  const channel = await validateChannel(channelId);
  if (!channel.uploadsPlaylistId) {
    throw new YouTubeApiError(
      "Impossible de trouver la playlist d'uploads de cette chaîne.",
      "no_uploads_playlist",
      404
    );
  }
  return listPlaylistItems(channel.uploadsPlaylistId, maxItems);
}
