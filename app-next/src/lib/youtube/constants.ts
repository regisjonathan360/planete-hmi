export const YOUTUBE_HMI_SOURCE_KEY = "youtube_hmi_weekly_delta";
export const YOUTUBE_HMI_PUBLIC_NAME = "Top YouTube HMI";
export const YOUTUBE_HMI_METRIC_UNIT = "weekly_views";
export const YOUTUBE_HMI_TOP_LIMIT = 20;
export const YOUTUBE_DEFAULT_PERIOD_DAYS = 7;
export const YOUTUBE_VIDEO_BATCH_SIZE = 50;

export const YOUTUBE_HMI_PUBLIC_SUBTITLE =
  "Classement hebdomadaire des chansons d’artistes haïtiens selon les nouvelles vues enregistrées par leurs vidéos officielles YouTube suivies par Planet HMI.";

export const YOUTUBE_HMI_METHODOLOGY =
  "Ce classement mesure la croissance hebdomadaire mondiale des vidéos YouTube officielles associées aux chansons d’artistes haïtiens suivis par Planet HMI. Il ne représente pas exclusivement les vues réalisées sur le territoire haïtien.";

export const ELIGIBLE_YOUTUBE_VIDEO_TYPES = [
  "OFFICIAL_MUSIC_VIDEO",
  "OFFICIAL_AUDIO",
  "OFFICIAL_LYRIC_VIDEO",
  "OFFICIAL_VISUALIZER",
  "OFFICIAL_ANIMATION",
] as const;

export const EXCLUDED_YOUTUBE_VIDEO_TYPES = [
  "SHORT",
  "LIVE_PERFORMANCE",
  "CONCERT",
  "INTERVIEW",
  "TEASER",
  "TRAILER",
  "REACTION",
  "FAN_UPLOAD",
  "DANCE_CHALLENGE",
  "PODCAST",
  "COMPILATION",
  "BEHIND_THE_SCENES",
  "UNKNOWN",
] as const;

export const YOUTUBE_VIDEO_TYPES = [
  ...ELIGIBLE_YOUTUBE_VIDEO_TYPES,
  ...EXCLUDED_YOUTUBE_VIDEO_TYPES,
] as const;

export const YOUTUBE_CHANNEL_TYPES = [
  "OFFICIAL_ARTIST_CHANNEL",
  "TOPIC_CHANNEL",
  "VEVO_CHANNEL",
  "LABEL_CHANNEL",
  "DISTRIBUTOR_CHANNEL",
  "COLLABORATOR_CHANNEL",
  "OTHER_APPROVED_CHANNEL",
] as const;

export const YOUTUBE_VIDEO_VERIFICATION_STATUSES = [
  "UNREVIEWED",
  "NEEDS_INFORMATION",
  "APPROVED",
  "EXCLUDED",
  "DUPLICATE",
  "IGNORED",
] as const;

export const YOUTUBE_ELIGIBILITY_STATUSES = [
  "ELIGIBLE",
  "INELIGIBLE",
  "PENDING",
] as const;

export const YOUTUBE_COLLECTION_MODES = [
  "FULL_WEEKLY",
  "REFRESH_STATISTICS",
  "DISCOVER_NEW_RELEASES",
  "CUSTOM",
] as const;

export const YOUTUBE_COLLECTION_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "COMPLETED_WITH_WARNINGS",
  "FAILED",
  "CANCELLED",
] as const;

export const YOUTUBE_CHART_STATUSES = [
  "EMPTY",
  "COLLECTING",
  "NEEDS_REVIEW",
  "DRAFT",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
  "FAILED",
] as const;

export const ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET = new Set<string>(
  ELIGIBLE_YOUTUBE_VIDEO_TYPES
);
