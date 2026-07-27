/**
 * Abstraction storage pour la découverte YouTube (K4)
 * Testable sans Supabase réel.
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Types
// ============================================================

export interface CollectableChannel {
  id: string;
  channelId: string;
  channelTitle: string;
  channelType: string;
  uploadsPlaylistId: string | null;
  artistId: string | null;
  isActive: boolean;
  status: string;
  isYouTubeVerified: boolean;
}

export interface ExistingVideoRecord {
  videoId: string;
}

export interface NewVideoCandidate {
  videoId: string;
  channelId: string;
  sourceTitle: string;
  sourceThumbnailUrl: string | null;
  publishedAt: string;
  durationIso: string | null;
  durationSeconds: number | null;
  categoryId: string | null;
  tags: string[];
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  description: string | null;
}

export interface ChannelScanUpdate {
  channelId: string;
  lastScannedAt: string;
  lastScanError: string | null;
}

// ============================================================
// Interface
// ============================================================

export interface DiscoveryStorage {
  /** Retourne les chaînes actives, approuvées et avec playlist d'uploads. */
  getCollectableChannels(): Promise<CollectableChannel[]>;

  /** Retourne les video_id déjà en base pour un ensemble de video_id. */
  getExistingVideoIds(videoIds: string[]): Promise<Set<string>>;

  /**
   * Insère un candidat dans youtube_videos (idempotent via ON CONFLICT DO NOTHING).
   * Retourne true si la ligne a été insérée, false si elle existait déjà.
   */
  insertVideoCandidate(candidate: NewVideoCandidate): Promise<boolean>;

  /** Met à jour last_scanned_at et last_scan_error sur youtube_channels. */
  updateChannelScanStatus(update: ChannelScanUpdate): Promise<void>;
}

/** Adaptateur Supabase réel utilisé par l'orchestrateur côté serveur. */
export function createDiscoveryStorage(): DiscoveryStorage {
  const supabase = createAdminClient();

  return {
    async getCollectableChannels() {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("id, channel_id, channel_title, channel_type, uploads_playlist_id, artist_id, is_active, status, is_youtube_verified")
        .eq("is_active", true)
        .eq("status", "active")
        .eq("is_youtube_verified", true)
        .not("uploads_playlist_id", "is", null);

      if (error) throw new Error(`read youtube_channels: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        channelId: row.channel_id as string,
        channelTitle: row.channel_title as string,
        channelType: row.channel_type as string,
        uploadsPlaylistId: row.uploads_playlist_id as string | null,
        artistId: row.artist_id as string | null,
        isActive: row.is_active as boolean,
        status: row.status as string,
        isYouTubeVerified: row.is_youtube_verified as boolean,
      }));
    },

    async getExistingVideoIds(videoIds) {
      if (videoIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("youtube_videos")
        .select("video_id")
        .in("video_id", videoIds)
        .eq("is_active", true);

      if (error) throw new Error(`read youtube_videos: ${error.message}`);
      return new Set((data ?? []).map((row) => row.video_id as string));
    },

    async insertVideoCandidate(candidate) {
      const { data, error } = await supabase
        .from("youtube_videos")
        .upsert({
          video_id: candidate.videoId,
          channel_id: candidate.channelId,
          source_title: candidate.sourceTitle,
          source_description: candidate.description,
          source_thumbnail_url: candidate.sourceThumbnailUrl,
          published_at: candidate.publishedAt,
          duration_iso: candidate.durationIso,
          duration_seconds: candidate.durationSeconds,
          category_id: candidate.categoryId,
          tags: candidate.tags,
          view_count: candidate.viewCount,
          like_count: candidate.likeCount,
          comment_count: candidate.commentCount,
          review_status: "UNREVIEWED",
          is_eligible: false,
          is_active: true,
          video_type: "UNKNOWN",
        }, {
          onConflict: "video_id",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) throw new Error(`insert youtube_videos: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },

    async updateChannelScanStatus(update) {
      const { error } = await supabase
        .from("youtube_channels")
        .update({
          last_scanned_at: update.lastScannedAt,
          last_scan_error: update.lastScanError,
        })
        .eq("channel_id", update.channelId);

      if (error) throw new Error(`update youtube_channels: ${error.message}`);
    },
  };
}
