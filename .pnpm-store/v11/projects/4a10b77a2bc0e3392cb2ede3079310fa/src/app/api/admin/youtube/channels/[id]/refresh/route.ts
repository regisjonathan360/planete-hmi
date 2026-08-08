/**
 * POST /api/admin/youtube/channels/[id]/refresh
 * Rafraîchit les métadonnées d'une chaîne depuis l'API YouTube (K2).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { validateChannel } from "@/lib/youtube/api-client";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
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
    const supabase = createAdminClient();

    const { data: channel, error: fetchError } = await supabase
      .from("youtube_channels")
      .select("id, channel_id")
      .eq("id", idParsed.data)
      .maybeSingle();

    if (fetchError) {
      const safe = toSafeApiError(fetchError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!channel) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Chaîne introuvable." } },
        { status: 404 }
      );
    }

    // Appel API YouTube (K2)
    const info = await validateChannel(channel.channel_id as string);

    const { data: updated, error: updateError } = await supabase
      .from("youtube_channels")
      .update({
        channel_title: info.title,
        channel_handle: info.handle,
        thumbnail_url: info.thumbnailUrl,
        subscriber_count: info.subscriberCount,
        video_count: info.videoCount,
        uploads_playlist_id: info.uploadsPlaylistId,
        is_youtube_verified: true,
        last_scanned_at: new Date().toISOString(),
        last_scan_error: null,
      })
      .eq("id", idParsed.data)
      .select("id, channel_id, channel_title, subscriber_count, video_count")
      .single();

    if (updateError) {
      const safe = toSafeApiError(updateError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_channel_refresh",
      entityType: "youtube_channel",
      entityId: idParsed.data,
      newValue: { title: info.title, subscriberCount: info.subscriberCount },
    });

    return NextResponse.json({ channel: updated });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
