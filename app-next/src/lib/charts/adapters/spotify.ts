/**
 * Adaptateur Spotify — « Spotify — Populaire en Haïti ».
 *
 * Mode par défaut : VERIFIED_ADMIN_IMPORT. La Web API Spotify ne documente pas
 * d'endpoint public pour télécharger le classement territorial « Popular in
 * Haiti » ; on n'invente donc aucun classement. La Web API sert uniquement à
 * ENRICHIR (Track ID, ISRC, titre, album, artistes, pochette, lien) — jamais à
 * produire des nombres de streams.
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

export const spotifyAdapter: ChartSourceAdapter = {
  platform: "spotify",
  ingestionMode: "VERIFIED_ADMIN_IMPORT",

  async testConnection(): Promise<SourceHealthResult> {
    const enrichissementDispo = !!(
      process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    );
    return {
      healthy: true,
      detail: enrichissementDispo
        ? "Import manuel actif ; enrichissement Web API disponible."
        : "Import manuel actif ; enrichissement Web API non configuré.",
    };
  },

  async fetchChart(context: ChartFetchContext): Promise<RawChartResult> {
    // Aucune source automatique approuvée : on NE simule PAS de succès.
    return resultatImportManuelRequis(context.sourceKey, "spotify");
  },

  async normalize(raw: RawChartResult): Promise<NormalizedChartEntry[]> {
    return normaliserLignesImport(raw.rows);
  },

  async validate(entries: NormalizedChartEntry[]): Promise<ValidationResult> {
    const errors: string[] = [];
    if (entries.some((e) => e.metricUnit === "streams")) {
      errors.push("Spotify : aucun nombre de streams ne doit être fabriqué.");
    }
    return { valid: errors.length === 0, errors };
  },
};
