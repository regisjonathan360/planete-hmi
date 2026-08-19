/**
 * Audio URL helpers shared by the public radio API and the admin import flow.
 * A platform page (Spotify, Audiomack, YouTube, ...) is metadata, not an
 * HTMLAudioElement source. Only direct audio/preview URLs are accepted.
 */

const PAGE_HOSTS = /(?:^|\.)?(?:youtube\.com|youtu\.be|spotify\.com|audiomack\.com|deezer\.com)$/i;
const PAGE_PATH = /\.(?:html?|php)(?:$|\?)/i;
const AUDIOMACK_AUDIO_HOST = /^(?:songs(?:\.dev)?|streaming|media|cdn[a-z0-9-]*)\.audiomack\.com$/i;

function isDirectAudiomackAudioUrl(url: URL) {
  // Les liens de lecture officiels sont servis sur des sous-domaines dédiés
  // (ex. songs.dev.audiomack.com), et non sur les pages audiomack.com.
  return AUDIOMACK_AUDIO_HOST.test(url.hostname);
}

export function isPlayableAudioUrl(value?: string | null): value is string {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:', 'blob:', 'data:'].includes(url.protocol)) return false;
    if (PAGE_PATH.test(url.pathname)) return false;
    return !PAGE_HOSTS.test(url.hostname) || isDirectAudiomackAudioUrl(url);
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

/**
 * Signed Deezer previews expire, and the older `/stream/c-*.mp3` CDN format
 * is no longer reliable in browsers. Do not keep serving either one.
 */
export function isExpiringAudioUrl(value?: string | null, safetyWindowSeconds = 300): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const match = url.href.match(/[?&]hdnea=exp=(\d+)/);
    if (match && Number(match[1]) * 1000 <= Date.now() + safetyWindowSeconds * 1000) return true;
    return /^(?:cdns?|cdnt)-preview[^/]*\.dzcdn\.net\/stream\/c-\d+\.mp3$/i.test(url.hostname + url.pathname);
  } catch {
    return false;
  }
}

/** Pick a real audio source from a stored URL or a platform preview. */
export function resolveAudioUrl(
  storedUrl: string | null | undefined,
  platformTracks: PlatformAudioCandidate[] = [],
): string {
  if (isPlayableAudioUrl(storedUrl) && !isExpiringAudioUrl(storedUrl)) return storedUrl;

  for (const candidate of platformTracks) {
    if (isPlayableAudioUrl(candidate.audio_url)) {
      if (!isExpiringAudioUrl(candidate.audio_url)) return candidate.audio_url;
    }
    if (isPlayableAudioUrl(candidate.preview_url)) {
      if (!isExpiringAudioUrl(candidate.preview_url)) return candidate.preview_url;
    }
  }

  // Never send an expired signed URL to HTMLAudioElement. The API caller will
  // omit this track from the playable playlist so the radio can continue.
  return "";
}
