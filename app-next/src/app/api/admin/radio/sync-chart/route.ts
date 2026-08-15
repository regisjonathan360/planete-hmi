/**
 * POST /api/admin/radio/sync-chart
 *
 * Matérialise un classement (chart_edition) en playlist radio :
 * 1. Upsert des pistes du classement dans radio_tracks (id = track.id, idempotent)
 * 2. Création ou réutilisation d'une playlist radio dédiée au classement
 * 3. Remplissage de radio_playlist_tracks dans l'ordre du classement
 * 4. Activation de la playlist dans radio_config
 *
 * Requires: admin role
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const syncChartSchema = z.object({
  chartId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "chartId doit être un UUID"
    ),
});

export async function POST(request: Request): Promise<NextResponse> {
  // Vérifier que l'utilisateur est admin
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: {
          code: auth.status === 401 ? "unauthorized" : "forbidden",
          message: auth.error,
        },
      },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json();
    const parsed = syncChartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "chartId (UUID) est requis",
          },
        },
        { status: 400 }
      );
    }

    const { chartId } = parsed.data;
    const supabase = createAdminClient();

    // 1. Récupérer le classement et sa source
    const { data: chartData, error: chartError } = await supabase
      .from("chart_editions")
      .select("id, chart_sources(id, display_name, platform)")
      .eq("id", chartId)
      .single();

    if (chartError || !chartData) {
      return NextResponse.json(
        {
          error: {
            code: "not_found",
            message: "Classement non trouvé",
          },
        },
        { status: 404 }
      );
    }

    const chartSource = Array.isArray(chartData.chart_sources)
      ? chartData.chart_sources[0]
      : chartData.chart_sources;
    const chartName = chartSource?.display_name || "Classement";

    // 2. Récupérer les entrées du classement dans l'ordre
    const { data: entries, error: entriesError } = await supabase
      .from("chart_entries")
      .select("track_id, source_position")
      .eq("chart_edition_id", chartId)
      .order("source_position", { ascending: true });

    if (entriesError) {
      console.error("Erreur chart_entries:", entriesError);
      throw new Error("Erreur lors de la récupération des entrées du classement");
    }

    const trackIds = (entries || [])
      .map((entry: any) => entry.track_id)
      .filter(Boolean);

    if (trackIds.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "empty_chart",
            message: "Le classement ne contient aucune piste",
          },
        },
        { status: 400 }
      );
    }

    // 3. Récupérer les tracks du classement
    const { data: tracksData, error: tracksError } = await supabase
      .from("tracks")
      .select(
        `
        id,
        title,
        duration_ms,
        default_artwork_url,
        track_artists(
          artist_id,
          artists(id, name)
        ),
        platform_tracks(
          id,
          platform,
          external_url
        ),
        youtube_videos(
          id,
          video_id,
          is_active,
          review_status
        )
        `
      )
      .in("id", trackIds);

    if (tracksError) {
      console.error("Erreur tracks:", tracksError);
      throw new Error("Erreur lors de la récupération des pistes");
    }

    // 4. Upsert dans radio_tracks (id = track.id pour l'idempotence)
    const radioTracks = (tracksData || []).map((track: any) => {
      let audioUrl = "";

      if (track.platform_tracks && track.platform_tracks.length > 0) {
        audioUrl = track.platform_tracks[0].external_url || "";
      }

      if (!audioUrl && track.youtube_videos && track.youtube_videos.length > 0) {
        const youtube = track.youtube_videos.find(
          (yt: any) => yt.is_active && yt.review_status === "APPROVED"
        );
        if (youtube) {
          audioUrl = `https://www.youtube.com/watch?v=${youtube.video_id}`;
        }
      }

      let artistName = "Artiste inconnu";
      let artistId: string | null = null;

      if (track.track_artists && track.track_artists.length > 0) {
        const primary = track.track_artists.find((ta: any) => ta.role === "primary");
        const artist = (primary || track.track_artists[0])?.artists;
        if (artist) {
          artistName = artist.name;
          artistId = artist.id;
        }
      }

      return {
        id: track.id,
        title: track.title,
        artist_name: artistName,
        artist_id: artistId,
        audio_url: audioUrl,
        cover_image_url: track.default_artwork_url,
        duration_seconds: Math.floor((track.duration_ms || 0) / 1000),
        source: "chart",
        source_id: chartId,
        is_active: true,
      };
    });

    const { error: upsertError } = await supabase
      .from("radio_tracks")
      .upsert(radioTracks, { onConflict: "id" });

    if (upsertError) {
      console.error("Erreur upsert radio_tracks:", upsertError);
      throw new Error("Erreur lors de la synchronisation des pistes");
    }

    // 5. Créer ou réutiliser la playlist dédiée au classement
    const playlistName = `Chart - ${chartName}`;
    let playlistId: string;

    const { data: existingPlaylist } = await supabase
      .from("radio_playlists")
      .select("id")
      .eq("name", playlistName)
      .maybeSingle();

    if (existingPlaylist) {
      playlistId = existingPlaylist.id;
    } else {
      const { data: newPlaylist, error: createError } = await supabase
        .from("radio_playlists")
        .insert({
          name: playlistName,
          description: `Synchronisée automatiquement depuis le classement ${chartName}`,
          is_active: true,
          shuffle_enabled: false,
          repeat_enabled: true,
        })
        .select("id")
        .single();

      if (createError || !newPlaylist) {
        console.error("Erreur création playlist:", createError);
        throw new Error("Erreur lors de la création de la playlist");
      }

      playlistId = newPlaylist.id;
    }

    // 6. Remplacer les entrées de la playlist (ordre du classement)
    await supabase
      .from("radio_playlist_tracks")
      .delete()
      .eq("playlist_id", playlistId);

    const positionByTrackId = new Map(
      (entries || []).map((entry: any, index: number) => [
        entry.track_id,
        index + 1,
      ])
    );

    const playlistTracks = radioTracks
      .filter((track: any) => track.audio_url)
      .map((track: any) => ({
        playlist_id: playlistId,
        track_id: track.id,
        track_position: positionByTrackId.get(track.id) || 0,
      }));

    const { error: insertError } = await supabase
      .from("radio_playlist_tracks")
      .insert(playlistTracks);

    if (insertError) {
      console.error("Erreur insertion playlist_tracks:", insertError);
      throw new Error("Erreur lors de l'ajout des pistes à la playlist");
    }

    // 7. Activer la playlist dans la config radio
    const { data: configRow } = await supabase
      .from("radio_config")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (configRow) {
      await supabase
        .from("radio_config")
        .update({
          active_playlist_id: playlistId,
          auto_switch_to_chart: false,
          chart_source_key: chartId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", configRow.id);
    }

    return NextResponse.json({
      success: true,
      playlistId,
      playlistName,
      tracksAdded: playlistTracks.length,
      message: `${playlistTracks.length} pistes du classement "${chartName}" ajoutées à la radio`,
    });
  } catch (err: any) {
    console.error("Erreur non gérée:", err);
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: err.message || "Une erreur interne s'est produite",
        },
      },
      { status: 500 }
    );
  }
}