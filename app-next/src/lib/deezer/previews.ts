import "server-only";

import { isExpiringAudioUrl, type PlatformAudioCandidate } from "@/lib/radio/audio";

const DEEZER_TRACK_BATCH_SIZE = 8;

/**
 * Deezer preview URLs are signed and expire. Refresh only the candidates that
 * are missing a preview or are close to expiry, keeping normal playlist loads
 * cheap while making long-lived radio sessions recoverable.
 */
export async function refreshDeezerPreviews(
  candidates: PlatformAudioCandidate[],
  force = false,
  onlyTrackId?: string,
): Promise<Map<string, string>> {
  const ids = [...new Set(
    candidates
      .filter((candidate) => candidate.platform === "deezer")
      .filter((candidate) => !onlyTrackId || (candidate as PlatformAudioCandidate & { track_id?: string }).track_id === onlyTrackId)
      .filter((candidate) => {
        const current = candidate.preview_url || candidate.audio_url;
        return /^\d+$/.test(String(candidate.external_id ?? "")) &&
          (force || !current || isExpiringAudioUrl(current));
      })
      .map((candidate) => String(candidate.external_id)),
  )];

  const refreshed = new Map<string, string>();
  for (let index = 0; index < ids.length; index += DEEZER_TRACK_BATCH_SIZE) {
    const batch = ids.slice(index, index + DEEZER_TRACK_BATCH_SIZE);
    const results = await Promise.all(batch.map(async (id) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          // Deezer can cache a signed preview response. A unique query keeps a
          // forced radio recovery from replacing a valid URL with an old one.
          const cacheBust = `${Date.now()}-${attempt}-${id}`;
          const response = await fetch(
            `https://api.deezer.com/track/${encodeURIComponent(id)}?radio_refresh=${cacheBust}`,
            { cache: "no-store", signal: AbortSignal.timeout(8000) },
          );
          if (!response.ok) continue;
          const payload = (await response.json()) as { id?: number; preview?: string | null };
          if (payload.id && payload.preview && !isExpiringAudioUrl(payload.preview)) {
            return { id: String(payload.id), preview: payload.preview };
          }
        } catch {
          // Try once more with a different cache-busting URL.
        }
      }
      return null;
    }));

    for (const result of results) {
      if (result) refreshed.set(result.id, result.preview);
    }
  }

  return refreshed;
}

export function applyFreshDeezerPreviews<T extends PlatformAudioCandidate>(
  candidates: T[],
  refreshed: Map<string, string>,
): T[] {
  return candidates.map((candidate) => {
    const preview = refreshed.get(String(candidate.external_id ?? ""));
    return preview && !isExpiringAudioUrl(preview)
      ? { ...candidate, preview_url: preview, audio_url: preview }
      : candidate;
  });
}
