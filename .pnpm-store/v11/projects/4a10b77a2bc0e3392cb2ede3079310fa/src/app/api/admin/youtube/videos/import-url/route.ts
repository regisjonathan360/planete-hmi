/**
 * POST /api/admin/youtube/videos/import-url
 * Importe une vidéo YouTube par URL.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { getVideoDetails } from "@/lib/youtube/api-client";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const importUrlSchema = z.object({
  url: z.string().url("URL invalide."),
});

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      return parsed.searchParams.get("v") || null;
    }
    return null;
  } catch {
    return null;
  }
}

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
    const parsed = importUrlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "URL invalide.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(parsed.data.url);
    if (!videoId) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Impossible d'extraire l'identifiant vidéo de l'URL." } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Vérifier si la vidéo existe déjà
    const { data: existing } = await supabase
      .from("youtube_videos")
      .select("id, video_id")
      .eq("video_id", videoId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: { code: "conflict", message: "Cette vidéo est déjà enregistrée." } },
        { status: 409 }
      );
    }

    // Récupérer les détails via l'API YouTube
    const { found, missing } = await getVideoDetails([videoId]);

    if (missing.includes(videoId) || found.length === 0) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Vidéo introuvable, privée ou supprimée." } },
        { status: 404 }
      );
    }

    const video = found[0];

    // Vérifier que la chaîne est enregistrée
    const { data: channel } = await supabase
      .from("youtube_channels")
      .select("channel_id")
      .eq("channel_id", video.channelId)
      .maybeSingle();

    if (!channel) {
      return NextResponse.json(
        { error: { code: "precondition_failed", message: "La chaîne de cette vidéo n'est pas enregistrée. Ajoutez-la d'abord." } },
        { status: 412 }
      );
    }

    // Insérer le candidat
    const { data: inserted, error: insertError } = await supabase
      .from("youtube_videos")
      .insert({
        video_id: video.videoId,
        channel_id: video.channelId,
        source_title: video.title,
        source_description: video.description,
        source_thumbnail_url: video.thumbnailUrl,
        published_at: video.publishedAt,
        duration_iso: video.durationIso,
        duration_seconds: video.durationSeconds,
        category_id: video.categoryId,
        tags: video.tags,
        view_count: video.viewCount,
        like_count: video.likeCount,
        comment_count: video.commentCount,
        review_status: "UNREVIEWED",
        is_eligible: false,
        video_type: "UNKNOWN",
      })
      .select("id, video_id, source_title")
      .single();

    if (insertError) {
      const safe = toSafeApiError(insertError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_video_import",
      entityType: "youtube_video",
      entityId: inserted.id,
      newValue: { videoId: video.videoId, title: video.title },
    });

    return NextResponse.json({ video: inserted }, { status: 201 });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
