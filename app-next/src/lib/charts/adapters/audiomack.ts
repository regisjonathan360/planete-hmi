/**
 * Adaptateur Audiomack — « Audiomack — Weekly 100 Haiti ».
 *
 * Mode par défaut : VERIFIED_ADMIN_IMPORT. L'API documente un classement
 * hebdomadaire GLOBAL mais aucun paramètre géographique « Haiti » public :
 * le global ne doit JAMAIS être présenté comme Haïti. Un mode PARTNER_FEED
 * est prévu si un endpoint géographique est officiellement accordé
 * (AUDIOMACK_HAITI_CHART_ENDPOINT), sans valeur fictive.
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

const endpointPartenaire = process.env.AUDIOMACK_HAITI_CHART_ENDPOINT || "";

export const audiomackAdapter: ChartSourceAdapter = {
  platform: "audiomack",
  ingestionMode: endpointPartenaire ? "PARTNER_FEED" : "VERIFIED_ADMIN_IMPORT",

  async testConnection(): Promise<SourceHealthResult> {
    return {
      healthy: true,
      detail: endpointPartenaire
        ? "Flux partenaire Haïti configuré."
        : "Import manuel actif ; aucun flux géographique Haïti configuré.",
    };
  },

  async fetchChart(context: ChartFetchContext): Promise<RawChartResult> {
    if (!endpointPartenaire) {
      return resultatImportManuelRequis(context.sourceKey, "audiomack");
    }
    // Flux partenaire officiel : à implémenter une fois l'accès accordé.
    return {
      sourceKey: context.sourceKey,
      ingestionMode: "PARTNER_FEED",
      status: "error",
      fetchedAt: new Date().toISOString(),
      rows: [],
      message: "Flux partenaire Audiomack configuré mais non encore implémenté.",
    };
  },

  async normalize(raw: RawChartResult): Promise<NormalizedChartEntry[]> {
    return normaliserLignesImport(raw.rows);
  },

  async validate(entries: NormalizedChartEntry[]): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  },
};
