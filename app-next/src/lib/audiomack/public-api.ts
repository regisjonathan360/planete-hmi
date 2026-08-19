/**
 * Client OAuth 1.0a de l'API publique Audiomack (api.audiomack.com/v1).
 *
 * Les identifiants « audiomack-web » sont les identifiants PUBLICS embarqués
 * dans l'application web audiomack.com (aucun secret). Ils permettent de
 * lire les classements hebdomadaires officiels :
 *   - chart/songs/weekly/page/N?country=HT   → Weekly Top Songs Haïti (100)
 *   - chart/<genre>/songs/weekly/page/N?country=HT → Top genre Haïti
 *
 * IMPORTANT : le paramètre pays doit être le code ISO majuscule ("HT").
 * "haiti" ou "ht" est ignoré par l'API et retourne le classement MONDIAL.
 */
import crypto from "crypto";
import { normalizeAudiomackResponse } from "./normalize";
import type { AudiomackNormalizedEntry, AudiomackRawTrack } from "./types";

const API_BASE = "https://api.audiomack.com/v1";
const CONSUMER_KEY = "audiomack-web";
const CONSUMER_SECRET = "bd8a07e9f23fbe9d808646b730f89b8e";
const COUNTRY = "HT";
const PAGE_LIMIT = 20;

export interface AudiomackApiChartResult {
  ok: boolean;
  entries: AudiomackNormalizedEntry[];
  sourceUpdatedAt?: string | null;
  error?: string;
}

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateSignature(method: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(CONSUMER_SECRET)}&`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildSignedUrl(method: string, url: string, extraParams: Record<string, string>): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const all = { ...extraParams, ...oauthParams };
  oauthParams.oauth_signature = generateSignature(method, url, all);

  const qs = new URLSearchParams({ ...extraParams, ...oauthParams }).toString();
  return `${url}?${qs}`;
}

interface ApiPageResult {
  ok: boolean;
  tracks: AudiomackRawTrack[];
  error?: string;
}

interface ApiResponse {
  ok: boolean;
  data: unknown;
  error?: string;
}

async function fetchAudiomackApi(path: string, params: Record<string, string> = {}): Promise<ApiResponse> {
  const url = `${API_BASE}/${path}`;
  const signedUrl = buildSignedUrl("GET", url, params);

  try {
    const res = await fetch(signedUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlaneteHMI/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return { ok: false, data: null, error: `Audiomack API a repondu HTTP ${res.status}.` };
    }

    return { ok: true, data: await res.json() };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : "Erreur reseau API Audiomack.",
    };
  }
}

async function fetchPage(path: string, params: Record<string, string>): Promise<ApiPageResult> {
  const result = await fetchAudiomackApi(path, params);
  if (!result.ok) return { ok: false, tracks: [], error: result.error };

  const json = result.data as { results?: unknown };
  if (!Array.isArray(json.results)) {
    return { ok: false, tracks: [], error: "Reponse API Audiomack inattendue (pas de liste)." };
  }
  return { ok: true, tracks: json.results as AudiomackRawTrack[] };
}

/**
 * Récupère le classement hebdomadaire (100 titres par défaut, paginé par 20).
 * @param genre Sluq du genre (ex. "gospel") ou undefined pour le Top Songs global Haïti.
 */
export async function fetchAudiomackApiChart(options: { genre?: string | null; pages?: number } = {}): Promise<AudiomackApiChartResult> {
  const { genre = null, pages = 5 } = options;
  const pathBase = `chart/${genre ? `${genre}/` : ""}songs/weekly/page/`;

  const allTracks: AudiomackRawTrack[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const pageResult = await fetchPage(`${pathBase}${page}`, { country: COUNTRY, limit: String(PAGE_LIMIT) });
    if (!pageResult.ok) {
      if (allTracks.length > 0) break;
      return { ok: false, entries: [], error: pageResult.error };
    }
    allTracks.push(...pageResult.tracks);
    if (pageResult.tracks.length < PAGE_LIMIT) break;
  }

  if (!allTracks.length) {
    return {
      ok: true,
      entries: [],
      error: genre
        ? `Aucun classement hebdomadaire pour le genre « ${genre} » en Haiti cette semaine.`
        : "Aucune entree renvoyee par l'API Audiomack pour Haiti.",
    };
  }

  // L'API renvoie les titres déjà ordonnés ; `rank_data.rank` fait foi quand
  // il est présent (souvent égaré sur certaines pages genre).
  const ranked = allTracks.map((track, index) => {
    const apiRank = (track as { rank_data?: { rank?: number } }).rank_data?.rank;
    return {
      ...track,
      _rank: typeof apiRank === "number" ? apiRank : index + 1,
    };
  });

  const entries = normalizeAudiomackResponse({ results: ranked })
    .map((entry, index) => ({ ...entry, rank: (ranked[index]._rank as number) ?? index + 1 }))
    .sort((a, b) => a.rank - b.rank);

  return { ok: true, entries, sourceUpdatedAt: null };
}

export interface AudiomackPlaylistApiResult {
  ok: boolean;
  playlist: {
    id?: string;
    title: string;
    description?: string | null;
    genre?: string | null;
    imageUrl?: string | null;
    tracks: AudiomackRawTrack[];
  } | null;
  error?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Lit une playlist publique Audiomack par son propriétaire et son slug.
 * L'URL de destination est construite côté serveur : aucune URL fournie par
 * l'admin n'est utilisée directement comme cible de fetch.
 */
export async function fetchAudiomackApiPlaylist(
  artistSlug: string,
  playlistSlug: string,
): Promise<AudiomackPlaylistApiResult> {
  const safeArtist = encodeURIComponent(artistSlug);
  const safePlaylist = encodeURIComponent(playlistSlug);
  const result = await fetchAudiomackApi(`playlist/${safeArtist}/${safePlaylist}`);
  if (!result.ok) return { ok: false, playlist: null, error: result.error };

  const root = asRecord(result.data);
  const payload = asRecord(root?.results) ?? root;
  if (!payload) {
    return { ok: false, playlist: null, error: "Réponse Audiomack inattendue pour cette playlist." };
  }

  const tracks = Array.isArray(payload.tracks)
    ? payload.tracks as AudiomackRawTrack[]
    : Array.isArray(payload.results)
      ? payload.results as AudiomackRawTrack[]
      : [];
  if (!tracks.length) {
    return { ok: false, playlist: null, error: "Cette playlist Audiomack ne contient aucune piste accessible." };
  }

  const title = typeof payload.title === "string"
    ? payload.title.trim()
    : typeof payload.name === "string"
      ? payload.name.trim()
      : playlistSlug;

  return {
    ok: true,
    playlist: {
      id: payload.id != null ? String(payload.id) : undefined,
      title: title || playlistSlug,
      description: typeof payload.description === "string" ? payload.description.trim() || null : null,
      genre: typeof payload.genre === "string" ? payload.genre.trim() || null : null,
      imageUrl: typeof payload.image === "string"
        ? payload.image
        : typeof payload.image_base === "string"
          ? payload.image_base
          : null,
      tracks,
    },
  };
}
