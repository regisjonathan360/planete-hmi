/**
 * PATCH /api/admin/youtube/videos/[id]
 * Mise à jour éditoriale atomique via RPC update_youtube_video_editorial.
 *
 * K6 v3 : une seule RPC fait tout atomiquement.
 * Liste blanche stricte — ne modifie JAMAIS video_id, channel_id,
 * métadonnées sources, compteurs, snapshots, dates sources.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { youtubeVideoEditorialInputSchema } from "@/components/youtube/forms";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Identifiant invalide." } },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    // Normaliser null → "" pour les champs optionnels string (le formulaire envoie null, Zod attend "")
    if (body.displayThumbnailUrl === null || body.displayThumbnailUrl === undefined) body.displayThumbnailUrl = "";
    if (body.trackId === null || body.trackId === undefined) body.trackId = "";
    if (body.exclusionReason === null || body.exclusionReason === undefined) body.exclusionReason = "";
    if (body.reviewReason === null || body.reviewReason === undefined) body.reviewReason = "";
    if (body.displayTitle === null || body.displayTitle === undefined) body.displayTitle = "";
    const parsed = youtubeVideoEditorialInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Données invalides.", details: parsed.error.issues.map(i => ({ path: i.path.join("."), msg: i.message })) } },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Validations de cohérence serveur
    if (input.isEligible && input.reviewStatus !== "APPROVED") {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Seule une vidéo approuvée peut être éligible." } },
        { status: 400 }
      );
    }
    if (input.reviewStatus === "EXCLUDED"
        && !input.exclusionReason) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Une justification d'exclusion est requise." } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Appel RPC atomique — tout ou rien
    const { data: result, error: rpcError } = await supabase.rpc("update_youtube_video_editorial", {
      p_youtube_video_id: idParsed.data,
      p_display_title: input.displayTitle,
      p_display_thumbnail_url: input.displayThumbnailUrl ?? "",
      p_review_status: input.reviewStatus,
      p_video_type: input.videoType,
      p_is_eligible: input.isEligible,
      p_track_id: input.trackId,
      p_exclusion_reason: input.exclusionReason ?? "",
      p_review_reason: input.reviewReason,
      p_reviewed_by: auth.user.id,
    });

    if (rpcError) {
      const safe = toSafeApiError(rpcError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.success) {
      const msgMap: Record<string, { msg: string; status: number }> = {
        video_not_found: { msg: "Vidéo introuvable.", status: 404 },
        track_not_found: { msg: "Chanson introuvable.", status: 404 },
        missing_video_id: { msg: "Identifiant manquant.", status: 400 },
        missing_reviewer: { msg: "Administrateur responsable manquant.", status: 400 },
        invalid_review_status: { msg: "Statut éditorial invalide.", status: 400 },
        invalid_video_type: { msg: "Type de vidéo invalide.", status: 400 },
        incoherent_eligibility: { msg: "Seule une vidéo approuvée peut être incluse dans le calcul.", status: 400 },
        exclusion_reason_required: { msg: "Une justification d’exclusion est requise.", status: 400 },
      };
      const mapped = msgMap[row?.message ?? ""] ?? { msg: "Échec de la mise à jour.", status: 500 };
      return NextResponse.json(
        { error: { code: mapped.status === 404 ? "not_found" : "validation_error", message: mapped.msg } },
        { status: mapped.status }
      );
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_video_update",
      entityType: "youtube_video",
      entityId: idParsed.data,
      newValue: {
        reviewStatus: input.reviewStatus,
        videoType: input.videoType,
        isEligible: input.isEligible,
        trackId: input.trackId,
      },
      reason: input.reviewReason,
    });

    return NextResponse.json({
      success: true,
      videoId: idParsed.data,
      reviewStatus: input.reviewStatus,
      videoType: input.videoType,
      isEligible: input.isEligible,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
