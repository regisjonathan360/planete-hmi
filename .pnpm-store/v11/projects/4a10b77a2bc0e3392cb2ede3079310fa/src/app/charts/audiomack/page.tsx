import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";
import { AudiomackMultiChartTabs } from "./AudiomackMultiChartTabs";

export const revalidate = 3600; // ISR: 1 hour

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudiomackChartEntry {
  position: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  platformUrl: string | null;
  artistSlug: string | null;
  trackSlug: string | null;
  movement: number | null;
  entryStatus: string | null;
  contributions?: Array<{
    genreId: string;
    genreLabel: string;
    sourcePosition: number;
  }>;
}

export interface AudiomackGenreTab {
  key: string;
  label: string;
  genreId: string;
  updatedAt: string | null;
  entryCount: number;
  entries: AudiomackChartEntry[];
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getAudiomackCharts(): Promise<{
  composite: AudiomackGenreTab | null;
  genres: AudiomackGenreTab[];
}> {
  const supabase = await createClient();

  // Fetch all enabled audiomack sources
  const { data: sources } = await supabase
    .from("chart_sources")
    .select("id, source_key, genre_id, display_name, is_composite_source, display_order")
    .eq("platform", "audiomack")
    .eq("is_enabled", true)
    .order("display_order", { ascending: true });

  if (!sources || sources.length === 0) {
    return { composite: null, genres: [] };
  }

  const compositeSrc = sources.find((s) => s.is_composite_source);
  const genreSources = sources.filter((s) => !s.is_composite_source);

  async function fetchEdition(sourceId: string, sourceKey: string, label: string, genreId: string): Promise<AudiomackGenreTab | null> {
    // Find latest published edition
    const { data: editions } = await supabase
      .from("chart_editions")
      .select("id, period_start, period_end, published_at, entry_count")
      .eq("chart_source_id", sourceId)
      .eq("status", "published")
      .order("period_end", { ascending: false })
      .limit(1);

    if (!editions || editions.length === 0) return null;
    const edition = editions[0];

    // Fetch entries (top 20)
    const { data: entries } = await supabase
      .from("chart_entries")
      .select(`
        id,
        source_position,
        filtered_position,
        raw_track_title,
        raw_artist_text,
        metric_value,
        movement,
        entry_status,
        platform_tracks (
          external_url,
          artwork_url
        ),
        tracks (
          default_artwork_url
        )
      `)
      .eq("chart_edition_id", edition.id)
      .order("source_position", { ascending: true })
      .limit(20);

    // If composite, also fetch contributions
    let contributions: Map<string, Array<{ genreId: string; genreLabel: string; sourcePosition: number }>> | null = null;
    if (genreId === "composite") {
      const entryIds = (entries ?? []).map((e) => e.id);
      if (entryIds.length > 0) {
        const { data: contribs } = await supabase
          .from("composite_contributions")
          .select("composite_entry_id, genre_id, source_position")
          .in("composite_entry_id", entryIds);

        if (contribs) {
          contributions = new Map();
          for (const c of contribs) {
            const list = contributions.get(c.composite_entry_id) ?? [];
            // Get genre label from genreSources
            const src = genreSources.find((s) => s.genre_id === c.genre_id);
            list.push({
              genreId: c.genre_id,
              genreLabel: src?.display_name ?? c.genre_id,
              sourcePosition: c.source_position,
            });
            contributions.set(c.composite_entry_id, list);
          }
        }
      }
    }

    const chartEntries: AudiomackChartEntry[] = (entries ?? []).map((e, i) => {
      const pt = e.platform_tracks as unknown as { external_url: string | null; artwork_url: string | null } | null;
      const track = e.tracks as unknown as { default_artwork_url: string | null } | null;

      // Extract slugs from URL
      let artistSlug: string | null = null;
      let trackSlug: string | null = null;
      const url = pt?.external_url;
      if (url) {
        const match = url.match(/audiomack\.com\/([^/]+)\/song\/([^/?#]+)/i);
        if (match) {
          artistSlug = match[1].toLowerCase();
          trackSlug = match[2].toLowerCase();
        }
      }

      return {
        position: e.filtered_position ?? i + 1,
        title: e.raw_track_title ?? "Titre inconnu",
        artist: e.raw_artist_text ?? "Artiste inconnu",
        artworkUrl: pt?.artwork_url ?? track?.default_artwork_url ?? null,
        platformUrl: pt?.external_url ?? null,
        artistSlug,
        trackSlug,
        movement: e.movement ?? null,
        entryStatus: e.entry_status ?? null,
        contributions: contributions?.get(e.id) ?? undefined,
      };
    });

    return {
      key: sourceKey,
      label,
      genreId,
      updatedAt: edition.published_at ?? edition.period_end,
      entryCount: chartEntries.length,
      entries: chartEntries,
    };
  }

  // Fetch composite
  let composite: AudiomackGenreTab | null = null;
  if (compositeSrc) {
    composite = await fetchEdition(compositeSrc.id, compositeSrc.source_key, "Best Of", "composite");
  }

  // Fetch genres
  const genreTabs: AudiomackGenreTab[] = [];
  for (const src of genreSources) {
    const tab = await fetchEdition(src.id, src.source_key, src.display_name, src.genre_id);
    // Include even null tabs to show empty state
    genreTabs.push(tab ?? {
      key: src.source_key,
      label: src.display_name,
      genreId: src.genre_id,
      updatedAt: null,
      entryCount: 0,
      entries: [],
    });
  }

  return { composite, genres: genreTabs };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AudiomackChartsPage() {
  const { composite, genres } = await getAudiomackCharts();

  const hasAnyData = composite || genres.some((g) => g.entries.length > 0);

  return (
    <>
      <p className="hmi__meta">
        <Link className="row__top20" href="/charts">← Tous les classements</Link>
      </p>

      <h1 className="hmi__title">Classements Audiomack Haiti</h1>
      <p className="hmi__meta">
        Classement composite multi-genres et classements individuels par genre musical.
      </p>

      {!hasAnyData ? (
        <ChartEmptyState message="Aucun classement Audiomack publié pour le moment." />
      ) : (
        <AudiomackMultiChartTabs composite={composite} genres={genres} />
      )}
    </>
  );
}
