/**
 * YouTubeCollectionScope — périmètre d'une collecte CUSTOM.
 *
 * Transmis aux étapes K4/K5 pour filtrer les requêtes de stockage.
 * Le mode FULL_WEEKLY (scope = null) conserve le comportement existant.
 *
 * Sémantique des cibles combinées :
 * - artistIds : résolu vers les chaînes et vidéos de ces artistes
 * - channelIds : filtre directement les chaînes scannées par K4
 * - videoIds : filtre directement les vidéos rafraîchies par K5
 * - trackIds : filtre les chansons incluses dans le brouillon K5
 *
 * Les cibles sont combinées en UNION (pas en intersection).
 * Une collecte CUSTOM ne doit JAMAIS traiter une entité hors périmètre.
 */

export interface YouTubeCollectionScope {
  mode: "CUSTOM";
  artistIds: string[];
  channelIds: string[];
  /** YouTube channel IDs (`UC...`) resolved from every selected target. */
  channelYouTubeIds: string[];
  videoIds: string[];
  trackIds: string[];
}

/** Scope null signifie mode global (FULL_WEEKLY, REFRESH_STATISTICS, etc.) */
export type YouTubeCollectionScopeOrNull = YouTubeCollectionScope | null;

export function matchesScopedVideo(
  scope: YouTubeCollectionScopeOrNull,
  video: { id: string; channelId: string; trackId: string | null }
): boolean {
  if (!scope) return true;
  return scope.videoIds.includes(video.id)
    || scope.channelYouTubeIds.includes(video.channelId)
    || (video.trackId != null && scope.trackIds.includes(video.trackId));
}
