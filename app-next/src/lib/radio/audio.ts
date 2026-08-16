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

/** Signed Deezer previews expire; do not keep serving one near its deadline. */
export function isExpiringAudioUrl(value?: string | null, safetyWindowSeconds = 300): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const match = url.href.match(/[?&]hdnea=exp=(\d+)/);
    if (!match) return false;
    return Number(match[1]) * 1000 <= Date.now() + safetyWindowSeconds * 1000;
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
