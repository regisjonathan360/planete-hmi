/**
 * GET /api/admin/radio/available-sources-public
 * 
 * DEBUG VERSION - No auth required!
 * Retourne les sources disponibles pour la configuration radio
 * 
 * REMOVE THIS AFTER TESTING - Use available-sources for production
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createAdminClient();

    console.log("[DEBUG] Fetching charts...");
    
    // 1. Récupérer les classements
    const { data: chartsData, error: chartsError } = await supabase
      .from("chart_editions")
      .select(
        `
        id,
        entry_count,
        status,
        chart_sources(
          id,
          display_name,
          platform
        )
        `
      )
      .eq("status", "published")
      .order("period_start", { ascending: false });

    console.log("[DEBUG] Charts error:", chartsError?.message ?? "none");
    console.log("[DEBUG] Charts count:", chartsData?.length ?? 0);

    if (chartsError) {
      return NextResponse.json(
        { 
          error: `Charts error: ${chartsError.message}`,
          details: chartsError
        },
        { status: 500 }
      );
    }

    const charts = (chartsData || [])
      .filter((edition: any) => edition.chart_sources && edition.chart_sources.length > 0)
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

    console.log("[DEBUG] Fetching sources...");

    // 2. Récupérer les sources de collecte
    const { data: sourcesData, error: sourcesError } = await supabase
      .from("chart_sources")
      .select(
        `
        id,
        source_key,
        display_name,
        platform,
        is_enabled
        `
      )
      .eq("is_enabled", true)
      .order("display_name", { ascending: true });

    console.log("[DEBUG] Sources error:", sourcesError?.message ?? "none");
    console.log("[DEBUG] Sources count:", sourcesData?.length ?? 0);

    if (sourcesError) {
      return NextResponse.json(
        { 
          error: `Sources error: ${sourcesError.message}`,
          details: sourcesError
        },
        { status: 500 }
      );
    }

    // 3. Récupérer les playlists
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

    console.log("[DEBUG] Playlists error:", playlistsError?.message ?? "none");
    console.log("[DEBUG] Playlists count:", playlistsData?.length ?? 0);

    if (playlistsError) {
      return NextResponse.json(
        { 
          error: `Playlists error: ${playlistsError.message}`,
          details: playlistsError
        },
        { status: 500 }
      );
    }

    const sources = [];

    if (sourcesData) {
      for (const source of sourcesData as any[]) {
        sources.push({
          id: source.id,
          name: source.display_name,
          track_count: 0,
          type: source.platform,
        });
      }
    }

    if (playlistsData) {
      for (const playlist of playlistsData as any[]) {
        sources.push({
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          track_count: 0,
          type: "manual",
        });
      }
    }

    return NextResponse.json({
      charts,
      sources,
      debug: {
        charts_count: charts.length,
        sources_count: sources.length,
        playlists_count: playlistsData?.length ?? 0,
      },
    });
  } catch (err: any) {
    console.error("[DEBUG] Error:", err);
    return NextResponse.json(
      { 
        error: err.message,
        stack: err.stack
      },
      { status: 500 }
    );
  }
}
