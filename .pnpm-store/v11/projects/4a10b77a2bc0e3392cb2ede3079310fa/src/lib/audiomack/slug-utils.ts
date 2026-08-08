/**
 * Utilitaires pour l'extraction de slugs Audiomack et la construction d'URLs embed.
 */

const AUDIOMACK_URL_REGEX =
  /^https?:\/\/(?:www\.)?audiomack\.com\/([a-z0-9][a-z0-9._-]*)\/song\/([a-z0-9][a-z0-9._-]*)(?:[?#].*)?$/i;

const EMBED_URL_REGEX =
  /^https:\/\/audiomack\.com\/embed\/song\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;

/**
 * Extract artist and track slugs from an Audiomack URL.
 * URL format: https://audiomack.com/{artistSlug}/song/{trackSlug}
 */
export function extractSlugsFromUrl(
  sourceTrackUrl: string
): { artistSlug: string; trackSlug: string } | null {
  if (!sourceTrackUrl) return null;

  const match = sourceTrackUrl.match(AUDIOMACK_URL_REGEX);
  if (!match) return null;

  return {
    artistSlug: match[1].toLowerCase(),
    trackSlug: match[2].toLowerCase(),
  };
}

/**
 * Generate a fallback slug from a name (lowercase, alphanumeric + hyphens).
 * Removes accents, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
export function generateFallbackSlug(name: string): string {
  if (!name) return "unknown";

  return (
    name
      // Normalize unicode to decomposed form and remove combining marks (accents)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Lowercase
      .toLowerCase()
      // Replace non-alphanumeric with hyphens
      .replace(/[^a-z0-9]+/g, "-")
      // Collapse consecutive hyphens
      .replace(/-{2,}/g, "-")
      // Trim leading/trailing hyphens
      .replace(/^-|-$/g, "") || "unknown"
  );
}

/**
 * Build the Audiomack embed URL for a track.
 */
export function buildEmbedUrl(artistSlug: string, trackSlug: string): string {
  return `https://audiomack.com/embed/song/${artistSlug}/${trackSlug}`;
}

/**
 * Validate that an embed URL is syntactically correct.
 */
export function validateEmbedUrl(url: string): boolean {
  if (!url) return false;
  return EMBED_URL_REGEX.test(url);
}
