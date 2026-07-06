import { createClient } from "@/lib/supabase/server";
import { ChartOverviewRow } from "./types";

/**
 * Aperçu des 5 classements (une requête serveur agrégée, données publiées).
 * L'ordre est garanti par la fonction SQL (YouTube, Spotify, Audiomack,
 * Apple Music, TikTok).
 */
export async function getChartOverview(limit = 10): Promise<ChartOverviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_chart_overview", { p_limit: limit });
  if (error) throw new Error(`get_chart_overview: ${error.message}`);
  return (data as ChartOverviewRow[]) ?? [];
}
