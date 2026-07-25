import type {
  YOUTUBE_CHANNEL_TYPES,
  YOUTUBE_CHART_STATUSES,
  YOUTUBE_COLLECTION_MODES,
  YOUTUBE_COLLECTION_STATUSES,
  YOUTUBE_ELIGIBILITY_STATUSES,
  YOUTUBE_VIDEO_TYPES,
  YOUTUBE_VIDEO_VERIFICATION_STATUSES,
} from "./constants";

export type YouTubeVideoType = (typeof YOUTUBE_VIDEO_TYPES)[number];
export type YouTubeChannelType = (typeof YOUTUBE_CHANNEL_TYPES)[number];
export type YouTubeVerificationStatus =
  (typeof YOUTUBE_VIDEO_VERIFICATION_STATUSES)[number];
export type YouTubeEligibilityStatus =
  (typeof YOUTUBE_ELIGIBILITY_STATUSES)[number];
export type YouTubeCollectionMode = (typeof YOUTUBE_COLLECTION_MODES)[number];
export type YouTubeCollectionStatus =
  (typeof YOUTUBE_COLLECTION_STATUSES)[number];
export type YouTubeChartStatus = (typeof YOUTUBE_CHART_STATUSES)[number];

export interface YouTubeMetricValues {
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
}

export interface YouTubeMetricSnapshot extends YouTubeMetricValues {
  videoId: string;
  capturedAt: string;
  availabilityStatus: "AVAILABLE" | "PRIVATE" | "DELETED" | "UNAVAILABLE";
}

export interface YouTubeTrackedVideo {
  videoId: string;
  trackId: string | null;
  sourceTitle: string;
  displayTitle: string | null;
  channelId: string;
  publishedAt: string;
  videoType: YouTubeVideoType;
  verificationStatus: YouTubeVerificationStatus;
  eligibilityStatus: YouTubeEligibilityStatus;
  isAvailable: boolean;
}

export interface YouTubeVideoPeriodInput {
  video: YouTubeTrackedVideo;
  periodStart: string;
  periodEnd: string;
  startSnapshot: YouTubeMetricSnapshot | null;
  endSnapshot: YouTubeMetricSnapshot | null;
}

export type YouTubeVideoPerformanceStatus =
  | "ELIGIBLE"
  | "VIDEO_NOT_APPROVED"
  | "VIDEO_NOT_ELIGIBLE"
  | "SHORT_EXCLUDED"
  | "VIDEO_UNAVAILABLE"
  | "TRACK_MISSING"
  | "START_SNAPSHOT_MISSING"
  | "END_SNAPSHOT_MISSING"
  | "COUNTER_DECREASED";

export interface YouTubeVideoPerformance {
  videoId: string;
  trackId: string | null;
  status: YouTubeVideoPerformanceStatus;
  weeklyViews: number | null;
  weeklyLikes: number | null;
  weeklyComments: number | null;
  totalViews: number | null;
  usedZeroStart: boolean;
}

export interface YouTubeTrackPerformance {
  trackId: string;
  title: string;
  artistNames: string;
  releaseDate: string | null;
  weeklyViews: number;
  weeklyLikes: number;
  weeklyComments: number;
  totalViews: number;
  eligibleVideoCount: number;
  videoIds: string[];
}

export interface RankedYouTubeTrack extends YouTubeTrackPerformance {
  automaticRank: number;
}

export interface YouTubeCollectionProgress {
  status: YouTubeCollectionStatus;
  progressPercent: number;
  currentStep: string | null;
  channelsScanned: number;
  videosDiscovered: number;
  videosRefreshed: number;
  warningsCount: number;
  errorsCount: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface YouTubeDraftValidationEntry {
  trackId: string | null;
  publicTitle: string;
  videoType: YouTubeVideoType;
  verificationStatus: YouTubeVerificationStatus;
  eligibilityStatus: YouTubeEligibilityStatus;
  hasStartSnapshot: boolean;
  hasEndSnapshot: boolean;
  weeklyViews: number | null;
  hasDuplicate: boolean;
  artistIsLinked: boolean;
  /** `null` signifie que les overrides ne s'appliquent pas encore (K6). */
  manualOverrideApplied: boolean | null;
  overrideReason: string | null;
  likesAvailable: boolean;
  commentsAvailable: boolean;
  thumbnailWasChanged: boolean;
  videoIsAvailable: boolean;
}
