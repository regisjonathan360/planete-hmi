/**
 * Découverte de nouvelles vidéos YouTube (K4)
 *
 * Étape injectable pour l'orchestrateur K3.
 * Parcourt les chaînes collectables, découvre les vidéos inconnues,
 * récupère leurs détails et crée des candidats UNREVIEWED dans la base.
 *
 * Principes :
 * - Aucune approbation automatique
 * - Idempotence (ON CONFLICT DO NOTHING)
 * - Pas d'attribution artiste/chanson pour labels/distributeurs
 * - assertActive() pendant les traitements longs
 * - Pas de secret ni description complète dans les logs
 */
import "server-only";

import type { StepContext, StepResult, OrchestratorStep } from "./orchestrator";
import { CancellationRequestedError, LeaseLostError } from "./orchestrator";
import type {
  DiscoveryStorage,
  CollectableChannel,
  NewVideoCandidate,
} from "./discovery-storage";
import type { YouTubePlaylistItem, YouTubeVideoDetails } from "./api-client";
import type { YouTubeCollectionScopeOrNull } from "./collection-scope";

// ============================================================
// Types
// ============================================================

/** Interface pour les appels API YouTube (injectable pour tests) */
export interface DiscoveryApiClient {
  listPlaylistItems(playlistId: string, maxItems?: number): Promise<YouTubePlaylistItem[]>;
  getVideoDetails(videoIds: string[]): Promise<{ found: YouTubeVideoDetails[]; missing: string[]; invalid: string[] }>;
}

export interface DiscoveryConfig {
  /** Nombre max de vidéos à scanner par chaîne (défaut 200) */
  maxVideosPerChannel?: number;
  /** Taille de lot pour getVideoDetails (défaut 50) */
  detailsBatchSize?: number;
  /** Périmètre résolu pour une collecte CUSTOM. `null` = collecte globale. */
  scope?: YouTubeCollectionScopeOrNull;
}

export interface DiscoveryStepResult extends StepResult {
  channelsScanned: number;
  channelsSkipped: number;
  channelsErrored: number;
  videosDiscovered: number;
  videosAlreadyKnown: number;
  videosOutsidePeriod: number;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_MAX_VIDEOS_PER_CHANNEL = 200;
const DEFAULT_DETAILS_BATCH_SIZE = 50;
const MULTI_ARTIST_CHANNEL_TYPES = new Set([
  "LABEL_CHANNEL",
  "DISTRIBUTOR_CHANNEL",
  "COLLABORATOR_CHANNEL",
]);

// ============================================================
// Helpers
// ============================================================

/** Tronque un message pour le journal (pas de secret, pas de description complète). */
function safeLogMessage(msg: string, maxLen = 200): string {
  const redacted = msg
    .replace(/([?&](?:key|api_key|access_token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\bAIza[0-9A-Za-z_-]{16,}\b/g, "[REDACTED]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
  if (redacted.length <= maxLen) return redacted;
  return redacted.slice(0, maxLen) + "…";
}

/** Découpe un tableau en lots. */
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function isPublishedWithinPeriod(
  publishedAt: string,
  periodStart: string,
  periodEnd: string
): boolean {
  const publishedMs = Date.parse(publishedAt);
  const startMs = Date.parse(`${periodStart}T00:00:00.000Z`);
  const endExclusiveMs =
    Date.parse(`${periodEnd}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;

  return Number.isFinite(publishedMs)
    && publishedMs >= startMs
    && publishedMs < endExclusiveMs;
}

// ============================================================
// Discovery Service
// ============================================================

export class YouTubeDiscoveryService {
  private readonly maxVideosPerChannel: number;
  private readonly detailsBatchSize: number;
  private readonly scope: YouTubeCollectionScopeOrNull;

  constructor(
    private readonly apiClient: DiscoveryApiClient,
    private readonly storage: DiscoveryStorage,
    config?: DiscoveryConfig
  ) {
    this.maxVideosPerChannel = config?.maxVideosPerChannel ?? DEFAULT_MAX_VIDEOS_PER_CHANNEL;
    this.detailsBatchSize = config?.detailsBatchSize ?? DEFAULT_DETAILS_BATCH_SIZE;
    this.scope = config?.scope ?? null;
    if (!Number.isInteger(this.maxVideosPerChannel)
      || this.maxVideosPerChannel < 1
      || this.maxVideosPerChannel > 2000) {
      throw new Error("maxVideosPerChannel doit être un entier entre 1 et 2000.");
    }
    if (!Number.isInteger(this.detailsBatchSize)
      || this.detailsBatchSize < 1
      || this.detailsBatchSize > 50) {
      throw new Error("detailsBatchSize doit être un entier entre 1 et 50.");
    }
  }

  /**
   * Exécute la découverte complète pour toutes les chaînes collectables.
   * Utilisé directement comme execute() d'une OrchestratorStep.
   */
  async execute(ctx: StepContext): Promise<DiscoveryStepResult> {
    const allChannels = await this.storage.getCollectableChannels();
    const channels = this.scope
      ? allChannels.filter((channel) =>
          this.scope!.channelIds.includes(channel.id)
          || this.scope!.channelYouTubeIds.includes(channel.channelId)
          || (channel.artistId != null && this.scope!.artistIds.includes(channel.artistId))
        )
      : allChannels;

    let channelsScanned = 0;
    let channelsSkipped = 0;
    let channelsErrored = 0;
    let videosDiscovered = 0;
    let videosAlreadyKnown = 0;
    let videosOutsidePeriod = 0;
    let totalReceived = 0;

    for (let i = 0; i < channels.length; i++) {
      // Vérifier ownership + annulation
      await ctx.assertActive();

      const channel = channels[i];

      if (!channel.isActive || channel.status !== "active" || !channel.isYouTubeVerified) {
        channelsSkipped++;
        ctx.addWarning(`Chaîne "${channel.channelTitle}" : source non active, non approuvée ou non vérifiée.`);
        continue;
      }

      // Progression
      const percent = Math.round(((i + 1) / channels.length) * 90);
      await ctx.updateProgress(percent, `scan:${channel.channelTitle.slice(0, 40)}`);

      if (!channel.uploadsPlaylistId) {
        ctx.addWarning(`Chaîne "${channel.channelTitle}" : playlist d'uploads manquante, ignorée.`);
        channelsSkipped++;
        await this.storage.updateChannelScanStatus({
          channelId: channel.channelId,
          lastScannedAt: new Date().toISOString(),
          lastScanError: "uploads_playlist_missing",
        });
        continue;
      }

      try {
        const result = await this.scanChannel(channel, ctx);
        videosDiscovered += result.discovered;
        videosAlreadyKnown += result.alreadyKnown;
        videosOutsidePeriod += result.outsidePeriod;
        totalReceived += result.discovered + result.alreadyKnown;
        channelsScanned++;

        await this.storage.updateChannelScanStatus({
          channelId: channel.channelId,
          lastScannedAt: new Date().toISOString(),
          lastScanError: null,
        });
      } catch (err) {
        // LeaseLostError doit remonter immédiatement (pas une erreur de chaîne)
        if (err instanceof LeaseLostError || err instanceof CancellationRequestedError) throw err;

        // Erreur non fatale pour une chaîne — continuer les autres
        const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
        ctx.addWarning(`Chaîne "${channel.channelTitle}" : ${safeLogMessage(errMsg)}`);
        channelsErrored++;

        await this.storage.updateChannelScanStatus({
          channelId: channel.channelId,
          lastScannedAt: new Date().toISOString(),
          lastScanError: safeLogMessage(errMsg, 500),
        });
      }
    }

    return {
      recordsReceived: totalReceived,
      recordsNormalized: videosDiscovered,
      recordsMatched: 0,
      recordsRejected: channelsErrored,
      channelsScanned,
      channelsSkipped,
      channelsErrored,
      videosDiscovered,
      videosAlreadyKnown,
      videosOutsidePeriod,
    };
  }

  /**
   * Scanne une chaîne : récupère la liste d'uploads, filtre les connus,
   * récupère les détails et crée les candidats.
   */
  private async scanChannel(
    channel: CollectableChannel,
    ctx: StepContext
  ): Promise<{ discovered: number; alreadyKnown: number; outsidePeriod: number }> {
    // 1. Lister les vidéos de la playlist d'uploads
    const playlistItems = await this.apiClient.listPlaylistItems(
      channel.uploadsPlaylistId!,
      this.maxVideosPerChannel
    );

    if (playlistItems.length === 0) {
      return { discovered: 0, alreadyKnown: 0, outsidePeriod: 0 };
    }

    // 2. Dédoublonner dans le lot (la même vidéo peut apparaître sur plusieurs pages)
    const periodItems = playlistItems.filter((item) =>
      isPublishedWithinPeriod(item.publishedAt, ctx.periodStart, ctx.periodEnd)
    );
    let outsidePeriod = playlistItems.length - periodItems.length;

    const uniqueIds = [...new Set(periodItems.map(item => item.videoId))];

    if (uniqueIds.length === 0) {
      return { discovered: 0, alreadyKnown: 0, outsidePeriod };
    }

    // 3. Comparer avec la base — ne demander les détails que des inconnus
    const existingIds = await this.storage.getExistingVideoIds(uniqueIds);
    const newIds = uniqueIds.filter(id => !existingIds.has(id));
    const alreadyKnown = uniqueIds.length - newIds.length;

    if (newIds.length === 0) {
      return { discovered: 0, alreadyKnown, outsidePeriod };
    }

    // 4. Récupérer les détails par lots
    let discovered = 0;
    for (const batch of chunks(newIds, this.detailsBatchSize)) {
      await ctx.assertActive();

      const { found, missing, invalid } = await this.apiClient.getVideoDetails(batch);

      // Vidéos manquantes (privées/supprimées) → avertissement
      for (const missingId of missing) {
        ctx.addWarning(`Vidéo ${missingId} : privée/supprimée/indisponible, ignorée.`);
      }
      for (const invalidId of invalid) {
        ctx.addWarning(`Vidéo ${invalidId} : identifiant invalide, ignorée.`);
      }

      // 5. Créer les candidats
      for (const video of found) {
        if (!isPublishedWithinPeriod(video.publishedAt, ctx.periodStart, ctx.periodEnd)) {
          outsidePeriod++;
          ctx.addWarning(`Vidéo ${video.videoId} : date source hors période, ignorée.`);
          continue;
        }
        const candidate = this.buildCandidate(video);
        const inserted = await this.storage.insertVideoCandidate(candidate);
        if (inserted) discovered++;
      }
    }

    return { discovered, alreadyKnown, outsidePeriod };
  }

  /**
   * Construit un candidat NewVideoCandidate.
   * - UNREVIEWED, is_eligible=false, video_type=UNKNOWN par défaut.
   * - Pour LABEL/DISTRIBUTOR/COLLABORATOR : pas de rattachement automatique.
   * - La description source reste en base et n'entre jamais dans les journaux.
   */
  private buildCandidate(
    video: YouTubeVideoDetails
  ): NewVideoCandidate {
    return {
      videoId: video.videoId,
      channelId: video.channelId,
      sourceTitle: video.title,
      sourceThumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      durationIso: video.durationIso,
      durationSeconds: video.durationSeconds,
      categoryId: video.categoryId,
      tags: video.tags,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      // Métadonnée source persistée en base, jamais ajoutée aux warnings/sync_runs.
      description: video.description,
    };
  }
}

// ============================================================
// Factory : crée l'étape injectable pour l'orchestrateur
// ============================================================

export function createDiscoveryStep(
  apiClient: DiscoveryApiClient,
  storage: DiscoveryStorage,
  config?: DiscoveryConfig
): OrchestratorStep {
  const service = new YouTubeDiscoveryService(apiClient, storage, config);
  return {
    name: "discover_new_videos",
    execute: (ctx) => service.execute(ctx),
  };
}

/**
 * Détermine si une chaîne est de type multi-artistes (label, distributeur, collaborator).
 * Pour ces chaînes, aucun rattachement automatique artiste/chanson ne doit être fait.
 */
export function isMultiArtistChannel(channelType: string): boolean {
  return MULTI_ARTIST_CHANNEL_TYPES.has(channelType);
}
