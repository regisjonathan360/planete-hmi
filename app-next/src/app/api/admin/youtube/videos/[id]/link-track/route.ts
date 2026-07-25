/**
 * POST /api/admin/youtube/videos/[id]/link-track
 * Association atomique vidéo–chanson via RPC transactionnelle.
 * Aucun état partiel possible.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const linkTrackSchema = z.object({
  trackId: z.string().uuid("trackId doit être un UUID valide."),
  assetRole: z.enum(["primary", "lyric", "visualizer", "live", "audio", "remix", "other"]).default("primary"),
  isPrimary: z.boolean().default(false),
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
    const parsed = linkTrackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Données invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = createAdminClient();

    // RPC transactionnelle : atomique (vidéo + chanson vérifiés + association + track_id)
    const { data: result, error } = await supabase.rpc("link_youtube_video_to_track", {
      p_youtube_video_id: idParsed.data,
      p_track_id: input.trackId,
      p_asset_role: input.assetRole,
      p_is_primary: input.isPrimary,
      p_linked_by: auth.user.id,
    });

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.success) {
      const messageMap: Record<string, string> = {
        video_not_found: "Vidéo introuvable.",
        track_not_found: "Chanson introuvable.",
        missing_video_id: "Identifiant de vidéo manquant.",
        missing_track_id: "Identifiant de chanson manquant.",
        invalid_asset_role: "Rôle d'asset invalide.",
      };
      const msg = messageMap[row?.message ?? ""] ?? "Échec de l'association.";
      const status = row?.message?.includes("not_found") ? 404 : 400;
      return NextResponse.json(
        { error: { code: status === 404 ? "not_found" : "validation_error", message: msg } },
        { status }
      );
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_video_link_track",
      entityType: "youtube_track_asset",
      entityId: row.asset_id,
      newValue: { videoId: idParsed.data, trackId: input.trackId, role: input.assetRole },
    });

    return NextResponse.json({
      success: true,
      assetId: row.asset_id,
      trackId: input.trackId,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
