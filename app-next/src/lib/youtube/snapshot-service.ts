/**
 * K5 v2 — Rafraîchissement vidéos, snapshots immuables et brouillon
 *
 * Deux étapes injectables pour l'orchestrateur K3 :
 * 1. refresh_and_snapshot : récupère les stats et crée les snapshots (fencés)
 * 2. compute_draft : calcule le classement et écrit le brouillon fencé
 *
 * Le vrai ownerToken est lu depuis ctx.ownerToken (acquis par K3).
 * Aucun token arbitraire ne peut être fourni de l'extérieur.
 *
 * Corrections v2 :
 * - Snapshots fencés via RPC PostgreSQL
 * - Bornes temporelles corrigées (end = periodEnd, pas periodStart)
 * - Vidéos indisponibles : pas de faux zéro, derniers compteurs connus
 * - Statut draft/needs_review selon anomalies
 * - Sanitisation des secrets dans les messages
 * - total_views dans les entrées pour l'aperçu
 */
import "server-only";

import { YOUTUBE_VIDEO_BATCH_SIZE } from "./constants";
import { LeaseLostError, CancellationRequestedError } from "./orchestrator";
import type { StepContext, StepResult, OrchestratorStep } from "./orchestrator";
import type { YouTubeVideoDetails } from "./api-client";
import type { YouTubeCollectionScopeOrNull } from "./collection-scope";
import { matchesScopedVideo } from "./collection-scope";
import type {
  SnapshotStorage,
  NewSnapshot,
  DraftEntry,
  EligibleVideo,
} from "./snapshot-storage";
import type { YouTubeTrackMetadata } from "./ranking";
import {
  calculateYouTubeVideoPerformance,
  aggregateYouTubePerformancesByTrack,
  rankYouTubeTracks,
} from "./ranking";
import type {
  YouTubeMetricSnapshot,
  YouTubeTrackedVideo,
  YouTubeVideoPeriodInput,
} from "./types";

// ============================================================
// Types
// ============================================================

/** Injectable API client (videos.list only) */
export interface SnapshotApiClient {
  getVideoDetails(videoIds: string[]): Promise<{
    found: YouTubeVideoDetails[];
    missing: string[];
    invalid: string[];
  }>;
}

export interface SnapshotStepConfig {
  chartSourceId: string;
  scope?: YouTubeCollectionScopeOrNull;
}

export function mapPrivacyStatus(
  privacyStatus: YouTubeVideoDetails["privacyStatus"]
): NewSnapshot["availabilityStatus"] {
  switch (privacyStatus) {
    case "public":
    case "unlisted":
      return "available";
    case "private":
      return "private";
  }
}

// ============================================================
// Helpers
// ============================================================

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Supprime les secrets potentiels d'un message d'erreur. */
function sanitizeError(msg: string): string {
  // Supprimer les clés API, tokens, URLs avec paramètres sensibles
  let safe = msg.replace(/key=[A-Za-z0-9_-]+/gi, "key=***");
  safe = safe.replace(/token=[A-Za-z0-9_-]+/gi, "token=***");
  safe = safe.replace(/AIza[A-Za-z0-9_-]{35}/g, "***API_KEY***");
  safe = safe.replace(/https?:\/\/[^\s"']+key=[^\s"']+/gi, "[URL masquée]");
  // Tronquer à 200 caractères
  if (safe.length > 200) safe = safe.slice(0, 200) + "…";
  return safe;
}

// ============================================================
// Step 1: Refresh & Snapshot (fenced)
// ============================================================

export class RefreshAndSnapshotService {
  constructor(
    private readonly api: SnapshotApiClient,
    private readonly storage: SnapshotStorage,
    private readonly scope: YouTubeCollectionScopeOrNull = null
  ) {}

  async execute(ctx: StepContext): Promise<StepResult> {
    const videos = (await this.storage.getEligibleVideos())
      .filter((video) => matchesScopedVideo(this.scope, video));
    if (videos.length === 0) {
      ctx.addWarning("Aucune vidéo éligible trouvée.");
      return { recordsReceived: 0 };
    }

    // Get existing snapshots for this run (for idempotent resume)
    const existingSnapshots = await this.storage.getSnapshotsByRunId(ctx.runId);

    // Deduplicate: one snapshot per video per run
    const videosToRefresh = videos.filter(v => !existingSnapshots.has(v.id));

    let created = 0;
    let rejected = 0;
    const skipped = existingSnapshots.size;
    const batches = chunks(videosToRefresh, YOUTUBE_VIDEO_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      await ctx.assertActive();

      const batch = batches[i];
      const videoIds = batch.map(v => v.videoId);
      const percent = Math.round(((i + 1) / batches.length) * 80);
      await ctx.updateProgress(percent, `snapshot:batch ${i + 1}/${batches.length}`);

      let found: YouTubeVideoDetails[] = [];
      let missing: string[] = [];
      let invalid: string[] = [];

      try {
        const result = await this.api.getVideoDetails(videoIds);
        found = result.found;
        missing = result.missing;
        invalid = result.invalid;
      } catch (err) {
        if (err instanceof LeaseLostError) throw err;
        if (err instanceof CancellationRequestedError) throw err;
        const msg = err instanceof Error ? err.message : "Erreur API";
        ctx.addWarning(`Lot ${i + 1} : ${sanitizeError(msg)}`);
        continue;
      }

      // Warn about invalid IDs
      for (const id of invalid) {
        ctx.addWarning(`ID vidéo invalide ignoré : ${id.slice(0, 20)}`);
      }

      // Build snapshots for found videos
      const videoMap = new Map(batch.map(v => [v.videoId, v]));
      const snapshotsToInsert: NewSnapshot[] = [];

      for (const detail of found) {
        const video = videoMap.get(detail.videoId);
        if (!video) continue;
        snapshotsToInsert.push({
          youtubeVideoId: video.id,
          syncRunId: ctx.runId,
          viewCount: detail.viewCount,
          likeCount: detail.likeCount,
          commentCount: detail.commentCount,
          availabilityStatus: mapPrivacyStatus(detail.privacyStatus),
          source: "youtube_data_api_v3",
          error: null,
        });
      }

      const missingVideos = missing
        .map((missingId) => videoMap.get(missingId))
        .filter((video): video is EligibleVideo => video != null);
      const lastAvailable = missingVideos.length > 0
        ? await this.storage.getLatestAvailableSnapshotsBefore(
            missingVideos.map((video) => video.id),
            new Date().toISOString()
          )
        : new Map<string, never>();

      // For missing videos, use only the last reliable counters.
      for (const missingId of missing) {
        const video = videoMap.get(missingId);
        if (!video) continue;
        ctx.addWarning(`Vidéo ${missingId} : privée/supprimée/indisponible.`);

        const previousSnap = lastAvailable.get(video.id);

        if (previousSnap) {
          // Record unavailability with last known counters
          snapshotsToInsert.push({
            youtubeVideoId: video.id,
            syncRunId: ctx.runId,
            viewCount: previousSnap.viewCount,
            likeCount: previousSnap.likeCount,
            commentCount: previousSnap.commentCount,
            availabilityStatus: "unavailable",
            source: "youtube_data_api_v3",
            error: "video_unavailable",
          });
        } else {
          // No reliable counters — do NOT create an artificial snapshot
          ctx.addWarning(`Vidéo ${missingId} : aucun compteur fiable, exclue du calcul.`);
          // Video will be excluded from ranking (no snapshot for this run)
          rejected += 1;
        }
      }

      // Fenced insert (all snapshots for this batch)
      if (snapshotsToInsert.length > 0) {
        await ctx.assertActive();
        const insertResult = await this.storage.fencedInsertSnapshots(
          ctx.sourceKey, ctx.periodKey, ctx.ownerToken, ctx.runId, snapshotsToInsert
        );
        if (!insertResult.success) {
          throw new LeaseLostError("Lease perdu pendant l'insertion des snapshots.");
        }
        created += insertResult.insertedCount;
      }
    }

    return {
      recordsReceived: videos.length,
      recordsNormalized: created + skipped,
      recordsMatched: created,
      recordsRejected: rejected,
    };
  }
}

// ============================================================
// Step 2: Compute Draft
// ============================================================

export class ComputeDraftService {
  constructor(
    private readonly storage: SnapshotStorage,
    private readonly config: SnapshotStepConfig
  ) {}

  async execute(ctx: StepContext): Promise<StepResult> {
    await ctx.assertActive();

    const videos = (await this.storage.getEligibleVideos())
      .filter((video) => matchesScopedVideo(this.config.scope ?? null, video));
    if (videos.length === 0) {
      ctx.addWarning("Aucune vidéo éligible pour le calcul du brouillon.");
      return { recordsReceived: 0 };
    }

    const videoInternalIds = videos.map(v => v.id);
    const anomalies: string[] = [];

    // Bornes temporelles corrigées :
    // - start = dernier snapshot <= periodStart
    // - end = dernier snapshot <= periodEnd (jamais un snapshot futur)
    const startSnapshots = await this.storage.getLatestSnapshotsBefore(
      videoInternalIds, ctx.periodStart
    );
    const endSnapshots = await this.storage.getLatestSnapshotsBeforeEnd(
      videoInternalIds, ctx.periodEnd
    );

    // Compute per-video performance
    const performances = videos.map(video => {
      const startSnap = startSnapshots.get(video.id);
      const endSnap = endSnapshots.get(video.id);

      // Pour les vidéos indisponibles : utiliser la disponibilité réelle du snapshot
      const endAvailable = endSnap ? endSnap.availabilityStatus === "available" : true;

      const input: YouTubeVideoPeriodInput = {
        video: {
          videoId: video.videoId,
          trackId: video.trackId,
          sourceTitle: "",
          displayTitle: null,
          channelId: video.channelId,
          publishedAt: video.publishedAt,
          videoType: video.videoType as YouTubeTrackedVideo["videoType"],
          verificationStatus: "APPROVED",
          eligibilityStatus: "ELIGIBLE",
          isAvailable: endAvailable,
        },
        periodStart: ctx.periodStart,
        periodEnd: ctx.periodEnd,
        startSnapshot: startSnap ? toMetricSnapshot(startSnap, video.videoId) : null,
        endSnapshot: endSnap && endSnap.availabilityStatus === "available"
          ? toMetricSnapshot(endSnap, video.videoId)
          : null,
      };

      return calculateYouTubeVideoPerformance(input);
    });

    // Collect anomalies for validation_notes
    for (const perf of performances) {
      if (perf.status === "START_SNAPSHOT_MISSING") {
        const msg = `Vidéo ${perf.videoId} : snapshot de départ manquant.`;
        ctx.addWarning(msg);
        anomalies.push(msg);
      } else if (perf.status === "END_SNAPSHOT_MISSING") {
        const msg = `Vidéo ${perf.videoId} : snapshot de fin manquant.`;
        ctx.addWarning(msg);
        anomalies.push(msg);
      } else if (perf.status === "COUNTER_DECREASED") {
        const msg = `Vidéo ${perf.videoId} : compteur diminué (anomalie).`;
        ctx.addWarning(msg);
        anomalies.push(msg);
      } else if (perf.status === "VIDEO_UNAVAILABLE") {
        const msg = `Vidéo ${perf.videoId} : indisponible, exclue du calcul.`;
        ctx.addWarning(msg);
        anomalies.push(msg);
      }
    }

    // Aggregate by track
    const trackIds = [...new Set(videos.map(v => v.trackId))];
    const trackMeta = await this.storage.getTrackMetadata(trackIds);
    const trackMetadataArr: YouTubeTrackMetadata[] = [...trackMeta.entries()].map(
      ([id, meta]) => ({ trackId: id, ...meta })
    );

    const aggregated = aggregateYouTubePerformancesByTrack(performances, trackMetadataArr);
    const ranked = rankYouTubeTracks(aggregated, 20);

    await ctx.updateProgress(90, "compute_draft:writing");
    await ctx.assertActive();

    // Build entries with total_views for preview
    const entries: DraftEntry[] = ranked.map(track => ({
      track_id: track.trackId,
      metric_value: track.weeklyViews,
      raw_artist_text: track.artistNames,
      raw_track_title: track.title,
      delta_views: track.weeklyViews,
      delta_likes: track.weeklyLikes,
      delta_comments: track.weeklyComments,
      total_views: track.totalViews,
      eligible_video_count: track.eligibleVideoCount,
    }));

    // Déterminer le statut : needs_review si anomalies significatives
    const hasSignificantAnomalies = anomalies.length > 0;
    const draftStatus: "draft" | "needs_review" = hasSignificantAnomalies ? "needs_review" : "draft";
    const validationNotes = anomalies.length > 0
      ? anomalies.slice(0, 50).join("\n")
      : null;

    // Write draft fenced (using the real ownerToken from K3)
    const result = await this.storage.fencedUpsertDraft(
      ctx.sourceKey,
      ctx.periodKey,
      ctx.ownerToken,
      ctx.runId,
      this.config.chartSourceId,
      ctx.periodStart,
      ctx.periodEnd,
      entries,
      draftStatus,
      validationNotes
    );

    if (!result.success) {
      if (result.message === "lease_invalid" || result.message === "sync_run_mismatch") {
        throw new LeaseLostError(`Écriture brouillon refusée : ${result.message}`);
      }
      if (result.message === "edition_published") {
        throw new Error("Impossible de modifier une édition publiée.");
      }
      throw new Error(`Écriture brouillon échouée : ${result.message}`);
    }

    return {
      recordsReceived: videos.length,
      recordsNormalized: ranked.length,
      recordsMatched: ranked.length,
      recordsRejected: 0,
    };
  }
}

// ============================================================
// Helper: convert ExistingSnapshot to YouTubeMetricSnapshot
// ============================================================

function toMetricSnapshot(
  snap: { viewCount: number; likeCount: number | null; commentCount: number | null; availabilityStatus: string; observedAt: string },
  videoId: string
): YouTubeMetricSnapshot {
  return {
    videoId,
    capturedAt: snap.observedAt,
    viewCount: snap.viewCount,
    likeCount: snap.likeCount,
    commentCount: snap.commentCount,
    availabilityStatus: snap.availabilityStatus === "available" ? "AVAILABLE"
      : snap.availabilityStatus === "private" ? "PRIVATE"
      : snap.availabilityStatus === "deleted" ? "DELETED"
      : "UNAVAILABLE",
  };
}

// ============================================================
// Factories
// ============================================================

export function createRefreshSnapshotStep(
  api: SnapshotApiClient,
  storage: SnapshotStorage,
  scope: YouTubeCollectionScopeOrNull = null
): OrchestratorStep {
  const service = new RefreshAndSnapshotService(api, storage, scope);
  return {
    name: "refresh_and_snapshot",
    execute: (ctx) => service.execute(ctx),
  };
}

export function createComputeDraftStep(
  storage: SnapshotStorage,
  config: SnapshotStepConfig
): OrchestratorStep {
  const service = new ComputeDraftService(storage, config);
  return {
    name: "compute_draft",
    execute: (ctx) => service.execute(ctx),
  };
}
