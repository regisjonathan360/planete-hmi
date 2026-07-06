/**
 * Adaptateur YouTube — DEUX classements distincts :
 *  - `youtube_haiti_official`   : VERIFIED_ADMIN_IMPORT (territorial Haïti).
 *  - `youtube_hmi_weekly_delta` : OFFICIAL_API, vues MONDIALES gagnées en 7 j
 *    (weekly_view_delta), calculées sur une liste blanche de vidéos officielles.
 *    Ce classement n'est JAMAIS présenté comme territorial Haïti.
 */
import {
  ChartFetchContext,
  ChartSourceAdapter,
  NormalizedChartEntry,
  RawChartResult,
  SourceHealthResult,
  ValidationResult,
  resultatImportManuelRequis,
} from "./types";
import { normaliserLignesImport } from "./normalize-import";

const SOURCE_DELTA = "youtube_hmi_weekly_delta";

export const youtubeAdapter: ChartSourceAdapter = {
  platform: "youtube",
  ingestionMode: "VERIFIED_ADMIN_IMPORT",

  async testConnection(): Promise<SourceHealthResult> {
    const apiDispo = !!process.env.YOUTUBE_API_KEY;
    return {
      healthy: apiDispo,
      detail: apiDispo
        ? "YouTube Data API disponible (mode vues gagnées 7 j)."
        : "YOUTUBE_API_KEY manquant ; seul l'import manuel territorial est possible.",
    };
  },

  async fetchChart(context: ChartFetchContext): Promise<RawChartResult> {
    if (context.sourceKey === SOURCE_DELTA) {
      if (!process.env.YOUTUBE_API_KEY) {
        return {
          sourceKey: context.sourceKey,
          ingestionMode: "OFFICIAL_API",
          status: "error",
          fetchedAt: new Date().toISOString(),
          rows: [],
          message: "YOUTUBE_API_KEY manquant : impossible de calculer weekly_view_delta.",
        };
      }
      // À implémenter : videos.list?part=statistics sur la liste blanche,
      // puis weekly_view_delta = total_actuel - total_semaine_precedente.
      return {
        sourceKey: context.sourceKey,
        ingestionMode: "OFFICIAL_API",
        status: "error",
        fetchedAt: new Date().toISOString(),
        rows: [],
        message: "Collecte weekly_view_delta non encore implémentée.",
      };
    }
    // Classement territorial : import vérifié.
    return resultatImportManuelRequis(context.sourceKey, "youtube");
  },

  async normalize(raw: RawChartResult): Promise<NormalizedChartEntry[]> {
    return normaliserLignesImport(raw.rows);
  },

  async validate(entries: NormalizedChartEntry[]): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  },
};
