/**
 * POST /api/admin/youtube/videos/[id]/approve
 * Approbation atomique d'une vidéo YouTube via RPC transactionnelle.
 *
 * K6 v3 : une seule RPC approve_youtube_video fait tout atomiquement.
 * Aucun état partiel possible.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { youtubeVideoTypeSchema } from "@/lib/youtube/schemas";
import { ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const approveSchema = z.object({
  videoType: youtubeVideoTypeSchema,
  trackId: z.string().uuid("trackId doit être un UUID valide.").nullable().optional(),
  reviewReason: z.string().trim().min(10, "La justification doit contenir au moins 10 caractères.").max(1000),
});

export async function POST(
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
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Données invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Validation côté serveur avant l'appel RPC
    if (!ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET.has(input.videoType)) {
      return NextResponse.json(
        { error: { code: "validation_error", message: `Le type "${input.videoType}" n'est pas éligible au classement principal.` } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Appel RPC atomique — tout ou rien
    const { data: result, error: rpcError } = await supabase.rpc("approve_youtube_video", {
      p_youtube_video_id: idParsed.data,
      p_track_id: input.trackId ?? null,
      p_video_type: input.videoType,
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
        ineligible_video_type: { msg: `Le type "${input.videoType}" n'est pas éligible.`, status: 400 },
        review_reason_too_short: { msg: "Justification trop courte (min. 10 caractères).", status: 400 },
        missing_params: { msg: "Paramètres manquants.", status: 400 },
      };
      const mapped = msgMap[row?.message ?? ""] ?? { msg: "Échec de l'approbation.", status: 500 };
      return NextResponse.json(
        { error: { code: mapped.status === 404 ? "not_found" : "validation_error", message: mapped.msg } },
        { status: mapped.status }
      );
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_video_approve",
      entityType: "youtube_video",
      entityId: idParsed.data,
      newValue: { reviewStatus: "APPROVED", videoType: input.videoType, trackId: input.trackId ?? null },
      reason: input.reviewReason,
    });

    return NextResponse.json({
      success: true,
      videoId: idParsed.data,
      reviewStatus: "APPROVED",
      videoType: input.videoType,
      trackId: input.trackId ?? null,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
