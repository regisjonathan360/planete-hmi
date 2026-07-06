/**
 * Adaptateur Apple Music — OFFICIAL_API.
 *
 * Processus obligatoire : tester le storefront `ht`. S'il retourne un vrai
 * chart de chansons -> « Apple Music — Haïti ». Sinon -> définition explicite
 * « Apple Music — HMI Worldwide » (filtrage des artistes haïtiens dans un
 * classement international). AUCUNE bascule silencieuse vers un autre pays.
 * Clé privée Apple exclusivement côté serveur.
 */
import {
  ChartFetchContext,
  ChartSourceAdapter,
  NormalizedChartEntry,
  RawChartResult,
  SourceHealthResult,
  ValidationResult,
} from "./types";

function clesApplePresentes(): boolean {
  return !!(
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  );
}

export const appleMusicAdapter: ChartSourceAdapter = {
  platform: "apple_music",
  ingestionMode: "OFFICIAL_API",

  async testConnection(): Promise<SourceHealthResult> {
    if (!clesApplePresentes()) {
      return {
        healthy: false,
        detail: "Clés Apple (APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY) manquantes.",
      };
    }
    return { healthy: true, detail: "Developer Token Apple configurable." };
  },

  async fetchChart(context: ChartFetchContext): Promise<RawChartResult> {
    if (!clesApplePresentes()) {
      return {
        sourceKey: context.sourceKey,
        ingestionMode: "OFFICIAL_API",
        status: "error",
        fetchedAt: new Date().toISOString(),
        rows: [],
        message: "Clés Apple manquantes : impossible d'appeler /v1/catalog/{storefront}/charts.",
      };
    }
    // À implémenter : générer le Developer Token, tester le storefront `ht`,
    // GET /v1/catalog/{storefront}/charts?types=songs&limit=..., enregistrer
    // le résultat du test, choisir Haïti vs HMI Worldwide sans bascule tacite.
    return {
      sourceKey: context.sourceKey,
      ingestionMode: "OFFICIAL_API",
      status: "error",
      fetchedAt: new Date().toISOString(),
      rows: [],
      message: "Collecte Apple Music non encore implémentée (token + test storefront).",
    };
  },

  async normalize(): Promise<NormalizedChartEntry[]> {
    return [];
  },

  async validate(entries: NormalizedChartEntry[]): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  },
};
