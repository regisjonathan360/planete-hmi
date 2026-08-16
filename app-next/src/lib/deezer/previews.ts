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
): Promise<Map<string, string>> {
  const ids = [...new Set(
    candidates
      .filter((candidate) => candidate.platform === "deezer")
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
      try {
        const response = await fetch(`https://api.deezer.com/track/${encodeURIComponent(id)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { id?: number; preview?: string | null };
        return payload.id && payload.preview ? { id: String(payload.id), preview: payload.preview } : null;
      } catch {
        return null;
      }
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
    return preview ? { ...candidate, preview_url: preview, audio_url: preview } : candidate;
  });
}
