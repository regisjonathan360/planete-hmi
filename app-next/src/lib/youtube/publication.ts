import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { YOUTUBE_HMI_SOURCE_KEY } from "./constants";

export const YOUTUBE_CHART_METHODOLOGY =
  "Top YouTube HMI — nouvelles vues mondiales hebdomadaires agrégées par chanson, vidéos officielles approuvées, Shorts exclus.";

export interface PublicationMaterial {
  payload: Record<string, unknown>;
  editableState: Array<Record<string, unknown>>;
}

export async function buildYouTubePublication(
  supabase: SupabaseClient,
  editionId: string
): Promise<PublicationMaterial> {
  const { data: edition, error: editionError } = await supabase
    .from("chart_editions")
    .select("id, chart_source_id, period_start, period_end, source_updated_at, status, chart_sources!inner(source_key, platform, display_name, chart_context, market_code, ingestion_mode, is_automatic)")
    .eq("id", editionId)
    .eq("chart_sources.source_key", YOUTUBE_HMI_SOURCE_KEY)
    .maybeSingle();
  if (editionError) throw editionError;
  if (!edition) throw new Error("edition_not_found");

  const { data: entries, error: entriesError } = await supabase
    .from("chart_entries")
    .select("id, track_id, source_position, filtered_position, movement, entry_status, metric_value, metric_unit, delta_views, delta_likes, delta_comments, total_views, eligible_video_count, raw_track_title, raw_artist_text, is_hidden, is_excluded, admin_position, display_title, display_artist, display_artwork_url, display_url, exclusion_reason, tracks(title, release_date, artwork_url, track_artists(artists(name)))")
    .eq("chart_edition_id", editionId)
    .order("filtered_position", { ascending: true });
  if (entriesError) throw entriesError;

  const visible = (entries ?? [])
    .filter((entry) => !entry.is_hidden && !entry.is_excluded)
    .sort((a, b) => {
      const aPosition = (a.admin_position as number | null) ?? (a.source_position as number);
      const bPosition = (b.admin_position as number | null) ?? (b.source_position as number);
      return aPosition - bPosition;
    });
  const publicEntries = visible.map((entry, index) => {
    const track = entry.tracks as unknown as {
      title?: string;
      artwork_url?: string | null;
      track_artists?: Array<{ artists?: { name?: string } | null }>;
    } | null;
    const artists = track?.track_artists
      ?.map((item) => item.artists?.name)
      .filter(Boolean)
      .join(", ");
    return {
      filtered_position: index + 1,
      source_position: entry.source_position,
      movement: entry.movement,
      entry_status: entry.entry_status ?? "new",
      metric_value: entry.metric_value,
      metric_unit: entry.metric_unit ?? "views",
      delta_views: entry.delta_views,
      delta_likes: entry.delta_likes,
      delta_comments: entry.delta_comments,
      total_views: entry.total_views,
      eligible_video_count: entry.eligible_video_count,
      track_id: entry.track_id,
      track_title: entry.display_title ?? track?.title ?? entry.raw_track_title,
      artists_text: entry.display_artist ?? artists ?? entry.raw_artist_text,
      artwork_url: entry.display_artwork_url ?? track?.artwork_url ?? null,
      platform_url: entry.display_url ?? null,
    };
  });

  const source = edition.chart_sources as unknown as {
    source_key: string; platform: string; display_name: string;
    chart_context: string | null; market_code: string | null;
    ingestion_mode: string; is_automatic: boolean;
  };
  const now = new Date().toISOString();
  return {
    payload: {
      source_key: source.source_key,
      platform: source.platform,
      display_name: source.display_name,
      chart_context: source.chart_context,
      market_code: source.market_code,
      ingestion_mode: source.ingestion_mode,
      is_automatic: source.is_automatic,
      methodology: YOUTUBE_CHART_METHODOLOGY,
      edition: {
        edition_id: edition.id,
        period_start: edition.period_start,
        period_end: edition.period_end,
        published_at: now,
        source_updated_at: edition.source_updated_at,
        is_stale: false,
        entry_count: publicEntries.length,
      },
      entries: publicEntries,
    },
    editableState: (entries ?? []).map((entry) => ({
      entryId: entry.id,
      trackId: entry.track_id,
      adminPosition: entry.admin_position,
      isHidden: entry.is_hidden,
      isExcluded: entry.is_excluded,
      exclusionReason: entry.exclusion_reason,
      displayTitle: entry.display_title,
      displayArtist: entry.display_artist,
      displayArtworkUrl: entry.display_artwork_url,
      displayUrl: entry.display_url,
    })),
  };
}
