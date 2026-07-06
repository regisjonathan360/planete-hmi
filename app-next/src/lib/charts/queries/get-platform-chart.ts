import { createClient } from "@/lib/supabase/server";
import { PlatformChart } from "./types";

/**
 * Top complet (jusqu'à 20) d'une plateforme, édition la plus récente publiée
 * par défaut (ou une édition précise).
 */
export async function getPlatformChart(
  sourceKey: string,
  limit = 20,
  edition?: string
): Promise<PlatformChart | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_chart", {
    p_source_key: sourceKey,
    p_limit: limit,
    p_edition: edition ?? null,
  });
  if (error) throw new Error(`get_platform_chart: ${error.message}`);
  return (data as PlatformChart | null) ?? null;
}
