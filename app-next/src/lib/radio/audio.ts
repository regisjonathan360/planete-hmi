/**
 * Audio URL helpers shared by the public radio API and the admin import flow.
 * A platform page (Spotify, Audiomack, YouTube, ...) is metadata, not an
 * HTMLAudioElement source. Only direct audio/preview URLs are accepted.
 */

const PAGE_HOSTS = /(?:^|\.)?(?:youtube\.com|youtu\.be|spotify\.com|audiomack\.com|deezer\.com)$/i;
const PAGE_PATH = /\.(?:html?|php)(?:$|\?)/i;

export function isPlayableAudioUrl(value?: string | null): value is string {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:', 'blob:', 'data:'].includes(url.protocol)) return false;
    return !PAGE_HOSTS.test(url.hostname) && !PAGE_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

export interface PlatformAudioCandidate {
  platform?: string | null;
  external_id?: string | number | null;
  preview_url?: string | null;
  audio_url?: string | null;
}

/** Pick a real audio source from a stored URL or a platform preview. */
export function resolveAudioUrl(
  storedUrl: string | null | undefined,
  platformTracks: PlatformAudioCandidate[] = [],
): string {
  if (isPlayableAudioUrl(storedUrl)) return storedUrl;

  for (const candidate of platformTracks) {
    if (isPlayableAudioUrl(candidate.audio_url)) return candidate.audio_url;
    if (isPlayableAudioUrl(candidate.preview_url)) return candidate.preview_url;

    // Deezer exposes a preview stream by track id. This is a short preview,
    // but it is a genuine audio resource and can be played by HTMLAudioElement.
    if (candidate.platform === 'deezer' && /^\d+$/.test(String(candidate.external_id ?? ''))) {
      return `https://cdns-preview-e.dzcdn.net/stream/c-${candidate.external_id}.mp3`;
    }
  }

  return '';
}
