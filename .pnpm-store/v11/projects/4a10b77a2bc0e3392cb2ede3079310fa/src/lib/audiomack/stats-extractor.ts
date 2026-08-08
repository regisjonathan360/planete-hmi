/**
 * Stats Extractor — Audiomack Multi-Chart Ranking
 *
 * Extracts real statistics (plays, likes, reposts, comments) from
 * Audiomack track pages by parsing HTML content.
 *
 * Features:
 * - Single track extraction from page HTML
 * - Batch extraction with 2s delay and progress tracking
 * - Fault tolerance: individual failures don't abort the batch
 * - Early stop after 10 consecutive failures
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TrackStats {
  plays: number;
  likes: number;
  reposts: number;
  comments: number;
  extractedAt: string;
  success: boolean;
  error?: string;
}

export interface StatsExtractionProgress {
  total: number;
  completed: number;
  failed: number;
  currentTrack: string | null;
}

const MAX_CONSECUTIVE_FAILURES = 10;
const DELAY_BETWEEN_REQUESTS_MS = 2000;
const FETCH_TIMEOUT_MS = 10000;

/**
 * Parse a number string that may contain K/M suffixes or comma separators.
 * Examples: "1,234", "1.2K", "3.5M", "123"
 */
function parseStatNumber(raw: string): number {
  if (!raw) return 0;

  const cleaned = raw.trim().replace(/,/g, "");

  // Handle K/M suffixes
  const suffixMatch = cleaned.match(/^([\d.]+)\s*([KkMm])?$/);
  if (!suffixMatch) return 0;

  let value = parseFloat(suffixMatch[1]);
  if (isNaN(value)) return 0;

  const suffix = suffixMatch[2]?.toUpperCase();
  if (suffix === "K") value *= 1000;
  if (suffix === "M") value *= 1000000;

  return Math.round(value);
}

/**
 * Extract stats from HTML content of an Audiomack track page.
 * Looks for patterns containing play count, likes, reposts, and comments.
 */
function parseStatsFromHtml(html: string): {
  plays: number;
  likes: number;
  reposts: number;
  comments: number;
} {
  let plays = 0;
  let likes = 0;
  let reposts = 0;
  let comments = 0;

  // Strategy 1: Look for JSON-LD or structured data
  const jsonLdMatch = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      const jsonContent = match.replace(
        /<script[^>]*>|<\/script>/gi,
        ""
      );
      try {
        const data = JSON.parse(jsonContent);
        if (data.interactionStatistic) {
          for (const stat of Array.isArray(data.interactionStatistic)
            ? data.interactionStatistic
            : [data.interactionStatistic]) {
            const type = stat.interactionType?.["@type"] || stat.interactionType;
            const value = parseInt(stat.userInteractionCount, 10) || 0;
            if (type?.includes("Listen") || type?.includes("Play")) {
              plays = value;
            } else if (type?.includes("Like")) {
              likes = value;
            } else if (type?.includes("Share") || type?.includes("Repost")) {
              reposts = value;
            } else if (type?.includes("Comment")) {
              comments = value;
            }
          }
        }
      } catch {
        // JSON parse failed, continue to other strategies
      }
    }
  }

  // Strategy 2: Look for __NEXT_DATA__ or similar embedded JSON
  if (plays === 0) {
    const nextDataMatch = html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        const songData =
          data?.props?.pageProps?.song ||
          data?.props?.pageProps?.music;
        if (songData) {
          plays = parseInt(songData.plays, 10) || parseInt(songData.play_count, 10) || 0;
          likes = parseInt(songData.favorites, 10) || parseInt(songData.likes, 10) || 0;
          reposts = parseInt(songData.reposts, 10) || parseInt(songData.repost_count, 10) || 0;
          comments = parseInt(songData.comment_count, 10) || parseInt(songData.comments, 10) || 0;
        }
      } catch {
        // Parse failed
      }
    }
  }

  // Strategy 3: Look for common patterns in the HTML
  if (plays === 0) {
    // Plays: often near "plays" text or in a stat container
    const playsPatterns = [
      /(?:data-plays|plays|play_count|playCount)['":\s]*['"]*(\d[\d,KkMm.]*)/i,
      /"plays"\s*:\s*"?(\d[\d,KkMm.]*)(?:"|\s|,)/i,
      /class="[^"]*plays[^"]*"[^>]*>[\s]*(?:<[^>]+>)*\s*([\d,KkMm.]+)/i,
    ];
    for (const pattern of playsPatterns) {
      const match = html.match(pattern);
      if (match) {
        plays = parseStatNumber(match[1]);
        if (plays > 0) break;
      }
    }
  }

  if (likes === 0) {
    const likesPatterns = [
      /(?:data-favorites|favorites|likes|like_count|favoriteCount)['":\s]*['"]*(\d[\d,KkMm.]*)/i,
      /"(?:favorites|likes)"\s*:\s*"?(\d[\d,KkMm.]*)(?:"|\s|,)/i,
    ];
    for (const pattern of likesPatterns) {
      const match = html.match(pattern);
      if (match) {
        likes = parseStatNumber(match[1]);
        if (likes > 0) break;
      }
    }
  }

  if (reposts === 0) {
    const repostPatterns = [
      /(?:data-reposts|reposts|repost_count|repostCount)['":\s]*['"]*(\d[\d,KkMm.]*)/i,
      /"reposts"\s*:\s*"?(\d[\d,KkMm.]*)(?:"|\s|,)/i,
    ];
    for (const pattern of repostPatterns) {
      const match = html.match(pattern);
      if (match) {
        reposts = parseStatNumber(match[1]);
        if (reposts > 0) break;
      }
    }
  }

  if (comments === 0) {
    const commentPatterns = [
      /(?:data-comments|comment_count|comments|commentCount)['":\s]*['"]*(\d[\d,KkMm.]*)/i,
      /"comment(?:_count|s)"\s*:\s*"?(\d[\d,KkMm.]*)(?:"|\s|,)/i,
    ];
    for (const pattern of commentPatterns) {
      const match = html.match(pattern);
      if (match) {
        comments = parseStatNumber(match[1]);
        if (comments > 0) break;
      }
    }
  }

  return { plays, likes, reposts, comments };
}

/**
 * Extract stats from an Audiomack track page HTML.
 * Looks for: play count, like count, repost count, comment count.
 */
export async function extractTrackStats(
  trackUrl: string
): Promise<TrackStats> {
  const extractedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );

    const response = await fetch(trackUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          plays: 0,
          likes: 0,
          reposts: 0,
          comments: 0,
          extractedAt,
          success: false,
          error: `Track page not found (404): ${trackUrl}`,
        };
      }
      return {
        plays: 0,
        likes: 0,
        reposts: 0,
        comments: 0,
        extractedAt,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const stats = parseStatsFromHtml(html);

    return {
      ...stats,
      extractedAt,
      success: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return {
      plays: 0,
      likes: 0,
      reposts: 0,
      comments: 0,
      extractedAt,
      success: false,
      error: message.includes("abort")
        ? `Timeout after ${FETCH_TIMEOUT_MS}ms: ${trackUrl}`
        : message,
    };
  }
}

/**
 * Helper: wait for specified milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build an Audiomack track URL from artist and track slugs.
 */
function buildTrackUrl(artistSlug: string, trackSlug: string): string {
  return `https://audiomack.com/${artistSlug}/song/${trackSlug}`;
}

/**
 * Batch extraction with 2s delay, progress tracking, and fault tolerance.
 * Stops early after 10 consecutive failures.
 */
export async function extractEditionStats(
  supabase: SupabaseClient,
  editionId: string,
  onProgress?: (progress: StatsExtractionProgress) => void
): Promise<{ extracted: number; failed: number }> {
  // Fetch all entries in the edition with their track/platform info
  const { data: entries, error: entriesError } = await supabase
    .from("chart_entries")
    .select(
      `
      id,
      track_id,
      raw_track_title,
      raw_artist_text,
      platform_tracks (
        external_url
      )
    `
    )
    .eq("chart_edition_id", editionId)
    .order("source_position", { ascending: true });

  if (entriesError) {
    throw new Error(
      `Failed to fetch entries for edition ${editionId}: ${entriesError.message}`
    );
  }

  if (!entries || entries.length === 0) {
    return { extracted: 0, failed: 0 };
  }

  const total = entries.length;
  let extracted = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const trackTitle = entry.raw_track_title || "Unknown";

    // Report progress
    onProgress?.({
      total,
      completed: extracted + failed,
      failed,
      currentTrack: trackTitle,
    });

    // Build track URL from platform_tracks external_url
    const platformTrack = entry.platform_tracks as unknown as {
      external_url: string | null;
    } | null;
    const externalUrl = platformTrack?.external_url;

    let trackUrl: string | null = null;
    if (externalUrl) {
      // Extract slugs from the external URL to build the track page URL
      const slugMatch = externalUrl.match(
        /audiomack\.com\/([^/]+)\/song\/([^/?#]+)/i
      );
      if (slugMatch) {
        trackUrl = buildTrackUrl(slugMatch[1], slugMatch[2]);
      } else {
        trackUrl = externalUrl;
      }
    }

    if (!trackUrl) {
      // Mark as unavailable — no URL to extract from
      await supabase
        .from("chart_entries")
        .update({
          stats_status: "unavailable",
          stats_extracted_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      failed++;
      consecutiveFailures++;

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        break;
      }
      continue;
    }

    // Extract stats from the track page
    const stats = await extractTrackStats(trackUrl);

    if (stats.success) {
      // Upsert metrics into chart_entry_metrics
      const metrics = [
        { type: "plays", value: stats.plays },
        { type: "likes", value: stats.likes },
        { type: "reposts", value: stats.reposts },
        { type: "comments", value: stats.comments },
      ];

      for (const metric of metrics) {
        await supabase.from("chart_entry_metrics").upsert(
          {
            chart_entry_id: entry.id,
            metric_type: metric.type,
            metric_value: metric.value,
            extracted_at: stats.extractedAt,
          },
          { onConflict: "chart_entry_id,metric_type" }
        );
      }

      // Update entry status
      await supabase
        .from("chart_entries")
        .update({
          stats_status: "extracted",
          stats_extracted_at: stats.extractedAt,
        })
        .eq("id", entry.id);

      extracted++;
      consecutiveFailures = 0;
    } else {
      // Mark as failed
      const status = stats.error?.includes("404") ? "unavailable" : "failed";
      await supabase
        .from("chart_entries")
        .update({
          stats_status: status,
          stats_extracted_at: stats.extractedAt,
        })
        .eq("id", entry.id);

      failed++;
      consecutiveFailures++;

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        break;
      }
    }

    // Rate limiting: 2s delay between requests (skip after last)
    if (i < entries.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  // Final progress report
  onProgress?.({
    total,
    completed: extracted + failed,
    failed,
    currentTrack: null,
  });

  return { extracted, failed };
}
