/**
 * GET /api/charts/audiomack — Données publiques du classement Audiomack multi-genres.
 *
 * Retourne :
 * - composite: le dernier classement composite publié (Top 20 + contributions)
 * - genres: les dernières éditions publiées par genre activé (Top 20 chacune)
 *
 * Pas d'authentification requise.
 * Cache ISR compatible (revalidation 1h).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // cache 1h

const MAX_ENTRIES_PER_CHART = 20;
const COMPOSITE_SOURCE_KEY = "audiomack_haiti_composite";

export async function GET() {
  const supabase = await createClient();

  // 1. Fetch the latest published composite edition
  const composite = await fetchLatestPublishedEdition(
    supabase,
    COMPOSITE_SOURCE_KEY,
    true // include contributions
  );

  // 2. Fetch all enabled genre sources (non-composite)
  const { data: genreSources, error: sourcesError } = await supabase
    .from("chart_sources")
    .select("id, source_key, genre_id, display_name, display_order")
    .eq("platform", "audiomack")
    .eq("is_enabled", true)
    .eq("is_composite_source", false)
    .order("display_order", { ascending: true });

  if (sourcesError) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des sources." },
      { status: 500 }
    );
  }

  // 3. Fetch latest published edition per genre
  const genres = [];
  for (const source of genreSources ?? []) {
    const genreEdition = await fetchLatestPublishedEdition(
      supabase,
      source.source_key,
      false // no contributions for genre editions
    );
    genres.push({
      sourceKey: source.source_key,
      genreId: source.genre_id,
      genreLabel: source.display_name,
      displayOrder: source.display_order,
      edition: genreEdition,
    });
  }

  return NextResponse.json({
    composite,
    genres,
  });
}

// ---------------------------------------------------------------------------
// Helper — fetch latest published edition for a source_key
// ---------------------------------------------------------------------------
async function fetchLatestPublishedEdition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceKey: string,
  includeContributions: boolean
) {
  // Get source
  const { data: source } = await supabase
    .from("chart_sources")
    .select("id, source_key, genre_id, display_name")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (!source) return null;

  // Get latest published edition
  const { data: edition } = await supabase
    .from("chart_editions")
    .select("id, period_start, period_end, collected_at, status, entry_count")
    .eq("chart_source_id", source.id)
    .eq("status", "published")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!edition) return null;

  // Fetch entries (top 20)
  const { data: entries } = await supabase
    .from("chart_entries")
    .select(
      `
      id,
      source_position,
      raw_track_title,
      raw_artist_text,
      score_composite,
      score_stats,
      platform_tracks (
        external_url,
        artwork_url
      ),
      tracks (
        id,
        title,
        default_artwork_url
      )
    `
    )
    .eq("chart_edition_id", edition.id)
    .order("source_position", { ascending: true })
    .limit(MAX_ENTRIES_PER_CHART);

  // Optionally load contributions for composite
  let contributionsMap: Map<string, unknown[]> | null = null;
  if (includeContributions && entries && entries.length > 0) {
    const entryIds = entries.map((e) => e.id);
    const { data: contributions } = await supabase
      .from("composite_contributions")
      .select("composite_entry_id, source_key, genre_id, source_position, weight, contribution")
      .in("composite_entry_id", entryIds);

    if (contributions) {
      contributionsMap = new Map();
      for (const c of contributions) {
        const list = contributionsMap.get(c.composite_entry_id) ?? [];
        list.push({
          sourceKey: c.source_key,
          genreId: c.genre_id,
          sourcePosition: c.source_position,
          weight: c.weight,
          contribution: c.contribution,
        });
        contributionsMap.set(c.composite_entry_id, list);
      }
    }
  }

  // Format entries for response
  const formattedEntries = (entries ?? []).map((entry, index) => {
    const platformTrack = entry.platform_tracks as unknown as {
      external_url: string | null;
      artwork_url: string | null;
    } | null;
    const track = entry.tracks as unknown as {
      id: string;
      title: string;
      default_artwork_url: string | null;
    } | null;

    return {
      position: index + 1,
      title: entry.raw_track_title || track?.title || "Sans titre",
      artistName: entry.raw_artist_text || "",
      artworkUrl: platformTrack?.artwork_url || track?.default_artwork_url || null,
      sourceTrackUrl: platformTrack?.external_url || null,
      scoreComposite: entry.score_composite,
      scoreStats: entry.score_stats,
      ...(contributionsMap
        ? { contributions: contributionsMap.get(entry.id) ?? [] }
        : {}),
    };
  });

  return {
    sourceKey,
    genreId: source.genre_id,
    genreLabel: source.display_name,
    editionId: edition.id,
    periodStart: edition.period_start,
    periodEnd: edition.period_end,
    collectedAt: edition.collected_at,
    entryCount: formattedEntries.length,
    entries: formattedEntries,
  };
}
