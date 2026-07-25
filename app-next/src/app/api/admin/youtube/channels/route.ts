/**
 * GET  /api/admin/youtube/channels — Liste paginée des chaînes YouTube
 * POST /api/admin/youtube/channels — Ajout d'une nouvelle chaîne (validation K2)
 *
 * Correction K6 :
 * - Pagination validée par Zod (limit/offset obligatoires)
 * - Pas de select("*"), colonnes explicites
 * - Création cohérente : is_youtube_verified vient de K2, pas du client
 * - Pas d'approved_by/approved_at si status = pending_review
 * - Chaîne label/distributeur non rattachée automatiquement à un artiste
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { youtubeChannelInputSchema } from "@/lib/youtube/schemas";
import { validateChannel } from "@/lib/youtube/api-client";
import { channelListQuerySchema } from "@/lib/youtube/route-schemas";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const CHANNEL_COLUMNS = "id, channel_id, channel_title, channel_handle, channel_url, channel_type, uploads_playlist_id, thumbnail_url, subscriber_count, video_count, is_youtube_verified, is_active, status, artist_id, notes, approval_reason, approved_by, approved_at, last_scanned_at, created_at, updated_at";

const MULTI_ARTIST_TYPES = new Set(["LABEL_CHANNEL", "DISTRIBUTOR_CHANNEL", "COLLABORATOR_CHANNEL"]);

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
      channelType: url.searchParams.get("channelType") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    };

    const parsed = channelListQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres de requête invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { limit, offset, status, channelType, search } = parsed.data;
    const supabase = createAdminClient();

    let query = supabase
      .from("youtube_channels")
      .select(CHANNEL_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (channelType) query = query.eq("channel_type", channelType);
    if (search) query = query.ilike("channel_title", `%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    return NextResponse.json({ channels: data, total: count });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
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
    const parsed = youtubeChannelInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Données invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Validation YouTube via l'API (K2) — la vérification vient de YouTube, pas du client
    const channelInfo = await validateChannel(input.channelId);

    // Chaîne label/distributeur : ne pas rattacher d'artiste automatiquement
    const effectiveArtistId = MULTI_ARTIST_TYPES.has(input.channelType)
      ? null
      : input.artistId;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("youtube_channels")
      .insert({
        channel_id: input.channelId,
        channel_title: channelInfo.title, // utilise les métadonnées K2 vérifiées
        channel_handle: channelInfo.handle,
        channel_url: input.channelUrl,
        channel_type: input.channelType,
        uploads_playlist_id: channelInfo.uploadsPlaylistId,
        thumbnail_url: channelInfo.thumbnailUrl,
        subscriber_count: channelInfo.subscriberCount,
        video_count: channelInfo.videoCount,
        // Un retour valide de validateChannel prouve que l'identifiant est
        // résolu par YouTube. La valeur envoyée par le client est ignorée.
        is_youtube_verified: true,
        is_active: input.isActive,
        artist_id: effectiveArtistId,
        notes: input.notes,
        // Statut initial toujours pending_review — pas d'approved_by/approved_at
        status: "pending_review",
      })
      .select("id, channel_id, channel_title, status")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: { code: "conflict", message: "Cette chaîne YouTube est déjà enregistrée." } },
          { status: 409 }
        );
      }
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_channel_create",
      entityType: "youtube_channel",
      entityId: data.id,
      newValue: { channelId: input.channelId, channelTitle: channelInfo.title, channelType: input.channelType },
    });

    return NextResponse.json({ channel: data }, { status: 201 });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
