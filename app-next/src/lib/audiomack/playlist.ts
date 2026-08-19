import "server-only";

import { normalizeAudiomackResponse } from "./normalize";
import { fetchAudiomackApiPlaylist } from "./public-api";
import type { AudiomackNormalizedEntry } from "./types";

export interface AudiomackPlaylistReference {
  sourceUrl: string;
  artistSlug: string;
  playlistSlug: string;
  key: string;
}

export interface CollectedAudiomackPlaylist {
  source: AudiomackPlaylistReference;
  title: string;
  description: string | null;
  genre: string | null;
  artworkUrl: string | null;
  externalPlaylistId?: string;
  entries: AudiomackNormalizedEntry[];
}

function cleanSlug(value: string) {
  const decoded = decodeURIComponent(value).trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(decoded)) return null;
  return decoded;
}

/**
 * Accepte uniquement la forme publique Audiomack :
 * https://audiomack.com/{artiste}/playlist/{playlist}
 */
export function parseAudiomackPlaylistUrl(value: string): AudiomackPlaylistReference | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || host !== "audiomack.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[1].toLowerCase() !== "playlist") return null;

    const artistSlug = cleanSlug(parts[0]);
    const playlistSlug = cleanSlug(parts[2]);
    if (!artistSlug || !playlistSlug) return null;

    return {
      sourceUrl: `https://audiomack.com/${artistSlug}/playlist/${playlistSlug}`,
      artistSlug,
      playlistSlug,
      key: `${artistSlug.toLowerCase()}/${playlistSlug.toLowerCase()}`,
    };
  } catch {
    return null;
  }
}

/** Lit les métadonnées et les sources audio déjà publiées par Audiomack. */
export async function collectAudiomackPlaylist(
  reference: AudiomackPlaylistReference,
): Promise<CollectedAudiomackPlaylist> {
  const result = await fetchAudiomackApiPlaylist(reference.artistSlug, reference.playlistSlug);
  if (!result.ok || !result.playlist) {
    throw new Error(result.error || "Impossible de lire cette playlist Audiomack.");
  }

  const entries = normalizeAudiomackResponse({ tracks: result.playlist.tracks })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      genre: entry.genre || result.playlist?.genre || null,
    }));

  if (!entries.length) {
    throw new Error("Aucune piste n'a pu être extraite de cette playlist Audiomack.");
  }

  return {
    source: reference,
    title: result.playlist.title,
    description: result.playlist.description ?? null,
    genre: result.playlist.genre ?? null,
    artworkUrl: result.playlist.imageUrl ?? null,
    externalPlaylistId: result.playlist.id,
    entries,
  };
}
