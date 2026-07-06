/** Modèles de lecture (JSON renvoyé par les fonctions Supabase). */
import { PlatformName } from "../types";

export interface ChartEntryView {
  filtered_position: number;
  source_position: number;
  movement: number | null;
  entry_status: string | null;
  metric_value: number | null;
  metric_unit: string | null;
  track_id: string;
  track_title: string;
  artists_text: string | null;
  artwork_url: string | null;
  platform_url: string | null;
  peak_filtered_position: number | null;
  weeks_on_chart: number | null;
  consecutive_weeks?: number | null;
}

export interface ChartEditionView {
  edition_id: string;
  period_start: string;
  period_end: string;
  published_at: string | null;
  source_updated_at: string | null;
  is_stale: boolean;
  entry_count: number;
}

export interface ChartOverviewRow {
  source_key: string;
  platform: PlatformName;
  display_name: string;
  chart_context: string | null;
  market_code: string | null;
  ingestion_mode: string;
  is_automatic: boolean;
  edition_id: string | null;
  period_start: string | null;
  period_end: string | null;
  published_at: string | null;
  source_updated_at: string | null;
  is_stale: boolean | null;
  entry_count: number | null;
  entries: ChartEntryView[];
}

export interface PlatformChart {
  source_key: string;
  platform: PlatformName;
  display_name: string;
  chart_context: string | null;
  market_code: string | null;
  ingestion_mode: string;
  is_automatic: boolean;
  edition: ChartEditionView | null;
  entries: ChartEntryView[];
}
