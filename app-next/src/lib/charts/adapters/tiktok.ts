/**
 * Adaptateur TikTok — « TikTok — Sons populaires en Haïti ».
 *
 * Mode par défaut : VERIFIED_ADMIN_IMPORT. La métrique est le nombre de
 * PUBLICATIONS utilisant un son (posts_count) — jamais présentée comme des
 * streams ou des vues. Les sons non reconnus partent en file de vérification.
 * Modes PARTNER_FEED / OFFICIAL_EXPORT prévus après accès approuvé.
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

export const tiktokAdapter: ChartSourceAdapter = {
  platform: "tiktok",
  ingestionMode: "VERIFIED_ADMIN_IMPORT",

  async testConnection(): Promise<SourceHealthResult> {
    return { healthy: true, detail: "Import manuel actif ; aucun accès TikTok approuvé configuré." };
  },

  async fetchChart(context: ChartFetchContext): Promise<RawChartResult> {
    return resultatImportManuelRequis(context.sourceKey, "tiktok");
  },

  async normalize(raw: RawChartResult): Promise<NormalizedChartEntry[]> {
    const entries = normaliserLignesImport(raw.rows);
    // La métrique TikTok est un nombre de publications.
    return entries.map((e) => ({
      ...e,
      metricUnit: e.metricUnit ?? "posts_count",
    }));
  },

  async validate(entries: NormalizedChartEntry[]): Promise<ValidationResult> {
    const errors: string[] = [];
    if (entries.some((e) => e.metricUnit === "streams" || e.metricUnit === "views")) {
      errors.push("TikTok : la métrique est un nombre de publications, pas des streams/vues.");
    }
    return { valid: errors.length === 0, errors };
  },
};
