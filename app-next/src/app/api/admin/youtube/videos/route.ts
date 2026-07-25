/**
 * GET /api/admin/youtube/videos
 * Liste paginée des vidéos YouTube avec filtrage validé par Zod.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { videoListQuerySchema } from "@/lib/youtube/route-schemas";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const VIDEO_COLUMNS = "id, video_id, channel_id, source_title, source_thumbnail_url, published_at, duration_seconds, video_type, review_status, is_eligible, is_active, display_title, display_thumbnail_url, track_id, view_count, like_count, comment_count, created_at, updated_at";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const url = new URL(request.url);
    const queryInput = {
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      channelId: url.searchParams.get("channelId") ?? undefined,
      internalChannelId: url.searchParams.get("internalChannelId") ?? undefined,
      eligible: url.searchParams.get("eligible") ?? undefined,
      videoType: url.searchParams.get("videoType") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    };

    const parsed = videoListQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres de requête invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { limit, offset, status, channelId, internalChannelId, eligible, videoType, search } = parsed.data;
    const supabase = createAdminClient();

    let query = supabase
      .from("youtube_videos")
      .select(VIDEO_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("review_status", status);
    if (channelId && internalChannelId) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "channelId et internalChannelId ne peuvent pas être utilisés simultanément." } },
        { status: 400 }
      );
    }
    if (channelId) query = query.eq("channel_id", channelId);
    if (internalChannelId) {
      // Resolve internal UUID to channel_id text
      const { data: ch, error: chErr } = await supabase.from("youtube_channels").select("channel_id").eq("id", internalChannelId).maybeSingle();
      if (chErr) {
        const safe = toSafeApiError(chErr);
        return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
      }
      if (!ch) {
        return NextResponse.json(
          { error: { code: "not_found", message: "Chaîne interne introuvable." } },
          { status: 404 }
        );
      }
      query = query.eq("channel_id", ch.channel_id as string);
    }
    if (eligible === "true") query = query.eq("is_eligible", true);
    else if (eligible === "false") query = query.eq("is_eligible", false);
    if (videoType) query = query.eq("video_type", videoType);
    if (search) query = query.ilike("source_title", `%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    return NextResponse.json({ videos: data, total: count });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
