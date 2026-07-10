import { createClient } from "@/lib/supabase/server";
import { ChartOverviewRow } from "./types";

/**
 * Aperçu des classements (données publiées).
 *
 * Fusionne deux sources :
 *  - les snapshots publiés (chart_published_snapshots), gérés par l'admin ;
 *  - l'ancienne API agrégée (get_chart_overview) pour les sources restantes.
 * En cas de doublon par source_key, le snapshot a la priorité.
 */
export async function getChartOverview(limit = 10): Promise<ChartOverviewRow[]> {
  const supabase = await createClient();

  const [legacy, published] = await Promise.all([
    supabase.rpc("get_chart_overview", { p_limit: limit }),
    supabase.rpc("get_published_overview", { p_limit: limit }),
  ]);

  if (legacy.error) throw new Error(`get_chart_overview: ${legacy.error.message}`);

  const legacyRows = (legacy.data as ChartOverviewRow[]) ?? [];
  const publishedRows = (published.data as ChartOverviewRow[]) ?? [];

  const bySource = new Map<string, ChartOverviewRow>();
  for (const row of legacyRows) bySource.set(row.source_key, row);
  // Le snapshot publié prime sur l'ancienne édition.
  for (const row of publishedRows) bySource.set(row.source_key, row);

  return [...bySource.values()];
}
