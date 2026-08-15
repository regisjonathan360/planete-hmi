/**
 * GET /api/admin/radio/source-tracks
 * 
 * Retourne les pistes d'une source (chart ou playlist)
 * Paramètres:
 * - chartId: UUID de chart_edition (retourne entry_count pistes du classement)
 * - playlistId: UUID de radio_playlist (retourne tracks de la playlist)
 * 
 * Requires: admin role
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface TrackResponse {
  id: string;
  title: string;
  artist_name: string;
  artist_id?: string;
  audio_url: string;
  cover_image_url?: string;
  duration_seconds: number;
  source: string;
}

interface SourceTracksResponse {
  source_id: string;
  source_name: string;
  tracks: TrackResponse[];
}

export async function GET(request: Request): Promise<NextResponse> {
  // Vérifier que l'utilisateur est admin
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { 
        error: { 
          code: auth.status === 401 ? "unauthorized" : "forbidden", 
          message: auth.error 
        } 
      },
      { status: auth.status }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const chartId = searchParams.get("chartId");
    const playlistId = searchParams.get("playlistId");

    if (!chartId && !playlistId) {
      return NextResponse.json(
        { 
          error: { 
            code: "validation_error", 
            message: "Vous devez fournir chartId ou playlistId" 
          } 
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    let tracks: TrackResponse[] = [];
    let sourceName = "";
    let sourceId = "";

    // Cas 1 : Récupérer les pistes d'un chart (classement)
    if (chartId) {
      // Récupérer le chart et son nom
      const { data: chartData, error: chartError } = await supabase
        .from("chart_editions")
        .select(
          `
          id,
          chart_sources(id, display_name),
          chart_entries(
            id,
            track_id,
            ranked_position,
            filtered_position
          )
          `
        )
        .eq("id", chartId)
        .single();

      if (chartError) {
        console.error("Erreur lors de la récupération du chart:", chartError);
        return NextResponse.json(
          { 
            error: { 
              code: "database_error", 
              message: "Impossible de récupérer le classement" 
            } 
          },
          { status: 500 }
        );
      }

      if (!chartData) {
        return NextResponse.json(
          { 
            error: { 
              code: "not_found", 
              message: "Classement non trouvé" 
            } 
          },
          { status: 404 }
        );
      }

      sourceId = chartId;
      sourceName = Array.isArray(chartData.chart_sources) && chartData.chart_sources[0]
        ? chartData.chart_sources[0].display_name
        : "Classement";

      // Récupérer les tracks via les entries
      const trackIds = (chartData.chart_entries || []).map((entry: any) => entry.track_id);

      if (trackIds.length > 0) {
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
              external_url,
              external_id
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
          console.error("Erreur lors de la récupération des tracks:", tracksError);
          return NextResponse.json(
            { 
              error: { 
                code: "database_error", 
                message: "Impossible de récupérer les pistes du classement" 
              } 
            },
            { status: 500 }
          );
        }

        // Transformer les données
        tracks = (tracksData || []).map((track: any) => {
          // Récupérer l'audio URL depuis platform_tracks ou YouTube
          let audioUrl = "";
          
          if (track.platform_tracks && track.platform_tracks.length > 0) {
            audioUrl = track.platform_tracks[0].external_url || "";
          }
          
          if (!audioUrl && track.youtube_videos && track.youtube_videos.length > 0) {
            const youtube = track.youtube_videos.find((yt: any) => 
              yt.is_active && yt.review_status === "APPROVED"
            );
            if (youtube) {
              audioUrl = `https://www.youtube.com/watch?v=${youtube.video_id}`;
            }
          }

          // Récupérer l'artiste principal
          let artistName = "Artiste inconnu";
          let artistId = undefined;

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
          };
        });
      }
    }

    // Cas 2 : Récupérer les pistes d'une playlist
    if (playlistId) {
      // Récupérer la playlist
      const { data: playlistData, error: playlistError } = await supabase
        .from("radio_playlists")
        .select("id, name")
        .eq("id", playlistId)
        .single();

      if (playlistError) {
        console.error("Erreur lors de la récupération de la playlist:", playlistError);
        return NextResponse.json(
          { 
            error: { 
              code: "database_error", 
              message: "Impossible de récupérer la playlist" 
            } 
          },
          { status: 500 }
        );
      }

      if (!playlistData) {
        return NextResponse.json(
          { 
            error: { 
              code: "not_found", 
              message: "Playlist non trouvée" 
            } 
          },
          { status: 404 }
        );
      }

      sourceId = playlistId;
      sourceName = playlistData.name;

      // Récupérer les tracks de la playlist
      const { data: playlistTracksData, error: playlistTracksError } = await supabase
        .from("radio_playlist_tracks")
        .select(
          `
          id,
          track_position,
          radio_tracks(
            id,
            title,
            artist_name,
            artist_id,
            audio_url,
            cover_image_url,
            duration_seconds,
            source
          )
          `
        )
        .eq("playlist_id", playlistId)
        .order("track_position", { ascending: true });

      if (playlistTracksError) {
        console.error("Erreur lors de la récupération des pistes:", playlistTracksError);
        return NextResponse.json(
          { 
            error: { 
              code: "database_error", 
              message: "Impossible de récupérer les pistes de la playlist" 
            } 
          },
          { status: 500 }
        );
      }

      tracks = (playlistTracksData || [])
        .filter((pt: any) => pt.radio_tracks)
        .map((pt: any) => pt.radio_tracks);
    }

    const response: SourceTracksResponse = {
      source_id: sourceId,
      source_name: sourceName,
      tracks,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Erreur non gérée:", err);
    return NextResponse.json(
      { 
        error: { 
          code: "internal_error", 
          message: "Une erreur interne s'est produite" 
        } 
      },
      { status: 500 }
    );
  }
}
