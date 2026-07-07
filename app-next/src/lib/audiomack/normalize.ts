/**
 * Normalise la réponse brute Audiomack en AudiomackNormalizedEntry[].
 * Ne modifie jamais les accents dans les données affichées.
 */
import type { AudiomackRawPlaylist, AudiomackRawTrack, AudiomackNormalizedEntry } from "./types";

function buildTrackUrl(artistSlug: string | null, trackSlug: string | null, rawUrl?: string): string {
  if (rawUrl && rawUrl.startsWith("http")) return rawUrl;
  if (artistSlug && trackSlug) return `https://audiomack.com/${artistSlug}/song/${trackSlug}`;
  return "https://audiomack.com";
}

export function normalizeAudiomackResponse(raw: AudiomackRawPlaylist): AudiomackNormalizedEntry[] {
  const tracks = raw.results ?? raw.tracks ?? [];
  return tracks.map((t: AudiomackRawTrack, i: number) => ({
    platform: "audiomack" as const,
    countryCode: "HT" as const,
    rank: i + 1,
    platformTrackId: t.id != null ? String(t.id) : null,
    title: String(t.title ?? "Sans titre").trim(),
    artistName: String(t.artist ?? "Artiste inconnu").trim(),
    artworkUrl: t.image && String(t.image).startsWith("http") ? String(t.image) : null,
    sourceTrackUrl: buildTrackUrl(
      t.artist_url_slug ? String(t.artist_url_slug) : null,
      t.url_slug ? String(t.url_slug) : null,
      t.url ? String(t.url) : undefined
    ),
    artistSlug: t.artist_url_slug ? String(t.artist_url_slug) : null,
    trackSlug: t.url_slug ? String(t.url_slug) : null,
    albumName: t.album ? String(t.album) : null,
    genre: t.genre ? String(t.genre) : null,
  }));
}

/** Clé d'identification unique pour comparer deux semaines. */
export function trackIdentityKey(e: { platformTrackId: string | null; artistSlug: string | null; trackSlug: string | null; artistName: string; title: string }): string {
  if (e.platformTrackId) return `id:${e.platformTrackId}`;
  if (e.artistSlug && e.trackSlug) return `slug:${e.artistSlug}/${e.trackSlug}`;
  // Dernier recours : normalisation texte
  const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();
  return `text:${norm(e.artistName)}|${norm(e.title)}`;
}
