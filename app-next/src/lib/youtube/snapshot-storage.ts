/**
 * Abstraction storage pour les snapshots et le brouillon YouTube (K5 v2)
 * Testable sans Supabase réel.
 */
import "server-only";

// ============================================================
// Types
// ============================================================

export interface EligibleVideo {
  id: string;
  videoId: string;
  channelId: string;
  trackId: string;
  publishedAt: string;
  videoType: string;
}

export interface ExistingSnapshot {
  youtubeVideoId: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  availabilityStatus: string;
  observedAt: string;
}

export interface NewSnapshot {
  youtubeVideoId: string;
  syncRunId: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  availabilityStatus: string;
  source: string;
  error: string | null;
  observedAt?: string;
}

export interface FencedSnapshotResult {
  success: boolean;
  insertedCount: number;
  skippedCount: number;
}

export interface DraftEntry {
  track_id: string;
  metric_value: number;
  raw_artist_text: string;
  raw_track_title: string;
  delta_views: number;
  delta_likes: number;
  delta_comments: number;
  total_views: number;
  eligible_video_count: number;
}

export interface FencedDraftResult {
  success: boolean;
  editionId: string | null;
  message: string;
}

// ============================================================
// Interface
// ============================================================

export interface SnapshotStorage {
  /** Retourne les vidéos actives, approuvées, éligibles et associées à une chanson. */
  getEligibleVideos(): Promise<EligibleVideo[]>;

  /** Retourne les snapshots existants pour ce sync_run_id (clé = youtube_videos.id). */
  getSnapshotsByRunId(syncRunId: string): Promise<Map<string, ExistingSnapshot>>;

  /**
   * Insère des snapshots via RPC fencée (vérifie le lease K3).
   * Immuable et idempotent (ON CONFLICT DO NOTHING).
   */
  fencedInsertSnapshots(
    sourceKey: string,
    periodKey: string,
    ownerToken: string,
    syncRunId: string,
    snapshots: NewSnapshot[]
  ): Promise<FencedSnapshotResult>;

  /**
   * Retourne le dernier snapshot disponible AVANT ou À la borne pour chaque vidéo.
   * Ne retourne jamais un snapshot postérieur à la borne.
   * Clé = youtube_videos.id.
   */
  getLatestSnapshotsBefore(
    videoIds: string[],
    beforeOrAt: string
  ): Promise<Map<string, ExistingSnapshot>>;

  /**
   * Retourne le dernier snapshot disponible AVANT ou À la borne de fin pour chaque vidéo.
   * Ne retourne jamais un snapshot postérieur à periodEnd.
   * Clé = youtube_videos.id.
   */
  getLatestSnapshotsBeforeEnd(
    videoIds: string[],
    beforeOrAt: string
  ): Promise<Map<string, ExistingSnapshot>>;

  /** Retourne le dernier snapshot fiable (`available`) avant ou à la borne. */
  getLatestAvailableSnapshotsBefore(
    videoIds: string[],
    beforeOrAt: string
  ): Promise<Map<string, ExistingSnapshot>>;

  /** Retourne les métadonnées de chansons par IDs. */
  getTrackMetadata(
    trackIds: string[]
  ): Promise<Map<string, { title: string; artistNames: string; releaseDate: string | null }>>;

  /** Écrit le brouillon de manière fencée (vérifie le lease K3). */
  fencedUpsertDraft(
    sourceKey: string,
    periodKey: string,
    ownerToken: string,
    syncRunId: string,
    chartSourceId: string,
    periodStart: string,
    periodEnd: string,
    entries: DraftEntry[],
    status: "draft" | "needs_review",
    validationNotes: string | null
  ): Promise<FencedDraftResult>;
}
