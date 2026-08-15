/**
 * GET /api/admin/radio/available-sources
 * 
 * Retourne les sources disponibles pour la configuration radio :
 * 1. Les classements (chart_editions) avec leur nombre de chansons
 * 2. Les sources de collecte (playlists manuelles, sources YouTube/Spotify/etc)
 * 
 * Requires: admin role
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface ChartResponse {
  id: string;
  name: string;
  track_count: number;
  platform: string;
}

interface SourceResponse {
  id: string;
  name: string;
  description?: string;
  track_count: number;
  type: string;
}

interface AvailableSourcesResponse {
  charts: ChartResponse[];
  sources: SourceResponse[];
}

export async function GET(): Promise<NextResponse> {
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
    const supabase = createAdminClient();

    // 1. Récupérer les classements (chart_editions) avec le nombre de chansons
    const { data: chartsData, error: chartsError } = await supabase
      .from("chart_editions")
      .select(
        `
        id,
        entry_count,
        status,
        period_start,
        period_end,
        chart_sources(
          id,
          display_name,
          platform
        )
        `
      )
      .eq("status", "published")
      .order("period_start", { ascending: false });

    if (chartsError) {
      console.error("Erreur lors de la récupération des classements:", chartsError);
      return NextResponse.json(
        { 
          error: { 
            code: "database_error", 
            message: "Impossible de récupérer les classements" 
          } 
        },
        { status: 500 }
      );
    }

    // Transformer les données des classements
    const charts: ChartResponse[] = (chartsData || [])
      .filter((edition: any) => {
        const cs = edition.chart_sources;
        return cs && (Array.isArray(cs) ? cs.length > 0 : true);
      })
      .map((edition: any) => {
        const chartSource = Array.isArray(edition.chart_sources) 
          ? edition.chart_sources[0] 
          : edition.chart_sources;
        
        return {
          id: edition.id,
          name: chartSource?.display_name || "Classement sans nom",
          track_count: edition.entry_count || 0,
          platform: chartSource?.platform || "unknown",
        };
      });

    // 2. Récupérer les playlists manuelles
    const { data: playlistsData, error: playlistsError } = await supabase
      .from("radio_playlists")
      .select(
        `
        id,
        name,
        description,
        is_active
        `
      )
      .order("name", { ascending: true });

    if (playlistsError) {
      console.error("Erreur lors de la récupération des playlists:", playlistsError);
      return NextResponse.json(
        { 
          error: { 
            code: "database_error", 
            message: "Impossible de récupérer les playlists" 
          } 
        },
        { status: 500 }
      );
    }

    // 3. Récupérer le nombre de chansons par playlist
    const playlistIds = (playlistsData || []).map((p: any) => p.id);
    
    const playlistTrackCounts: Record<string, number> = {};
    
    if (playlistIds.length > 0) {
      const { data: trackCountsData, error: trackCountsError } = await supabase
        .from("radio_playlist_tracks")
        .select("playlist_id", { count: "exact" })
        .in("playlist_id", playlistIds);

      if (!trackCountsError && trackCountsData) {
        // Compter les pistes par playlist
        for (const track of trackCountsData as any[]) {
          playlistTrackCounts[track.playlist_id] = (playlistTrackCounts[track.playlist_id] || 0) + 1;
        }
      }
    }

    // Transformer les sources (uniquement les playlists manuelles)
    // NB : les chart_sources (plateformes) ne sont PAS des sources jouables
    // directement — seule la relation playlist -> source-tracks existe.
    const sources: SourceResponse[] = [];

    // Ajouter les playlists manuelles
    if (playlistsData) {
      for (const playlist of playlistsData as any[]) {
        sources.push({
          id: playlist.id,
          name: playlist.name,
          description: playlist.description || undefined,
          track_count: playlistTrackCounts[playlist.id] || 0,
          type: "manual",
        });
      }
    }

    const response: AvailableSourcesResponse = {
      charts,
      sources,
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
