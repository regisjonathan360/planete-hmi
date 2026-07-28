/**
 * Lecture d'une playlist Spotify pour alimenter un classement.
 *
 * Deux chemins, dans cet ordre :
 *  1. Web API (« client credentials ») quand SPOTIFY_CLIENT_ID / SECRET sont
 *     configurés : métadonnées complètes, ISRC, pochette par titre.
 *  2. Page embed publique `open.spotify.com/embed/playlist/<id>`, qui expose la
 *     liste des pistes dans son `__NEXT_DATA__`. Aucun identifiant requis, mais
 *     pas d'ISRC et la pochette par titre doit être demandée à l'endpoint
 *     oEmbed officiel.
 *
 * Aucune métrique d'écoute n'est lue : une playlist fournit un ORDRE, pas des
 * chiffres de streams.
 */
import "server-only";

import {
  getSpotifyPlaylistMeta,
  getSpotifyPlaylistTracks,
  isSpotifyConfigured,
  type SpotifyPlaylistTrack,
} from "./api-client";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

export interface PlaylistReadResult {
  playlistId: string;
  playlistName: string;
  playlistUrl: string;
  coverUrl: string | null;
  snapshotId: string | null;
  /** "web_api" ou "embed" — utile pour expliquer les données manquantes. */
  method: "web_api" | "embed";
  tracks: SpotifyPlaylistTrack[];
  warnings: string[];
}

/** Accepte une URL, un URI `spotify:playlist:…` ou l'identifiant brut. */
export function parseSpotifyPlaylistId(input: string): string | null {
  const value = String(input ?? "").trim();
  if (!value) return null;

  if (/^[A-Za-z0-9]{22}$/.test(value)) return value;

  const uri = /^spotify:playlist:([A-Za-z0-9]{22})$/.exec(value);
  if (uri) return uri[1];

  const url = /open\.spotify\.com\/(?:[a-z-]+\/)?playlist\/([A-Za-z0-9]{22})/.exec(value);
  if (url) return url[1];

  return null;
}

/** Sépare le sous-titre embed (« A, B, C ») en noms d'artistes. */
export function splitEmbedArtists(subtitle: string): string[] {
  return String(subtitle ?? "")
    .replace(/\u00a0/g, " ")
    .split(/\s*,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

interface EmbedTrack {
  uri?: string;
  title?: string;
  subtitle?: string;
  audioPreview?: { url?: string };
}

interface EmbedEntity {
  type?: string;
  name?: string;
  coverArt?: { sources?: { url?: string }[] };
  trackList?: EmbedTrack[];
}

interface EmbedNextData {
  props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
}

/** Récupère la pochette d'un titre via l'endpoint oEmbed public de Spotify. */
async function fetchTrackArtwork(trackId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(
        `https://open.spotify.com/track/${trackId}`,
      )}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { thumbnail_url?: string };
    return json.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

/** Exécute `task` sur chaque élément avec un parallélisme borné. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

async function readViaEmbed(
  playlistId: string,
  limit: number,
  withArtwork: boolean,
): Promise<PlaylistReadResult> {
  const warnings: string[] = [];
  const response = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error(
      "Playlist introuvable sur Spotify. Vérifiez le lien et qu'elle est bien publique.",
    );
  }
  if (!response.ok) {
    throw new Error(`Spotify a répondu HTTP ${response.status} sur la page de la playlist.`);
  }

  const html = await response.text();
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) {
    throw new Error(
      "Impossible de lire la playlist : la page Spotify n'expose plus ses données. " +
        "Configurez SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET pour passer par la Web API.",
    );
  }

  let entity: EmbedEntity | undefined;
  try {
    entity = (JSON.parse(match[1]) as EmbedNextData).props?.pageProps?.state?.data?.entity;
  } catch {
    throw new Error("Données de playlist Spotify illisibles (JSON invalide).");
  }

  if (!entity || entity.type !== "playlist") {
    throw new Error("Le lien fourni ne pointe pas vers une playlist Spotify.");
  }

  const rawTracks = (entity.trackList ?? []).slice(0, limit);
  const tracks: SpotifyPlaylistTrack[] = [];

  for (const raw of rawTracks) {
    const id = /^spotify:track:([A-Za-z0-9]{22})$/.exec(raw.uri ?? "")?.[1];
    const title = String(raw.title ?? "").trim();
    if (!id || !title) continue;

    tracks.push({
      id,
      title,
      artistNames: splitEmbedArtists(raw.subtitle ?? ""),
      artworkUrl: null,
      previewUrl: raw.audioPreview?.url ?? null,
      url: `https://open.spotify.com/track/${id}`,
      isrc: null,
      albumName: null,
    });
  }

  if (tracks.length === 0) {
    throw new Error("La playlist Spotify ne contient aucun titre lisible.");
  }

  if (withArtwork) {
    // Endpoint oEmbed officiel : une requête par titre, parallélisme borné.
    const covers = await mapWithConcurrency(tracks, 6, (track) => fetchTrackArtwork(track.id));
    let missing = 0;
    covers.forEach((cover, index) => {
      if (cover) tracks[index].artworkUrl = cover;
      else missing++;
    });
    if (missing > 0) {
      warnings.push(`${missing} pochette(s) indisponible(s) : la cover de la playlist est utilisée.`);
    }
  }

  warnings.push(
    "Lecture via la page publique Spotify : ISRC et nom d'album indisponibles. " +
      "Renseignez SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET pour des métadonnées complètes.",
  );

  const coverUrl = entity.coverArt?.sources?.[0]?.url ?? null;
  for (const track of tracks) {
    if (!track.artworkUrl) track.artworkUrl = coverUrl;
  }

  return {
    playlistId,
    playlistName: String(entity.name ?? "Playlist Spotify"),
    playlistUrl: `https://open.spotify.com/playlist/${playlistId}`,
    coverUrl,
    snapshotId: null,
    method: "embed",
    tracks,
    warnings,
  };
}

/**
 * Lit une playlist Spotify.
 * @param withArtwork demande les pochettes par titre en mode embed (N requêtes).
 */
export async function readSpotifyPlaylist(
  playlistRef: string,
  options: { limit?: number; withArtwork?: boolean } = {},
): Promise<PlaylistReadResult> {
  const playlistId = parseSpotifyPlaylistId(playlistRef);
  if (!playlistId) {
    throw new Error(
      "Lien de playlist Spotify invalide. Attendu : https://open.spotify.com/playlist/<identifiant>",
    );
  }

  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);

  if (isSpotifyConfigured()) {
    const [meta, tracks] = await Promise.all([
      getSpotifyPlaylistMeta(playlistId),
      getSpotifyPlaylistTracks(playlistId, limit),
    ]);

    if (meta && tracks.length > 0) {
      for (const track of tracks) {
        if (!track.artworkUrl) track.artworkUrl = meta.coverUrl;
      }
      return {
        playlistId,
        playlistName: meta.name,
        playlistUrl: meta.url,
        coverUrl: meta.coverUrl,
        snapshotId: meta.snapshotId,
        method: "web_api",
        tracks,
        warnings: [],
      };
    }
  }

  return readViaEmbed(playlistId, limit, options.withArtwork !== false);
}
