/**
 * POST /api/admin/youtube/chart/preview
 * Aperçu du classement brouillon.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
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
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd } = parsed.data;
    const supabase = createAdminClient();

    // Trouver la source
    const { data: chartSource } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();

    if (!chartSource) {
      return NextResponse.json(
        { error: { code: "precondition_failed", message: "Source de classement YouTube introuvable." } },
        { status: 412 }
      );
    }

    // Trouver l'édition
    const { data: edition, error: editionError } = await supabase
      .from("chart_editions")
      .select("id, status, period_label, validation_notes, scheduled_publish_at, publish_timezone")
      .eq("chart_source_id", chartSource.id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (editionError) {
      const safe = toSafeApiError(editionError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!edition) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Aucune édition trouvée pour cette période." } },
        { status: 404 }
      );
    }

    // Récupérer les entrées
    const { data: entries, error: entriesError } = await supabase
      .from("chart_entries")
      .select("id, source_position, admin_position, filtered_position, track_id, youtube_video_id, metric_value, delta_views, delta_likes, delta_comments, total_views, eligible_video_count, raw_artist_text, raw_track_title, display_title, display_artist, is_hidden, is_excluded, exclusion_reason, youtube_videos(video_id, source_title, display_title, source_thumbnail_url, display_thumbnail_url, youtube_channels(channel_title))")
      .eq("chart_edition_id", edition.id)
      .order("source_position", { ascending: true });

    if (entriesError) {
      const safe = toSafeApiError(entriesError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    const sortedEntries = [...(entries ?? [])].sort((a, b) => {
      const aPosition = (a.admin_position as number | null) ?? (a.source_position as number);
      const bPosition = (b.admin_position as number | null) ?? (b.source_position as number);
      return aPosition - bPosition;
    });

    const preview = sortedEntries.map((entry, index) => {
      const video = (Array.isArray(entry.youtube_videos) ? entry.youtube_videos[0] : entry.youtube_videos) as {
        video_id?: string;
        source_title?: string;
        display_title?: string | null;
        source_thumbnail_url?: string | null;
        display_thumbnail_url?: string | null;
        youtube_channels?: { channel_title?: string } | Array<{ channel_title?: string }>;
      } | null;
      const channel = Array.isArray(video?.youtube_channels)
        ? video.youtube_channels[0]
        : video?.youtube_channels;
      return {
        entryId: entry.id,
        rank: entry.filtered_position ?? index + 1,
        sourcePosition: entry.source_position,
        trackId: entry.track_id,
        youtubeVideoId: entry.youtube_video_id,
        videoId: video?.video_id ?? "",
        thumbnailUrl: video?.display_thumbnail_url ?? video?.source_thumbnail_url ?? null,
        videoUrl: video?.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : "",
        title: entry.display_title ?? video?.display_title ?? video?.source_title ?? entry.raw_track_title ?? "",
        artists: entry.display_artist ?? channel?.channel_title ?? entry.raw_artist_text ?? "",
        weeklyViews: entry.delta_views ?? entry.metric_value,
        weeklyLikes: entry.delta_likes,
        weeklyComments: entry.delta_comments,
        totalViews: entry.total_views,
        eligibleVideoCount: entry.eligible_video_count,
        isHidden: entry.is_hidden,
        isExcluded: entry.is_excluded,
        exclusionReason: entry.exclusion_reason,
        displayTitle: entry.display_title,
        displayArtist: entry.display_artist,
      };
    });

    return NextResponse.json({
      editionId: edition.id,
      editionStatus: edition.status,
      periodLabel: edition.period_label,
      validationNotes: edition.validation_notes,
      scheduledPublishAt: edition.scheduled_publish_at,
      publishTimezone: edition.publish_timezone,
      entries: preview,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
