/**
 * Composite Builder — Audiomack Multi-Chart Ranking
 *
 * Builds a composite ranking by fusing multiple published genre editions
 * using weighted inverse-position scoring.
 *
 * Formula: score = Σ (weight × (101 − position))
 * Tiebreaker: genreCount desc, then bestPosition asc
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CompositeContribution {
  sourceKey: string;
  genreId: string;
  genreLabel: string;
  sourcePosition: number;
  weight: number;
  contribution: number; // weight × (101 − position)
}

export interface CompositeEntry {
  trackId: string;
  platformTrackId: string | null;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  sourceTrackUrl: string | null;
  artistSlug: string | null;
  trackSlug: string | null;
  compositeScore: number;
  genreCount: number;
  bestPosition: number;
  contributions: CompositeContribution[];
}

export interface CompositeConfig {
  maxEntries: number; // default 20
}

const DEFAULT_CONFIG: CompositeConfig = {
  maxEntries: 20,
};

/**
 * Build composite ranking from published genre editions.
 * Formula: score = Σ (weight × (101 − position))
 * Tiebreaker: genreCount desc, then bestPosition asc
 * Only includes sources with published edition AND weight > 0
 */
export async function buildComposite(
  supabase: SupabaseClient,
  config?: Partial<CompositeConfig>
): Promise<{ entries: CompositeEntry[]; warnings: string[] }> {
  const { maxEntries } = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];

  // 1. Query chart_sources where platform='audiomack' AND is_enabled=true AND weight > 0 AND is_composite_source = false
  const { data: sources, error: sourcesError } = await supabase
    .from("chart_sources")
    .select("id, source_key, genre_id, display_name, weight")
    .eq("platform", "audiomack")
    .eq("is_enabled", true)
    .eq("is_composite_source", false)
    .gt("weight", 0);

  if (sourcesError) {
    throw new Error(`Failed to fetch chart sources: ${sourcesError.message}`);
  }

  if (!sources || sources.length === 0) {
    warnings.push("Aucune source de genre avec poids > 0 trouvée.");
    return { entries: [], warnings };
  }

  // 2. For each source, find the latest chart_editions with status='published'
  const trackScores = new Map<
    string,
    {
      trackId: string;
      platformTrackId: string | null;
      title: string;
      artistName: string;
      artworkUrl: string | null;
      sourceTrackUrl: string | null;
      artistSlug: string | null;
      trackSlug: string | null;
      contributions: CompositeContribution[];
    }
  >();

  let publishedSourceCount = 0;

  for (const source of sources) {
    // Find latest published edition for this source
    const { data: editions, error: editionError } = await supabase
      .from("chart_editions")
      .select("id")
      .eq("chart_source_id", source.id)
      .eq("status", "published")
      .order("period_end", { ascending: false })
      .limit(1);

    if (editionError) {
      warnings.push(
        `Erreur lors de la récupération de l'édition pour ${source.source_key}: ${editionError.message}`
      );
      continue;
    }

    if (!editions || editions.length === 0) {
      warnings.push(
        `Aucune édition publiée pour ${source.source_key} — source exclue du calcul.`
      );
      continue;
    }

    publishedSourceCount++;
    const editionId = editions[0].id;

    // 3. For each published edition, fetch chart_entries with their track info
    const { data: entries, error: entriesError } = await supabase
      .from("chart_entries")
      .select(
        `
        id,
        track_id,
        platform_track_id,
        source_position,
        raw_track_title,
        raw_artist_text,
        tracks!inner (
          id,
          title,
          default_artwork_url
        ),
        platform_tracks (
          external_url,
          artwork_url
        )
      `
      )
      .eq("chart_edition_id", editionId)
      .order("source_position", { ascending: true });

    if (entriesError) {
      warnings.push(
        `Erreur lors de la récupération des entrées pour ${source.source_key}: ${entriesError.message}`
      );
      continue;
    }

    if (!entries || entries.length === 0) continue;

    // 4. Accumulate scores per track
    const weight = Number(source.weight) || 1.0;

    for (const entry of entries) {
      const trackId = entry.track_id;
      const position = entry.source_position;
      const contribution = weight * (101 - position);

      // Extract track info
      const track = entry.tracks as unknown as {
        id: string;
        title: string;
        default_artwork_url: string | null;
      };
      const platformTrack = entry.platform_tracks as unknown as {
        external_url: string | null;
        artwork_url: string | null;
      } | null;

      const sourceTrackUrl = platformTrack?.external_url ?? null;

      // Extract slugs from source URL
      let artistSlug: string | null = null;
      let trackSlug: string | null = null;
      if (sourceTrackUrl) {
        const slugMatch = sourceTrackUrl.match(
          /audiomack\.com\/([^/]+)\/song\/([^/?#]+)/i
        );
        if (slugMatch) {
          artistSlug = slugMatch[1].toLowerCase();
          trackSlug = slugMatch[2].toLowerCase();
        }
      }

      const contributionEntry: CompositeContribution = {
        sourceKey: source.source_key,
        genreId: source.genre_id,
        genreLabel: source.display_name,
        sourcePosition: position,
        weight,
        contribution,
      };

      if (trackScores.has(trackId)) {
        const existing = trackScores.get(trackId)!;
        existing.contributions.push(contributionEntry);
        // Update artwork/url if we have better data
        if (!existing.artworkUrl && (platformTrack?.artwork_url || track.default_artwork_url)) {
          existing.artworkUrl = platformTrack?.artwork_url || track.default_artwork_url;
        }
        if (!existing.sourceTrackUrl && sourceTrackUrl) {
          existing.sourceTrackUrl = sourceTrackUrl;
        }
        if (!existing.artistSlug && artistSlug) {
          existing.artistSlug = artistSlug;
        }
        if (!existing.trackSlug && trackSlug) {
          existing.trackSlug = trackSlug;
        }
      } else {
        trackScores.set(trackId, {
          trackId,
          platformTrackId: entry.platform_track_id,
          title: entry.raw_track_title || track.title,
          artistName: entry.raw_artist_text || "",
          artworkUrl:
            platformTrack?.artwork_url || track.default_artwork_url || null,
          sourceTrackUrl,
          artistSlug,
          trackSlug,
          contributions: [contributionEntry],
        });
      }
    }
  }

  if (publishedSourceCount < 3) {
    warnings.push(
      `Seulement ${publishedSourceCount} source(s) publiée(s) — le classement composite peut manquer de représentativité.`
    );
  }

  // 5. Sort by score DESC, then genre_count DESC, then best_position ASC
  const compositeEntries: CompositeEntry[] = Array.from(
    trackScores.values()
  ).map((track) => {
    const compositeScore = track.contributions.reduce(
      (sum, c) => sum + c.contribution,
      0
    );
    const genreCount = track.contributions.length;
    const bestPosition = Math.min(
      ...track.contributions.map((c) => c.sourcePosition)
    );

    return {
      ...track,
      compositeScore,
      genreCount,
      bestPosition,
    };
  });

  compositeEntries.sort((a, b) => {
    // Score DESC
    if (b.compositeScore !== a.compositeScore) {
      return b.compositeScore - a.compositeScore;
    }
    // Genre count DESC
    if (b.genreCount !== a.genreCount) {
      return b.genreCount - a.genreCount;
    }
    // Best position ASC
    return a.bestPosition - b.bestPosition;
  });

  // 6. Return top maxEntries
  return {
    entries: compositeEntries.slice(0, maxEntries),
    warnings,
  };
}

/**
 * Save composite as a draft edition under source_key = 'audiomack_haiti_composite'
 */
export async function saveCompositeEdition(
  supabase: SupabaseClient,
  entries: CompositeEntry[],
  options: { periodStart: string; periodEnd: string }
): Promise<{ editionId: string }> {
  const COMPOSITE_SOURCE_KEY = "audiomack_haiti_composite";

  // Ensure composite source exists
  const { data: sourceData, error: sourceError } = await supabase
    .from("chart_sources")
    .select("id")
    .eq("source_key", COMPOSITE_SOURCE_KEY)
    .maybeSingle();

  if (sourceError) {
    throw new Error(
      `Failed to fetch composite source: ${sourceError.message}`
    );
  }

  let sourceId: string;
  if (sourceData?.id) {
    sourceId = sourceData.id;
  } else {
    // Create composite source if it doesn't exist
    const { data: newSource, error: createError } = await supabase
      .from("chart_sources")
      .insert({
        platform: "audiomack",
        source_key: COMPOSITE_SOURCE_KEY,
        display_name: "Best Of Audiomack Haiti (Composite)",
        chart_context: "Classement composite multi-genres Audiomack Haiti",
        market_code: "HT",
        genre_id: "composite",
        ingestion_mode: "COMPUTED",
        source_url: "https://audiomack.com/top/songs?country=haiti",
        is_enabled: true,
        is_automatic: false,
        is_composite_source: true,
        weight: 0,
      })
      .select("id")
      .single();

    if (createError || !newSource) {
      throw new Error(
        `Failed to create composite source: ${createError?.message ?? "no data"}`
      );
    }
    sourceId = newSource.id;
  }

  const editionKey = `audiomack-haiti-composite-${options.periodEnd.slice(0, 10)}`;

  // Check for existing edition in same period
  const { data: existingEdition } = await supabase
    .from("chart_editions")
    .select("id")
    .eq("chart_source_id", sourceId)
    .eq("period_start", options.periodStart)
    .eq("period_end", options.periodEnd)
    .maybeSingle();

  let editionId: string;

  if (existingEdition?.id) {
    editionId = existingEdition.id;
    // Clear existing entries
    await supabase
      .from("chart_entries")
      .delete()
      .eq("chart_edition_id", editionId);
    // Update edition
    await supabase
      .from("chart_editions")
      .update({
        edition_key: editionKey,
        collected_at: new Date().toISOString(),
        status: "draft",
        is_stale: false,
        entry_count: entries.length,
        validation_notes: "Classement composite calculé — en attente de validation.",
      })
      .eq("id", editionId);
  } else {
    const { data: newEdition, error: editionError } = await supabase
      .from("chart_editions")
      .insert({
        chart_source_id: sourceId,
        edition_key: editionKey,
        period_start: options.periodStart,
        period_end: options.periodEnd,
        collected_at: new Date().toISOString(),
        status: "draft",
        is_stale: false,
        entry_count: entries.length,
        validation_notes: "Classement composite calculé — en attente de validation.",
      })
      .select("id")
      .single();

    if (editionError || !newEdition) {
      throw new Error(
        `Failed to create composite edition: ${editionError?.message ?? "no data"}`
      );
    }
    editionId = newEdition.id;
  }

  // Insert composite entries
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    const { data: chartEntry, error: entryError } = await supabase
      .from("chart_entries")
      .insert({
        chart_edition_id: editionId,
        track_id: entry.trackId,
        platform_track_id: entry.platformTrackId,
        source_position: i + 1,
        raw_track_title: entry.title,
        raw_artist_text: entry.artistName,
        metric_value: entry.compositeScore,
        metric_unit: "composite_score",
        score_composite: entry.compositeScore,
      })
      .select("id")
      .single();

    if (entryError || !chartEntry) {
      throw new Error(
        `Failed to insert composite entry: ${entryError?.message ?? "no data"}`
      );
    }

    // Store contributions in composite_contributions table
    for (const contrib of entry.contributions) {
      await supabase.from("composite_contributions").insert({
        composite_entry_id: chartEntry.id,
        source_key: contrib.sourceKey,
        genre_id: contrib.genreId,
        source_position: contrib.sourcePosition,
        weight: contrib.weight,
        contribution: contrib.contribution,
      });
    }
  }

  return { editionId };
}
