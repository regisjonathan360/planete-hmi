/**
 * Chargement des données du panneau admin d'un classement issu d'une playlist.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminChartData } from "./queries";
import type { AdminChartData } from "./types";
import type { PlaylistChartSource, PlaylistSourceState } from "../playlist-sources";

export interface PlaylistPanelData {
  source: PlaylistChartSource;
  /** null tant qu'aucune collecte n'a créé d'édition. */
  chart: AdminChartData | null;
  /** null tant que la source n'existe pas en base. */
  state: PlaylistSourceState | null;
  loadError: string | null;
}

export async function loadPlaylistPanelData(
  supabase: SupabaseClient,
  source: PlaylistChartSource,
): Promise<PlaylistPanelData> {
  let chart: AdminChartData | null = null;
  let loadError: string | null = null;

  try {
    chart = await getAdminChartData(supabase, source.sourceKey);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Erreur de chargement du classement.";
  }

  const { data: row } = await supabase
    .from("chart_sources")
    .select(
      "source_key, display_name, chart_context, source_url, is_enabled, ingestion_mode, last_success_at, last_failure_at, last_error",
    )
    .eq("source_key", source.sourceKey)
    .maybeSingle();

  const state: PlaylistSourceState | null = row
    ? {
        sourceKey: row.source_key as string,
        displayName: row.display_name as string,
        chartContext: (row.chart_context as string) ?? null,
        playlistUrl: (row.source_url as string) ?? null,
        isEnabled: !!row.is_enabled,
        ingestionMode: (row.ingestion_mode as string) ?? null,
        lastSuccessAt: (row.last_success_at as string) ?? null,
        lastFailureAt: (row.last_failure_at as string) ?? null,
        lastError: (row.last_error as string) ?? null,
      }
    : null;

  return { source, chart, state, loadError };
}
