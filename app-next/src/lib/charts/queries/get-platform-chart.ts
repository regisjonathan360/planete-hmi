import { createClient } from "@/lib/supabase/server";
import { PlatformChart } from "./types";

/**
 * Top complet (jusqu'à 20) d'une plateforme.
 *
 * Lecture prioritaire depuis chart_published_snapshots (version figée gérée
 * par l'administration). Repli sur l'ancienne API (get_platform_chart) pour
 * les sources encore servies par les éditions publiées classiques.
 */
export async function getPlatformChart(
  sourceKey: string,
  limit = 20,
  edition?: string
): Promise<PlatformChart | null> {
  const supabase = await createClient();

  // 1) Snapshot publié (source de vérité pour l'admin nouvelle génération).
  if (!edition) {
    const { data: snap } = await supabase.rpc("get_published_platform_chart", {
      p_source_key: sourceKey,
      p_limit: limit,
    });
    if (snap) return snap as PlatformChart;
  }

  // 2) Repli : API historique basée sur les éditions publiées.
  const { data, error } = await supabase.rpc("get_platform_chart", {
    p_source_key: sourceKey,
    p_limit: limit,
    p_edition: edition ?? null,
  });
  if (error) throw new Error(`get_platform_chart: ${error.message}`);
  return (data as PlatformChart | null) ?? null;
}
