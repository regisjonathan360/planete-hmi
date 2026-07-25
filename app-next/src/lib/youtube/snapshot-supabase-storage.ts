/**
 * Implémentation Supabase de SnapshotStorage (K5 v2)
 * Utilise le client service_role (bypass RLS).
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  SnapshotStorage,
  EligibleVideo,
  ExistingSnapshot,
  FencedSnapshotResult,
  FencedDraftResult,
} from "./snapshot-storage";

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Réponse Supabase invalide : compteur non numérique.");
  }
  return parsed;
}

function toNullableNumber(value: unknown): number | null {
  return value == null ? null : toNumber(value);
}

function safeErrorMessage(message: string): string {
  return message
    .replace(/([?&](?:key|token|apikey|access_token)=)[^&\s]+/gi, "$1***")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "***")
    .slice(0, 200);
}

function storageError(context: string, message: string): Error {
  return new Error(`${context}: ${safeErrorMessage(message)}`);
}

function snapshotsToMap(data: unknown): Map<string, ExistingSnapshot> {
  const map = new Map<string, ExistingSnapshot>();
  for (const raw of Array.isArray(data) ? data : []) {
    const row = raw as Record<string, unknown>;
    const youtubeVideoId = String(row.youtube_video_id);
    map.set(youtubeVideoId, {
      youtubeVideoId,
      viewCount: toNumber(row.view_count),
      likeCount: toNullableNumber(row.like_count),
      commentCount: toNullableNumber(row.comment_count),
      availabilityStatus: String(row.availability_status),
      observedAt: String(row.observed_at),
    });
  }
  return map;
}

export function createSnapshotStorage(): SnapshotStorage {
  const supabase = createAdminClient();

  return {
    async getEligibleVideos(): Promise<EligibleVideo[]> {
      // Vidéos actives, APPROVED, éligibles, associées via youtube_track_assets
      const { data, error } = await supabase
        .from("youtube_videos")
        .select(`
          id, video_id, channel_id, published_at, video_type,
          youtube_track_assets!inner(track_id)
        `)
        .eq("is_active", true)
        .eq("review_status", "APPROVED")
        .eq("is_eligible", true);

      if (error) throw storageError("getEligibleVideos", error.message);
      if (!data) return [];

      return data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        videoId: row.video_id as string,
        channelId: row.channel_id as string,
        trackId: ((row.youtube_track_assets as Record<string, unknown>[])?.[0]?.track_id ?? "") as string,
        publishedAt: row.published_at as string,
        videoType: row.video_type as string,
      })).filter(v => v.trackId !== "");
    },

    async getSnapshotsByRunId(syncRunId: string): Promise<Map<string, ExistingSnapshot>> {
      const { data, error } = await supabase
        .from("youtube_metric_snapshots")
        .select("youtube_video_id, view_count, like_count, comment_count, availability_status, observed_at")
        .eq("sync_run_id", syncRunId);

      if (error) throw storageError("getSnapshotsByRunId", error.message);
      return snapshotsToMap(data);
    },

    async fencedInsertSnapshots(
      sourceKey, periodKey, ownerToken, syncRunId, snapshots
    ): Promise<FencedSnapshotResult> {
      const payload = snapshots.map(s => ({
        youtube_video_id: s.youtubeVideoId,
        view_count: s.viewCount,
        like_count: s.likeCount,
        comment_count: s.commentCount,
        availability_status: s.availabilityStatus,
        source: s.source,
        error: s.error,
        observed_at: s.observedAt ?? new Date().toISOString(),
      }));

      const { data, error } = await supabase.rpc("fenced_insert_youtube_snapshots", {
        p_source_key: sourceKey,
        p_period_key: periodKey,
        p_owner_token: ownerToken,
        p_sync_run_id: syncRunId,
        p_snapshots: JSON.parse(JSON.stringify(payload)),
      });
      if (error) throw storageError("fenced_insert_youtube_snapshots", error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        success: !!row?.success,
        insertedCount: row?.inserted_count ?? 0,
        skippedCount: row?.skipped_count ?? 0,
      };
    },

    async getLatestSnapshotsBefore(videoIds, beforeOrAt): Promise<Map<string, ExistingSnapshot>> {
      if (videoIds.length === 0) return new Map();
      // Dernier snapshot disponible <= borne pour chaque vidéo
      const { data, error } = await supabase.rpc("get_latest_snapshots_before", {
        p_video_ids: videoIds,
        p_before_or_at: beforeOrAt,
      });
      if (error) throw storageError("getLatestSnapshotsBefore", error.message);
      return snapshotsToMap(data);
    },

    async getLatestSnapshotsBeforeEnd(videoIds, beforeOrAt): Promise<Map<string, ExistingSnapshot>> {
      // Même logique, borne différente (periodEnd)
      return this.getLatestSnapshotsBefore(videoIds, beforeOrAt);
    },

    async getLatestAvailableSnapshotsBefore(videoIds, beforeOrAt): Promise<Map<string, ExistingSnapshot>> {
      if (videoIds.length === 0) return new Map();
      const { data, error } = await supabase.rpc("get_latest_available_snapshots_before", {
        p_video_ids: videoIds,
        p_before_or_at: beforeOrAt,
      });
      if (error) throw storageError("getLatestAvailableSnapshotsBefore", error.message);
      return snapshotsToMap(data);
    },

    async getTrackMetadata(trackIds): Promise<Map<string, { title: string; artistNames: string; releaseDate: string | null }>> {
      if (trackIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, release_date, track_artists(artists(name))")
        .in("id", trackIds);

      if (error) throw storageError("getTrackMetadata", error.message);
      const map = new Map<string, { title: string; artistNames: string; releaseDate: string | null }>();
      for (const row of data ?? []) {
        const trackArtists = row.track_artists as Array<{ artists: unknown }> ?? [];
        const artists = trackArtists
          .map(ta => (ta.artists as { name: string } | null)?.name)
          .filter(Boolean)
          .join(", ");
        map.set(row.id as string, {
          title: row.title as string,
          artistNames: artists || "Inconnu",
          releaseDate: (row.release_date as string) ?? null,
        });
      }
      return map;
    },

    async fencedUpsertDraft(
      sourceKey, periodKey, ownerToken, syncRunId,
      chartSourceId, periodStart, periodEnd, entries, status, validationNotes
    ): Promise<FencedDraftResult> {
      const payload = entries.map(e => ({
        track_id: e.track_id,
        metric_value: e.metric_value,
        raw_artist_text: e.raw_artist_text,
        raw_track_title: e.raw_track_title,
        delta_views: e.delta_views,
        delta_likes: e.delta_likes,
        delta_comments: e.delta_comments,
        total_views: e.total_views,
        eligible_video_count: e.eligible_video_count,
      }));

      const { data, error } = await supabase.rpc("fenced_upsert_youtube_draft", {
        p_source_key: sourceKey,
        p_period_key: periodKey,
        p_owner_token: ownerToken,
        p_sync_run_id: syncRunId,
        p_chart_source_id: chartSourceId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_entries: JSON.parse(JSON.stringify(payload)),
        p_status: status,
        p_validation_notes: validationNotes,
      });
      if (error) throw storageError("fenced_upsert_youtube_draft", error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        success: !!row?.success,
        editionId: row?.edition_id ?? null,
        message: row?.message ?? "unknown",
      };
    },
  };
}
