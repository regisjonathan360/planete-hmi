import type {
  RankedYouTubeVideo,
  RankedYouTubeTrack,
  YouTubeMetricValues,
  YouTubeTrackPerformance,
  YouTubeVideoPerformance,
  YouTubeVideoPeriodInput,
} from "./types";

function nullableDelta(
  start: number | null,
  end: number | null
): number | null {
  if (start == null || end == null) return null;
  return end - start;
}

function countersDecreased(
  start: YouTubeMetricValues,
  end: YouTubeMetricValues
): boolean {
  return (
    end.viewCount < start.viewCount ||
    (start.likeCount != null &&
      end.likeCount != null &&
      end.likeCount < start.likeCount) ||
    (start.commentCount != null &&
      end.commentCount != null &&
      end.commentCount < start.commentCount)
  );
}

function ineligiblePerformance(
  input: YouTubeVideoPeriodInput,
  status: YouTubeVideoPerformance["status"]
): YouTubeVideoPerformance {
  return {
    videoId: input.video.videoId,
    trackId: input.video.trackId,
    status,
    weeklyViews: null,
    weeklyLikes: null,
    weeklyComments: null,
    totalViews: input.endSnapshot?.viewCount ?? null,
    usedZeroStart: false,
  };
}

/**
 * Calcule la performance d'une vidéo sans modifier les snapshots sources.
 * Une vidéo publiée pendant la période utilise zéro comme valeur de départ.
 */
export function calculateYouTubeVideoPerformance(
  input: YouTubeVideoPeriodInput
): YouTubeVideoPerformance {
  const { video, periodStart, startSnapshot, endSnapshot } = input;

  if (video.verificationStatus !== "APPROVED") {
    return ineligiblePerformance(input, "VIDEO_NOT_APPROVED");
  }
  if (video.eligibilityStatus !== "ELIGIBLE") {
    return ineligiblePerformance(input, "VIDEO_NOT_ELIGIBLE");
  }
  if (!video.isAvailable) {
    return ineligiblePerformance(input, "VIDEO_UNAVAILABLE");
  }
  if (!endSnapshot) {
    return ineligiblePerformance(input, "END_SNAPSHOT_MISSING");
  }

  let start: YouTubeMetricValues;
  let usedZeroStart = false;

  if (startSnapshot) {
    start = startSnapshot;
  } else if (Date.parse(video.publishedAt) >= Date.parse(periodStart)) {
    start = { viewCount: 0, likeCount: 0, commentCount: 0 };
    usedZeroStart = true;
  } else {
    return ineligiblePerformance(input, "START_SNAPSHOT_MISSING");
  }

  if (countersDecreased(start, endSnapshot)) {
    return ineligiblePerformance(input, "COUNTER_DECREASED");
  }

  return {
    videoId: video.videoId,
    trackId: video.trackId,
    status: "ELIGIBLE",
    weeklyViews: endSnapshot.viewCount - start.viewCount,
    weeklyLikes: nullableDelta(start.likeCount, endSnapshot.likeCount),
    weeklyComments: nullableDelta(
      start.commentCount,
      endSnapshot.commentCount
    ),
    totalViews: endSnapshot.viewCount,
    usedZeroStart,
  };
}

/** Classe chaque vidéo séparément, quel que soit son type ou sa chanson liée. */
export function rankYouTubeVideos(
  performances: YouTubeVideoPerformance[],
  limit = 20
): RankedYouTubeVideo[] {
  return performances
    .filter((item) => item.status === "ELIGIBLE" && item.weeklyViews != null)
    .sort(
      (a, b) =>
        (b.weeklyViews ?? 0) - (a.weeklyViews ?? 0) ||
        (b.weeklyLikes ?? 0) - (a.weeklyLikes ?? 0) ||
        (b.weeklyComments ?? 0) - (a.weeklyComments ?? 0) ||
        (b.totalViews ?? 0) - (a.totalViews ?? 0) ||
        a.videoId.localeCompare(b.videoId)
    )
    .slice(0, Math.max(0, limit))
    .map((video, index) => ({ ...video, automaticRank: index + 1 }));
}

export interface YouTubeTrackMetadata {
  trackId: string;
  title: string;
  artistNames: string;
  releaseDate: string | null;
}

/** Regroupe les performances de toutes les vidéos éligibles par chanson. */
export function aggregateYouTubePerformancesByTrack(
  performances: YouTubeVideoPerformance[],
  tracks: YouTubeTrackMetadata[]
): YouTubeTrackPerformance[] {
  const metadata = new Map(tracks.map((track) => [track.trackId, track]));
  const aggregates = new Map<string, YouTubeTrackPerformance>();

  for (const performance of performances) {
    if (
      performance.status !== "ELIGIBLE" ||
      !performance.trackId ||
      performance.weeklyViews == null
    ) {
      continue;
    }
    const track = metadata.get(performance.trackId);
    if (!track) continue;

    const current = aggregates.get(track.trackId) ?? {
      ...track,
      weeklyViews: 0,
      weeklyLikes: 0,
      weeklyComments: 0,
      totalViews: 0,
      eligibleVideoCount: 0,
      videoIds: [],
    };

    current.weeklyViews += performance.weeklyViews;
    current.weeklyLikes += performance.weeklyLikes ?? 0;
    current.weeklyComments += performance.weeklyComments ?? 0;
    current.totalViews += performance.totalViews ?? 0;
    current.eligibleVideoCount += 1;
    current.videoIds.push(performance.videoId);
    aggregates.set(track.trackId, current);
  }

  return [...aggregates.values()];
}

/**
 * Trie selon le cahier des charges : nouvelles vues, nouveaux likes, nouveaux
 * commentaires, vues totales, date de sortie, puis ID pour un résultat stable.
 */
export function rankYouTubeTracks(
  tracks: YouTubeTrackPerformance[],
  limit = 20
): RankedYouTubeTrack[] {
  return [...tracks]
    .sort(
      (a, b) =>
        b.weeklyViews - a.weeklyViews ||
        b.weeklyLikes - a.weeklyLikes ||
        b.weeklyComments - a.weeklyComments ||
        b.totalViews - a.totalViews ||
        Date.parse(b.releaseDate ?? "1970-01-01") -
          Date.parse(a.releaseDate ?? "1970-01-01") ||
        a.trackId.localeCompare(b.trackId)
    )
    .slice(0, Math.max(0, limit))
    .map((track, index) => ({ ...track, automaticRank: index + 1 }));
}
