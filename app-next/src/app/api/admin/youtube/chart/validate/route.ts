/**
 * POST /api/admin/youtube/chart/validate
 * Valide le brouillon du Top YouTube HMI avec les données réelles.
 *
 * Correction K6 v2 :
 * - Respecte le modèle N vidéos → 1 chanson
 * - Plusieurs vidéos éligibles ≠ doublon automatique
 * - Vérifie TOUTES les vidéos éligibles de chaque chanson
 * - Lectures groupées (pas de N+1)
 * - manualOverrideApplied / overrideReason : not_applicable (K7)
 * - Aucune valeur simulée
 * - Erreurs Supabase/RPC traitées (jamais transformées en faux résultat)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET,
  YOUTUBE_HMI_SOURCE_KEY,
} from "@/lib/youtube/constants";
import { validateYouTubeDraft } from "@/lib/youtube/validate-draft";
import { toSafeApiError } from "@/lib/youtube/api-error";
import type { YouTubeDraftValidationEntry } from "@/lib/youtube/types";

export const dynamic = "force-dynamic";

const validateSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
});

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
    const parsed = validateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd } = parsed.data;
    const supabase = createAdminClient();

    // 1. Trouver la source
    const { data: chartSource, error: srcErr } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();

    if (srcErr) {
      const safe = toSafeApiError(srcErr);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!chartSource) {
      return NextResponse.json(
        { error: { code: "precondition_failed", message: "Source de classement YouTube introuvable." } },
        { status: 412 }
      );
    }

    // 2. Trouver l'édition
    const { data: edition, error: edErr } = await supabase
      .from("chart_editions")
      .select("id, status, period_label")
      .eq("chart_source_id", chartSource.id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (edErr) {
      const safe = toSafeApiError(edErr);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!edition) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Aucune édition trouvée pour cette période." } },
        { status: 404 }
      );
    }

    // 3. Récupérer les entrées du brouillon
    const { data: entries, error: entErr } = await supabase
      .from("chart_entries")
      .select("track_id, metric_value, delta_views, delta_likes, delta_comments, total_views, eligible_video_count, raw_track_title")
      .eq("chart_edition_id", edition.id)
      .order("source_position", { ascending: true });

    if (entErr) {
      const safe = toSafeApiError(entErr);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Aucune entrée dans cette édition." } },
        { status: 404 }
      );
    }

    const trackIds = entries.map(e => e.track_id as string).filter(Boolean);

    // 4. Lecture groupée : artistes liés aux tracks
    const { data: allArtistLinks, error: artErr } = await supabase
      .from("track_artists")
      .select("track_id")
      .in("track_id", trackIds);
    if (artErr) {
      const safe = toSafeApiError(artErr);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    const tracksWithArtists = new Set((allArtistLinks ?? []).map(a => a.track_id as string));

    // 5. Lecture groupée : toutes les associations youtube_track_assets pour ces tracks
    const { data: allAssets, error: assErr } = await supabase
      .from("youtube_track_assets")
      .select("track_id, youtube_video_id, is_eligible")
      .in("track_id", trackIds);
    if (assErr) {
      const safe = toSafeApiError(assErr);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    // Map track_id → list of video UUIDs (eligible assets only)
    const trackVideoMap = new Map<string, string[]>();
    const videoTrackMap = new Map<string, Set<string>>();
    for (const asset of allAssets ?? []) {
      const tid = asset.track_id as string;
      const vid = asset.youtube_video_id as string;
      const linkedTracks = videoTrackMap.get(vid) ?? new Set<string>();
      linkedTracks.add(tid);
      videoTrackMap.set(vid, linkedTracks);
      if (!asset.is_eligible) continue;
      const list = trackVideoMap.get(tid) ?? [];
      list.push(vid);
      trackVideoMap.set(tid, list);
    }

    // 6. Collect all unique video IDs referenced
    const allVideoIds = [...new Set([...trackVideoMap.values()].flat())];

    // 7. Lecture groupée : données de toutes les vidéos
    const videoDataMap = new Map<string, {
      id: string; video_type: string; review_status: string;
      is_eligible: boolean; is_active: boolean;
      display_title: string | null; display_thumbnail_url: string | null;
      source_thumbnail_url: string | null; published_at: string | null;
    }>();

    if (allVideoIds.length > 0) {
      const { data: videos, error: vidErr } = await supabase
        .from("youtube_videos")
        .select("id, video_type, review_status, is_eligible, is_active, display_title, display_thumbnail_url, source_thumbnail_url, published_at")
        .in("id", allVideoIds);
      if (vidErr) {
        const safe = toSafeApiError(vidErr);
        return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
      }
      for (const v of videos ?? []) {
        videoDataMap.set(v.id as string, v as typeof videoDataMap extends Map<string, infer V> ? V : never);
      }
    }

    // 8. Lecture groupée : snapshots de début et de fin pour toutes les vidéos
    const startSnapshotSet = new Set<string>();
    const endSnapshotSet = new Set<string>();
    const endAvailabilityMap = new Map<string, string>();

    if (allVideoIds.length > 0) {
      const { data: startSnaps, error: ssErr } = await supabase.rpc("get_latest_snapshots_before", {
        p_video_ids: allVideoIds,
        p_before_or_at: periodStart,
      });
      if (ssErr) {
        const safe = toSafeApiError(ssErr);
        return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
      }
      for (const s of startSnaps ?? []) {
        startSnapshotSet.add(s.youtube_video_id as string);
      }

      const { data: endSnaps, error: esErr } = await supabase.rpc("get_latest_snapshots_before", {
        p_video_ids: allVideoIds,
        p_before_or_at: periodEnd,
      });
      if (esErr) {
        const safe = toSafeApiError(esErr);
        return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
      }
      for (const s of endSnaps ?? []) {
        endSnapshotSet.add(s.youtube_video_id as string);
        endAvailabilityMap.set(s.youtube_video_id as string, s.availability_status as string);
      }
    }

    // 9. Construire les entrées de validation — une par track (chanson)
    const validationEntries: YouTubeDraftValidationEntry[] = entries.map((entry) => {
      const trackId = entry.track_id as string | null;
      const artistIsLinked = trackId ? tracksWithArtists.has(trackId) : false;
      const videoIds = trackId ? (trackVideoMap.get(trackId) ?? []) : [];

      // Agréger les données de TOUTES les vidéos éligibles pour ce track
      let hasStartSnapshot = false;
      let hasEndSnapshot = false;
      let videoIsAvailable = true;
      let worstVideoType: YouTubeDraftValidationEntry["videoType"] = "UNKNOWN";
      let worstVerificationStatus: YouTubeDraftValidationEntry["verificationStatus"] = "APPROVED";
      let eligibilityStatus: YouTubeDraftValidationEntry["eligibilityStatus"] = "ELIGIBLE";
      let publicTitle = (entry.raw_track_title as string) ?? "";
      let thumbnailWasChanged = false;
      // hasDuplicate : true seulement si une chanson a des vidéos avec des associations contradictoires
      // Plusieurs vidéos éligibles sur un même track n'est PAS un doublon.
      const hasDuplicate = videoIds.some((videoId) => (videoTrackMap.get(videoId)?.size ?? 0) > 1);

      if (videoIds.length > 0) {
        // Pour chaque vidéo, vérifier les données réelles
        let allHaveStart = true;
        let allHaveEnd = true;
        let anyUnavailable = false;
        let anyNotApproved = false;
        let anyNotEligible = false;
        let anyMissing = false;
        let anyInactive = false;

        for (const vid of videoIds) {
          const vd = videoDataMap.get(vid);
          if (!vd) {
            // Vidéo attendue absente de la réponse — NE PAS ignorer silencieusement
            anyMissing = true;
            allHaveStart = false;
            allHaveEnd = false;
            continue;
          }

          // Vérifier is_active
          if (!vd.is_active) anyInactive = true;

          // Snapshots — appliquer la règle zéro-start de K5
          const hasStart = startSnapshotSet.has(vid);
          const hasEnd = endSnapshotSet.has(vid);

          if (!hasStart) {
            // Règle K5 : si la vidéo est publiée PENDANT la période, le zéro-start est légitime
            const publishedAt = vd.published_at ? Date.parse(vd.published_at) : 0;
            const periodStartMs = Date.parse(periodStart);
            const zeroStartAllowed = publishedAt >= periodStartMs;
            if (!zeroStartAllowed) {
              allHaveStart = false;
            }
            // Si zéro-start est autorisé, on considère qu'il y a un snapshot de départ
          }
          if (!hasEnd) allHaveEnd = false;

          // Disponibilité
          const avail = endAvailabilityMap.get(vid);
          if (avail && avail !== "available") anyUnavailable = true;

          // Statuts — vérifier CHAQUE vidéo, pas seulement la première
          if (vd.review_status !== "APPROVED") anyNotApproved = true;
          if (!vd.is_eligible) anyNotEligible = true;

          // Type — n'importe quel type exclu rend l'agrégation non éligible.
          if (!ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET.has(vd.video_type)) {
            worstVideoType = vd.video_type as YouTubeDraftValidationEntry["videoType"];
            anyNotEligible = true;
          }

          // Utiliser la première vidéo seulement pour les champs d'affichage.
          if (vid === videoIds[0]) {
            if (worstVideoType === "UNKNOWN") {
              worstVideoType = vd.video_type as YouTubeDraftValidationEntry["videoType"];
            }
            worstVerificationStatus = vd.review_status as YouTubeDraftValidationEntry["verificationStatus"];
            eligibilityStatus = vd.is_eligible ? "ELIGIBLE" : "PENDING";
            publicTitle = vd.display_title || publicTitle;
            thumbnailWasChanged = !!(vd.display_thumbnail_url && vd.display_thumbnail_url !== vd.source_thumbnail_url);
          }
        }

        hasStartSnapshot = allHaveStart;
        hasEndSnapshot = allHaveEnd;
        videoIsAvailable = !anyUnavailable;
        if (anyNotApproved || anyMissing || anyInactive) worstVerificationStatus = "UNREVIEWED";
        if (anyNotEligible) eligibilityStatus = "PENDING";
      }

      return {
        trackId,
        publicTitle,
        videoType: worstVideoType,
        verificationStatus: worstVerificationStatus,
        eligibilityStatus,
        hasStartSnapshot,
        hasEndSnapshot,
        weeklyViews: entry.delta_views as number | null,
        hasDuplicate,
        artistIsLinked,
        // K7 sera responsable des overrides manuels : null = non applicable en K6.
        manualOverrideApplied: null,
        overrideReason: null,
        likesAvailable: entry.delta_likes != null,
        commentsAvailable: entry.delta_comments != null,
        thumbnailWasChanged,
        videoIsAvailable,
      };
    });

    const result = validateYouTubeDraft({
      periodStart,
      periodEnd,
      publicPeriodLabel: (edition.period_label as string) ?? `${periodStart} — ${periodEnd}`,
      entries: validationEntries,
    });

    return NextResponse.json({
      valid: result.valid,
      blockingErrors: result.blockingErrors,
      warnings: result.warnings,
      editionId: edition.id,
      editionStatus: edition.status,
      entryCount: validationEntries.length,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
