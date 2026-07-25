/**
 * POST /api/admin/youtube/collect
 * Déclenche une collecte YouTube (orchestrateur K3 + étapes K4/K5).
 *
 * Protégé par requireAdmin.
 * Body : YouTubeCollectionParams (validé par Zod via D10).
 *
 * Honore tous les paramètres D10 :
 * - mode, artistIds, channelIds, videoIds, trackIds
 * - discoverNewVideos, refreshStatistics, refreshMetadata
 * - createDraft, recalculateChart
 *
 * Idempotent : si un run est déjà terminé pour la même période, retourne le résultat existant.
 * Ne publie jamais automatiquement.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { youtubeCollectionParamsSchema } from "@/lib/youtube/schemas";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { YouTubeCollectionOrchestrator } from "@/lib/youtube/orchestrator";
import { createOrchestratorStorage } from "@/lib/youtube/orchestrator-storage";
import { createDiscoveryStep } from "@/lib/youtube/discovery";
import { createDiscoveryStorage } from "@/lib/youtube/discovery-storage";
import {
  createRefreshSnapshotStep,
  createComputeDraftStep,
} from "@/lib/youtube/snapshot-service";
import { createSnapshotStorage } from "@/lib/youtube/snapshot-supabase-storage";
import * as apiClient from "@/lib/youtube/api-client";
import { toSafeApiError, sanitizeErrorMessage } from "@/lib/youtube/api-error";
import type { OrchestratorStep } from "@/lib/youtube/orchestrator";
import type { YouTubeCollectionScopeOrNull } from "@/lib/youtube/collection-scope";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json();
    const parsed = youtubeCollectionParamsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const params = parsed.data;
    const supabase = createAdminClient();

    // refreshMetadata non supporté → erreur avant toute construction
    if (params.refreshMetadata) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "refreshMetadata n'est pas encore supporté." } },
        { status: 400 }
      );
    }

    // Résoudre le chartSourceId — obligatoire si createDraft ou recalculateChart
    const { data: chartSource, error: srcError } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();

    if (srcError) {
      const safe = toSafeApiError(srcError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    const chartSourceId = (chartSource?.id as string) ?? null;

    if ((params.createDraft || params.recalculateChart) && !chartSourceId) {
      return NextResponse.json(
        { error: { code: "precondition_failed", message: "Source de classement YouTube introuvable. Impossible de créer un brouillon." } },
        { status: 412 }
      );
    }

    let scope: YouTubeCollectionScopeOrNull = null;

    // Mode CUSTOM : validation et résolution du périmètre réel.
    if (params.mode === "CUSTOM") {
      const hasCibles =
        params.artistIds.length > 0 ||
        params.channelIds.length > 0 ||
        params.videoIds.length > 0 ||
        params.trackIds.length > 0;
      if (!hasCibles) {
        return NextResponse.json(
          { error: { code: "validation_error", message: "Une collecte personnalisée doit cibler au moins un élément." } },
          { status: 400 }
        );
      }

      const channelYouTubeIds = new Set<string>();
      const resolvedTrackIds = new Set<string>(params.trackIds);

      // Valider l'existence des cibles et résoudre leurs identifiants YouTube.
      if (params.channelIds.length > 0) {
        const { data: channels, error: chErr } = await supabase
          .from("youtube_channels")
          .select("id, channel_id")
          .in("id", params.channelIds);
        if (chErr) {
          const safe = toSafeApiError(chErr);
          return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
        }
        if ((channels?.length ?? 0) !== params.channelIds.length) {
          return NextResponse.json(
            { error: { code: "validation_error", message: "Une ou plusieurs chaînes cibles sont introuvables." } },
            { status: 400 }
          );
        }
        for (const channel of channels ?? []) {
          channelYouTubeIds.add(channel.channel_id as string);
        }
      }
      if (params.videoIds.length > 0) {
        const { data: videos, error: vidErr } = await supabase
          .from("youtube_videos")
          .select("id, channel_id, track_id")
          .in("id", params.videoIds);
        if (vidErr) {
          const safe = toSafeApiError(vidErr);
          return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
        }
        if ((videos?.length ?? 0) !== params.videoIds.length) {
          return NextResponse.json(
            { error: { code: "validation_error", message: "Une ou plusieurs vidéos cibles sont introuvables." } },
            { status: 400 }
          );
        }
        for (const video of videos ?? []) {
          channelYouTubeIds.add(video.channel_id as string);
        }
      }
      if (params.trackIds.length > 0) {
        const { data: tracks, error: trErr } = await supabase
          .from("tracks")
          .select("id")
          .in("id", params.trackIds);
        if (trErr) {
          const safe = toSafeApiError(trErr);
          return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
        }
        if ((tracks?.length ?? 0) !== params.trackIds.length) {
          return NextResponse.json(
            { error: { code: "validation_error", message: "Un ou plusieurs tracks cibles sont introuvables." } },
            { status: 400 }
          );
        }

        const { data: trackAssets, error: assetErr } = await supabase
          .from("youtube_track_assets")
          .select("youtube_video_id")
          .in("track_id", params.trackIds);
        if (assetErr) {
          const safe = toSafeApiError(assetErr);
          return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
        }
        const linkedVideoIds = [...new Set((trackAssets ?? []).map((asset) => asset.youtube_video_id as string))];
        if (linkedVideoIds.length > 0) {
          const { data: linkedVideos, error: linkedVideoErr } = await supabase
            .from("youtube_videos")
            .select("channel_id")
            .in("id", linkedVideoIds);
          if (linkedVideoErr) {
            const safe = toSafeApiError(linkedVideoErr);
            return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
          }
          for (const video of linkedVideos ?? []) {
            channelYouTubeIds.add(video.channel_id as string);
          }
        }
      }
      if (params.artistIds.length > 0) {
        const { data: artists, error: arErr } = await supabase
          .from("artists")
          .select("id")
          .in("id", params.artistIds);
        if (arErr) {
          const safe = toSafeApiError(arErr);
          return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
        }
        if ((artists?.length ?? 0) !== params.artistIds.length) {
          return NextResponse.json(
            { error: { code: "validation_error", message: "Un ou plusieurs artistes cibles sont introuvables." } },
            { status: 400 }
          );
        }

        const [
          { data: artistChannels, error: artistChannelErr },
          { data: artistTracks, error: artistTrackErr },
        ] = await Promise.all([
          supabase
            .from("youtube_channels")
            .select("channel_id")
            .in("artist_id", params.artistIds),
          supabase
            .from("track_artists")
            .select("track_id")
            .in("artist_id", params.artistIds),
        ]);
        if (artistChannelErr || artistTrackErr) {
          const safe = toSafeApiError(artistChannelErr ?? artistTrackErr);
          return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
        }
        for (const channel of artistChannels ?? []) {
          channelYouTubeIds.add(channel.channel_id as string);
        }
        for (const track of artistTracks ?? []) {
          resolvedTrackIds.add(track.track_id as string);
        }
      }

      scope = {
        mode: "CUSTOM",
        artistIds: params.artistIds,
        channelIds: params.channelIds,
        channelYouTubeIds: [...channelYouTubeIds],
        videoIds: params.videoIds,
        trackIds: [...resolvedTrackIds],
      };
    }

    // Construire les étapes seulement après résolution du périmètre.
    const steps: OrchestratorStep[] = [];

    if (params.discoverNewVideos) {
      const discoveryStorage = createDiscoveryStorage();
      steps.push(createDiscoveryStep(apiClient, discoveryStorage, { scope }));
    }

    if (params.refreshStatistics) {
      const snapshotStorage = createSnapshotStorage();
      steps.push(createRefreshSnapshotStep(apiClient, snapshotStorage, scope));
    }

    // Une seule étape compute_draft même si les deux options sont vraies.
    if ((params.createDraft || params.recalculateChart) && chartSourceId) {
      const snapshotStorage = createSnapshotStorage();
      steps.push(createComputeDraftStep(snapshotStorage, { chartSourceId, scope }));
    }

    if (steps.length === 0) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Aucune étape sélectionnée." } },
        { status: 400 }
      );
    }

    const orchestratorStorage = createOrchestratorStorage();
    const orchestrator = new YouTubeCollectionOrchestrator(
      {
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        steps,
      },
      orchestratorStorage
    );

    const result = await orchestrator.run();

    // Audit
    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_collect",
      entityType: "sync_run",
      entityId: result.runId,
      newValue: {
        status: result.status,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        mode: params.mode,
        discoverNewVideos: params.discoverNewVideos,
        refreshStatistics: params.refreshStatistics,
        createDraft: params.createDraft,
        recalculateChart: params.recalculateChart,
      },
    });

    return NextResponse.json({
      status: result.status,
      runId: result.runId,
      warnings: result.warnings.map(w => sanitizeErrorMessage(w)),
      error: result.error ? sanitizeErrorMessage(result.error) : null,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
