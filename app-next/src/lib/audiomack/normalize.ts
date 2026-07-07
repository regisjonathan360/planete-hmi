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

function firstHttp(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => typeof value === "string" && value.startsWith("http")) ?? null;
}

function slugsFromTrackUrl(url: string | null | undefined): { artistSlug: string | null; trackSlug: string | null } {
  if (!url) return { artistSlug: null, trackSlug: null };
  const match = url.match(/^https?:\/\/(?:www\.)?audiomack\.com\/([^/]+)\/song\/([^/?#]+)/i);
  return {
    artistSlug: match?.[1] ?? null,
    trackSlug: match?.[2] ?? null,
  };
}

export function normalizeAudiomackResponse(raw: AudiomackRawPlaylist): AudiomackNormalizedEntry[] {
  const tracks = raw.results ?? raw.tracks ?? [];
  return tracks.map((t: AudiomackRawTrack, i: number) => {
    const directUrl = firstHttp(t.links?.self, t.url);
    const urlSlugs = slugsFromTrackUrl(directUrl);
    const artistSlug = t.artist_url_slug ? String(t.artist_url_slug) : t.uploader?.url_slug ? String(t.uploader.url_slug) : urlSlugs.artistSlug;
    const trackSlug = t.url_slug ? String(t.url_slug) : urlSlugs.trackSlug;

    return {
      platform: "audiomack" as const,
      countryCode: "HT" as const,
      rank: i + 1,
      platformTrackId: t.id != null ? String(t.id) : null,
      title: String(t.title ?? "Sans titre").trim(),
      artistName: String(t.artist ?? "Artiste inconnu").trim(),
      artworkUrl: firstHttp(t.image, t.image_base, t.images?.original?.filename),
      sourceTrackUrl: buildTrackUrl(artistSlug, trackSlug, directUrl ?? undefined),
      artistSlug,
      trackSlug,
      albumName: t.album ? String(t.album) : null,
      genre: t.genre ? String(t.genre) : null,
    };
  });
}

/** Clé d'identification unique pour comparer deux semaines. */
export function trackIdentityKey(e: { platformTrackId: string | null; artistSlug: string | null; trackSlug: string | null; artistName: string; title: string }): string {
  if (e.platformTrackId) return `id:${e.platformTrackId}`;
  if (e.artistSlug && e.trackSlug) return `slug:${e.artistSlug}/${e.trackSlug}`;
  // Dernier recours : normalisation texte
  const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();
  return `text:${norm(e.artistName)}|${norm(e.title)}`;
}
