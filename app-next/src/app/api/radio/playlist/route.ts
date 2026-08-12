/**
 * API route pour récupérer la playlist active de la radio
 * GET /api/radio/playlist
 */
import { NextResponse } from "next/server";
import { getActivePlaylist, getChartTracks, getRadioConfig } from "@/lib/radio/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getRadioConfig();

    if (!config) {
      return NextResponse.json(
        { error: "Configuration de la radio non trouvée" },
        { status: 404 }
      );
    }

    // Si mode "auto chart" activé, récupérer les pistes du classement
    if (config.auto_switch_to_chart && config.chart_source_key) {
      const chartTracks = await getChartTracks(config.chart_source_key);
      
      return NextResponse.json({
        type: "chart",
        chart_key: config.chart_source_key,
        tracks: chartTracks,
        config: {
          preloadCount: config.preload_count,
          crossfadeDuration: config.crossfade_duration_ms,
        },
      });
    }

    // Sinon, récupérer la playlist manuelle active
    const { playlist, tracks } = await getActivePlaylist();

    if (!playlist) {
      return NextResponse.json(
        { error: "Aucune playlist active" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      type: "playlist",
      playlist,
      tracks,
      config: {
        preloadCount: config.preload_count,
        crossfadeDuration: config.crossfade_duration_ms,
      },
    });
  } catch (error) {
    console.error("Error fetching radio playlist:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la playlist" },
      { status: 500 }
    );
  }
}
