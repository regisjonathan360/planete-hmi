/**
 * API route pour synchroniser les vidéos YouTube vers la radio
 * POST /api/admin/radio/sync - Synchronise le top YouTube vers la radio
 */
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const syncSchema = z.object({
  playlistName: z.string().default("Top YouTube"),
  limit: z.number().int().min(10).max(100).default(50),
  videoTypes: z.array(z.string()).default([
    "OFFICIAL_MUSIC_VIDEO",
    "OFFICIAL_AUDIO",
    "OFFICIAL_LYRIC_VIDEO",
    "OFFICIAL_VISUALIZER",
    "SHORT",
  ]),
});

export async function POST(request: Request) {
  await ensureAdmin();
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { playlistName, limit, videoTypes } = syncSchema.parse(body);

    // 1. Synchroniser les vidéos YouTube vers radio_tracks
    const { error: syncError } = await supabase.rpc("sync_youtube_to_radio", {
      p_video_types: videoTypes,
    });

    if (syncError) {
      console.error("Error syncing YouTube to radio:", syncError);
      throw new Error("Erreur lors de la synchronisation des vidéos");
    }

    // 2. Créer ou récupérer la playlist
    let playlistId: string;
    const { data: existingPlaylist } = await supabase
      .from("radio_playlists")
      .select("id")
      .eq("name", playlistName)
      .single();

    if (existingPlaylist) {
      playlistId = existingPlaylist.id;
    } else {
      const { data: newPlaylist, error: createError } = await supabase
        .from("radio_playlists")
        .insert({
          name: playlistName,
          description: "Synchronisée automatiquement depuis YouTube",
          is_active: true,
          shuffle_enabled: false,
          repeat_enabled: true,
        })
        .select("id")
        .single();

      if (createError || !newPlaylist) {
        throw new Error("Erreur lors de la création de la playlist");
      }

      playlistId = newPlaylist.id;
    }

    // 3. Supprimer les anciennes entrées de la playlist
    await supabase
      .from("radio_playlist_tracks")
      .delete()
      .eq("playlist_id", playlistId);

    // 4. Récupérer les top vidéos YouTube
    const { data: topVideos, error: videosError } = await supabase
      .from("youtube_videos")
      .select(`
        id,
        video_id,
        source_title,
        display_title,
        view_count
      `)
      .eq("review_status", "APPROVED")
      .eq("is_eligible", true)
      .eq("is_active", true)
      .in("video_type", videoTypes)
      .order("view_count", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);

    if (videosError || !topVideos) {
      throw new Error("Erreur lors de la récupération des vidéos");
    }

    // 5. Insérer dans la playlist
    const playlistTracks = topVideos.map((video, index) => ({
      playlist_id: playlistId,
      track_id: video.id,
      track_position: index + 1,
    }));

    const { error: insertError } = await supabase
      .from("radio_playlist_tracks")
      .insert(playlistTracks);

    if (insertError) {
      throw new Error("Erreur lors de l'ajout des pistes à la playlist");
    }

    // 6. Statistiques
    const { count: trackCount } = await supabase
      .from("radio_tracks")
      .select("*", { count: "exact", head: true })
      .eq("source", "youtube")
      .eq("is_active", true);

    return NextResponse.json({
      success: true,
      playlistId,
      playlistName,
      tracksAdded: topVideos.length,
      totalYoutubeTracks: trackCount || 0,
      message: `${topVideos.length} pistes synchronisées dans "${playlistName}"`,
    });
  } catch (error: any) {
    console.error("Error in radio sync:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la synchronisation" },
      { status: 500 }
    );
  }
}

// GET pour vérifier l'état de la synchronisation
export async function GET() {
  await ensureAdmin();
  const supabase = await createClient();

  const [youtubeVideos, radioTracks, playlists] = await Promise.all([
    supabase
      .from("youtube_videos")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "APPROVED")
      .eq("is_eligible", true)
      .eq("is_active", true),
    supabase
      .from("radio_tracks")
      .select("*", { count: "exact", head: true })
      .eq("source", "youtube")
      .eq("is_active", true),
    supabase
      .from("radio_playlists")
      .select(`
        id,
        name,
        track_count:radio_playlist_tracks(count)
      `)
      .eq("name", "Top YouTube")
      .single(),
  ]);

  return NextResponse.json({
    youtubeVideosEligible: youtubeVideos.count || 0,
    radioTracksFromYoutube: radioTracks.count || 0,
    topYoutubePlaylist: playlists.data || null,
  });
}
