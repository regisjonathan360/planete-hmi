import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptTikTokToken,
  encryptTikTokToken,
} from "./token-crypto";
import {
  fetchTikTokUserProfile,
  getTikTokSyncMaxPages,
  listTikTokVideos,
  normalizeTikTokScopes,
  queryTikTokVideos,
  refreshTikTokAccessToken,
  TikTokUserApiError,
  type TikTokDisplayVideo,
} from "./user-api";

interface ConnectionRow {
  id: string;
  user_id: string;
  artist_id: string | null;
  scopes: string[];
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
}

export interface TikTokConnectionSyncResult {
  connectionId: string;
  ok: boolean;
  videosUpdated: number;
  truncated: boolean;
  error?: string;
}

function expiryFromNow(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function validAccessToken(connection: ConnectionRow): Promise<{
  accessToken: string;
  scopes: string[];
}> {
  const refreshThreshold = Date.now() + 5 * 60 * 1000;
  if (new Date(connection.access_token_expires_at).getTime() > refreshThreshold) {
    return {
      accessToken: decryptTikTokToken(connection.access_token_encrypted),
      scopes: connection.scopes,
    };
  }

  if (new Date(connection.refresh_token_expires_at).getTime() <= Date.now()) {
    throw new TikTokUserApiError(
      "L'autorisation TikTok a expire.",
      "invalid_grant",
      401
    );
  }

  const refreshed = await refreshTikTokAccessToken(
    decryptTikTokToken(connection.refresh_token_encrypted)
  );
  const scopes = normalizeTikTokScopes(refreshed.scope);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("artist_tiktok_connections")
    .update({
      scopes,
      access_token_encrypted: encryptTikTokToken(refreshed.access_token),
      refresh_token_encrypted: encryptTikTokToken(refreshed.refresh_token),
      access_token_expires_at: expiryFromNow(refreshed.expires_in),
      refresh_token_expires_at: expiryFromNow(refreshed.refresh_expires_in),
    })
    .eq("id", connection.id);

  if (error) throw new Error(`Sauvegarde du jeton renouvele impossible: ${error.message}`);
  return { accessToken: refreshed.access_token, scopes };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function videoRow(video: TikTokDisplayVideo, connection: ConnectionRow, now: string) {
  return {
    video_id: video.id,
    connection_id: connection.id,
    artist_id: connection.artist_id,
    title: video.title ?? null,
    video_description: video.video_description ?? null,
    create_time: new Date(video.create_time * 1000).toISOString(),
    cover_image_url: video.cover_image_url ?? null,
    share_url: video.share_url ?? null,
    embed_link: video.embed_link ?? null,
    duration_seconds: video.duration ?? null,
    width: video.width ?? null,
    height: video.height ?? null,
    view_count: video.view_count,
    like_count: video.like_count,
    comment_count: video.comment_count,
    share_count: video.share_count,
    is_available: true,
    last_synced_at: now,
  };
}

function utcDate(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

export async function syncTikTokConnection(
  connectionId: string
): Promise<TikTokConnectionSyncResult> {
  const supabase = createAdminClient();
  const { data, error: connectionError } = await supabase
    .from("artist_tiktok_connections")
    .select(
      "id, user_id, artist_id, scopes, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at"
    )
    .eq("id", connectionId)
    .single();

  if (connectionError || !data) {
    return {
      connectionId,
      ok: false,
      videosUpdated: 0,
      truncated: false,
      error: connectionError?.message ?? "Connexion TikTok introuvable.",
    };
  }

  const connection = data as ConnectionRow;

  try {
    const { accessToken, scopes } = await validAccessToken(connection);
    const profile = await fetchTikTokUserProfile(accessToken, scopes);
    const hasVideoScope = scopes.includes("video.list");
    const listed = hasVideoScope
      ? await listTikTokVideos(accessToken)
      : { videos: [], truncated: false };

    const videoMap = new Map(listed.videos.map((video) => [video.id, video]));

    if (hasVideoScope) {
      const refreshLimit = getTikTokSyncMaxPages() * 20;
      const { data: storedVideos, error: storedError } = await supabase
        .from("artist_tiktok_videos")
        .select("video_id")
        .eq("connection_id", connection.id)
        .order("create_time", { ascending: false })
        .limit(refreshLimit);
      if (storedError) throw new Error(storedError.message);

      const olderIds = (storedVideos ?? [])
        .map((video) => video.video_id as string)
        .filter((videoId) => !videoMap.has(videoId));

      for (const batch of chunks(olderIds, 20)) {
        const refreshedVideos = await queryTikTokVideos(accessToken, batch);
        for (const video of refreshedVideos) videoMap.set(video.id, video);

        const returnedIds = new Set(refreshedVideos.map((video) => video.id));
        const unavailableIds = batch.filter((videoId) => !returnedIds.has(videoId));
        if (unavailableIds.length > 0) {
          const { error: unavailableError } = await supabase
            .from("artist_tiktok_videos")
            .update({ is_available: false, last_synced_at: new Date().toISOString() })
            .in("video_id", unavailableIds)
            .eq("connection_id", connection.id);
          if (unavailableError) throw new Error(unavailableError.message);
        }
      }
    }

    const now = new Date().toISOString();
    const videos = Array.from(videoMap.values());
    if (videos.length > 0) {
      const { error: upsertError } = await supabase
        .from("artist_tiktok_videos")
        .upsert(videos.map((video) => videoRow(video, connection, now)), {
          onConflict: "video_id",
        });
      if (upsertError) throw new Error(upsertError.message);

      const { error: snapshotError } = await supabase
        .from("artist_tiktok_video_snapshots")
        .upsert(
          videos.map((video) => ({
            video_id: video.id,
            connection_id: connection.id,
            snapshot_date: utcDate(),
            view_count: video.view_count,
            like_count: video.like_count,
            comment_count: video.comment_count,
            share_count: video.share_count,
            observed_at: now,
          })),
          { onConflict: "video_id,snapshot_date" }
        );
      if (snapshotError) throw new Error(snapshotError.message);
    }

    const { error: profileError } = await supabase
      .from("artist_tiktok_connections")
      .update({
        tiktok_union_id: profile.union_id ?? null,
        username: profile.username ?? null,
        display_name: profile.display_name || "Artiste TikTok",
        avatar_url: profile.avatar_url ?? null,
        bio_description: profile.bio_description ?? null,
        profile_deep_link: profile.profile_deep_link ?? null,
        is_verified: profile.is_verified,
        follower_count: profile.follower_count,
        following_count: profile.following_count,
        likes_count: profile.likes_count,
        video_count: profile.video_count,
        scopes,
        status: "active",
        last_synced_at: now,
        last_sync_error: null,
      })
      .eq("id", connection.id);
    if (profileError) throw new Error(profileError.message);

    return {
      connectionId,
      ok: true,
      videosUpdated: videos.length,
      truncated: listed.truncated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisation impossible.";
    const status =
      error instanceof TikTokUserApiError && error.requiresReauthorization
        ? "reauthorization_required"
        : "error";

    await supabase
      .from("artist_tiktok_connections")
      .update({ status, last_sync_error: message })
      .eq("id", connection.id);

    return {
      connectionId,
      ok: false,
      videosUpdated: 0,
      truncated: false,
      error: message,
    };
  }
}

export async function syncAllTikTokConnections(): Promise<TikTokConnectionSyncResult[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("artist_tiktok_connections")
    .select("id")
    .in("status", ["active", "error"])
    .order("last_synced_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);

  const results: TikTokConnectionSyncResult[] = [];
  for (const connection of data ?? []) {
    results.push(await syncTikTokConnection(connection.id as string));
  }
  return results;
}
