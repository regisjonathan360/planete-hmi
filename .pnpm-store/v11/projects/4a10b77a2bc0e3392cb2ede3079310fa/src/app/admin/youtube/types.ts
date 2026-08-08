export interface YouTubeAdminStats {
  channels: number;
  activeChannels: number;
  pendingVideos: number;
  eligibleVideos: number;
  latestEdition: {
    id: string;
    status: string;
    periodStart: string;
    periodEnd: string;
  } | null;
}

export interface YouTubeChannel {
  id: string;
  channel_id: string;
  channel_title: string;
  channel_handle: string | null;
  channel_url: string;
  channel_type: string;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  video_count: number | null;
  is_youtube_verified: boolean;
  is_active: boolean;
  status: string;
  notes: string | null;
  approval_reason: string | null;
  last_scanned_at: string | null;
}

export interface YouTubeVideo {
  id: string;
  video_id: string;
  channel_id: string;
  source_title: string;
  source_thumbnail_url: string | null;
  published_at: string;
  duration_seconds: number | null;
  video_type: string;
  review_status: string;
  is_eligible: boolean;
  is_active: boolean;
  display_title: string | null;
  display_thumbnail_url: string | null;
  track_id: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
}

export interface TrackOption {
  id: string;
  title: string;
  artists: string;
}

export interface ChartEntry {
  entryId: string;
  rank: number;
  sourcePosition: number;
  trackId: string | null;
  youtubeVideoId: string;
  videoId: string;
  thumbnailUrl: string | null;
  videoUrl: string;
  title: string;
  artists: string;
  weeklyViews: number | null;
  weeklyLikes: number | null;
  weeklyComments: number | null;
  totalViews: number | null;
  eligibleVideoCount: number | null;
  isHidden: boolean;
  isExcluded: boolean;
  exclusionReason: string | null;
  displayTitle: string | null;
  displayArtist: string | null;
}

export interface ChartPreview {
  editionId: string;
  editionStatus: string;
  periodLabel: string | null;
  validationNotes: string | null;
  scheduledPublishAt: string | null;
  publishTimezone: string | null;
  entries: ChartEntry[];
}

export interface ChartValidation {
  valid: boolean;
  blockingErrors: string[];
  warnings: string[];
  editionId: string;
  editionStatus: string;
  entryCount: number;
}

export interface Publication {
  id: string;
  chart_edition_id: string;
  version: number;
  period_start: string;
  period_end: string;
  methodology: string;
  entry_count: number;
  published_at: string;
  restored_from_publication_id: string | null;
}
