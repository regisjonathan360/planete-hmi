/**
 * Reclassification Engine — Audiomack Multi-Chart Ranking
 *
 * Recalculates chart entry positions based on extracted statistics
 * (plays, likes, reposts) using configurable coefficients.
 *
 * Formula: Score_Stats = (plays × c_plays) + (likes × c_likes) + (reposts × c_reposts)
 *
 * Entries with stats are sorted by Score_Stats DESC.
 * Entries without stats retain their original order and are placed after.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReclassificationCoefficients {
  plays: number; // default 1.0
  likes: number; // default 5.0
  reposts: number; // default 3.0
}

export interface ReclassificationPreview {
  entries: Array<{
    entryId: string;
    trackTitle: string;
    artistName: string;
    originalPosition: number;
    newPosition: number;
    positionChange: number;
    scoreStats: number;
    hasStats: boolean;
  }>;
  affectedCount: number;
  unchangedCount: number;
}

export const DEFAULT_COEFFICIENTS: ReclassificationCoefficients = {
  plays: 1.0,
  likes: 5.0,
  reposts: 3.0,
};

/**
 * Compute Score_Stats = (plays × c_plays) + (likes × c_likes) + (reposts × c_reposts)
 */
export function computeScoreStats(
  metrics: { plays: number; likes: number; reposts: number },
  coefficients: ReclassificationCoefficients
): number {
  return (
    metrics.plays * coefficients.plays +
    metrics.likes * coefficients.likes +
    metrics.reposts * coefficients.reposts
  );
}

/**
 * Fetch entries and their metrics for an edition, compute new positions.
 * Returns the ordered entries with position comparisons.
 */
async function computeReclassifiedOrder(
  supabase: SupabaseClient,
  editionId: string,
  coefficients: ReclassificationCoefficients
): Promise<
  Array<{
    entryId: string;
    trackTitle: string;
    artistName: string;
    originalPosition: number;
    newPosition: number;
    scoreStats: number;
    hasStats: boolean;
  }>
> {
  // Fetch all entries for the edition
  const { data: entries, error: entriesError } = await supabase
    .from("chart_entries")
    .select("id, source_position, raw_track_title, raw_artist_text, stats_status")
    .eq("chart_edition_id", editionId)
    .order("source_position", { ascending: true });

  if (entriesError) {
    throw new Error(
      `Failed to fetch entries for edition ${editionId}: ${entriesError.message}`
    );
  }

  if (!entries || entries.length === 0) {
    return [];
  }

  // Fetch metrics for all entries in this edition
  const entryIds = entries.map((e) => e.id);
  const { data: metrics, error: metricsError } = await supabase
    .from("chart_entry_metrics")
    .select("chart_entry_id, metric_type, metric_value")
    .in("chart_entry_id", entryIds);

  if (metricsError) {
    throw new Error(
      `Failed to fetch metrics for edition ${editionId}: ${metricsError.message}`
    );
  }

  // Group metrics by entry
  const metricsMap = new Map<
    string,
    { plays: number; likes: number; reposts: number }
  >();
  if (metrics) {
    for (const m of metrics) {
      if (!metricsMap.has(m.chart_entry_id)) {
        metricsMap.set(m.chart_entry_id, { plays: 0, likes: 0, reposts: 0 });
      }
      const entryMetrics = metricsMap.get(m.chart_entry_id)!;
      if (m.metric_type === "plays") entryMetrics.plays = Number(m.metric_value);
      if (m.metric_type === "likes") entryMetrics.likes = Number(m.metric_value);
      if (m.metric_type === "reposts")
        entryMetrics.reposts = Number(m.metric_value);
    }
  }

  // Separate entries with stats and without
  const withStats: Array<{
    entryId: string;
    trackTitle: string;
    artistName: string;
    originalPosition: number;
    scoreStats: number;
    hasStats: boolean;
  }> = [];
  const withoutStats: Array<{
    entryId: string;
    trackTitle: string;
    artistName: string;
    originalPosition: number;
    scoreStats: number;
    hasStats: boolean;
  }> = [];

  for (const entry of entries) {
    const entryMetrics = metricsMap.get(entry.id);
    const hasStats = entry.stats_status === "extracted" && !!entryMetrics;

    const scoreStats = hasStats
      ? computeScoreStats(entryMetrics!, coefficients)
      : 0;

    const item = {
      entryId: entry.id,
      trackTitle: entry.raw_track_title || "Unknown",
      artistName: entry.raw_artist_text || "Unknown",
      originalPosition: entry.source_position,
      scoreStats,
      hasStats,
    };

    if (hasStats) {
      withStats.push(item);
    } else {
      withoutStats.push(item);
    }
  }

  // Sort entries with stats by Score_Stats DESC
  withStats.sort((a, b) => b.scoreStats - a.scoreStats);

  // Entries without stats keep their original order (already sorted by source_position)
  withoutStats.sort((a, b) => a.originalPosition - b.originalPosition);

  // Combine: entries with stats first, then entries without
  const combined = [...withStats, ...withoutStats];

  // Assign new positions
  return combined.map((item, index) => ({
    ...item,
    newPosition: index + 1,
  }));
}

/**
 * Preview reclassification without applying (returns before/after).
 */
export async function previewReclassification(
  supabase: SupabaseClient,
  editionId: string,
  coefficients: ReclassificationCoefficients
): Promise<ReclassificationPreview> {
  const reclassified = await computeReclassifiedOrder(
    supabase,
    editionId,
    coefficients
  );

  let affectedCount = 0;
  let unchangedCount = 0;

  const entries = reclassified.map((entry) => {
    const positionChange = entry.originalPosition - entry.newPosition;
    if (positionChange !== 0) {
      affectedCount++;
    } else {
      unchangedCount++;
    }
    return {
      entryId: entry.entryId,
      trackTitle: entry.trackTitle,
      artistName: entry.artistName,
      originalPosition: entry.originalPosition,
      newPosition: entry.newPosition,
      positionChange,
      scoreStats: entry.scoreStats,
      hasStats: entry.hasStats,
    };
  });

  return {
    entries,
    affectedCount,
    unchangedCount,
  };
}

/**
 * Apply reclassification: update source_positions and store history.
 */
export async function applyReclassification(
  supabase: SupabaseClient,
  editionId: string,
  coefficients: ReclassificationCoefficients,
  appliedBy?: string
): Promise<{ historyId: string }> {
  const reclassified = await computeReclassifiedOrder(
    supabase,
    editionId,
    coefficients
  );

  if (reclassified.length === 0) {
    throw new Error("No entries found for reclassification.");
  }

  // Store current order as previous_order
  const previousOrder = reclassified
    .sort((a, b) => a.originalPosition - b.originalPosition)
    .map((e) => e.entryId);

  // Compute new order
  const newOrder = [...reclassified]
    .sort((a, b) => a.newPosition - b.newPosition)
    .map((e) => e.entryId);

  // Update source_position for each entry
  for (const entry of reclassified) {
    await supabase
      .from("chart_entries")
      .update({
        source_position: entry.newPosition,
        score_stats: entry.scoreStats,
      })
      .eq("id", entry.entryId);
  }

  // Store reclassification history
  const { data: history, error: historyError } = await supabase
    .from("reclassification_history")
    .insert({
      chart_edition_id: editionId,
      applied_at: new Date().toISOString(),
      applied_by: appliedBy ?? null,
      coefficients: {
        plays: coefficients.plays,
        likes: coefficients.likes,
        reposts: coefficients.reposts,
      },
      previous_order: previousOrder,
      new_order: newOrder,
    })
    .select("id")
    .single();

  if (historyError || !history) {
    throw new Error(
      `Failed to store reclassification history: ${historyError?.message ?? "no data"}`
    );
  }

  return { historyId: history.id };
}
