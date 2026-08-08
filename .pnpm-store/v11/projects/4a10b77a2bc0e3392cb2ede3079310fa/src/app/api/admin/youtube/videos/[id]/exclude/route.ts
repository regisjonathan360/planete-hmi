/**
 * POST /api/admin/youtube/videos/[id]/exclude
 * Exclut une vidéo YouTube du classement.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const excludeSchema = z.object({
  exclusionReason: z.string().trim().min(5, "La raison d'exclusion doit faire au moins 5 caractères.").max(1000),
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
    const parsed = excludeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Données invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = createAdminClient();

    const { data: video, error: fetchError } = await supabase
      .from("youtube_videos")
      .select("id, review_status")
      .eq("id", idParsed.data)
      .maybeSingle();

    if (fetchError) {
      const safe = toSafeApiError(fetchError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!video) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Vidéo introuvable." } },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("youtube_videos")
      .update({
        review_status: "EXCLUDED",
        is_eligible: false,
        exclusion_reason: input.exclusionReason,
        review_reason: input.reviewReason,
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", idParsed.data)
      .select("id, video_id, review_status, is_eligible")
      .single();

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_video_exclude",
      entityType: "youtube_video",
      entityId: idParsed.data,
      oldValue: { reviewStatus: video.review_status },
      newValue: { reviewStatus: "EXCLUDED" },
      reason: input.reviewReason,
    });

    return NextResponse.json({ video: data });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
