/**
 * Contrat commun à tous les adaptateurs de sources de classement.
 * Chaque plateforme implémente cette interface de façon indépendante :
 * une erreur d'un adaptateur ne doit pas affecter les autres.
 */
import { IngestionMode, PlatformName } from "../types";

export interface ChartFetchContext {
  sourceKey: string;
  periodStart: string; // ISO UTC
  periodEnd: string; // ISO UTC
  limit: number;
}

export interface RawChartResult {
  sourceKey: string;
  ingestionMode: IngestionMode;
  status: "ok" | "manual_import_required" | "error";
  fetchedAt: string;
  rows: unknown[];
  message?: string;
}

export interface NormalizedChartEntry {
  sourcePosition: number;
  rawTrackTitle: string;
  rawArtistText: string;
  externalId?: string;
  externalUrl?: string;
  isrc?: string;
  artworkUrl?: string;
  metricValue?: number;
  metricUnit?: string;
}

export interface SourceHealthResult {
  healthy: boolean;
  detail: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ChartSourceAdapter {
  platform: PlatformName;
  ingestionMode: IngestionMode;
  testConnection(): Promise<SourceHealthResult>;
  fetchChart(context: ChartFetchContext): Promise<RawChartResult>;
  normalize(raw: RawChartResult): Promise<NormalizedChartEntry[]>;
  validate(entries: NormalizedChartEntry[]): Promise<ValidationResult>;
}

/** Réponse standard d'une collecte en mode manuel (aucun faux succès). */
export function resultatImportManuelRequis(
  sourceKey: string,
  platform: PlatformName
): RawChartResult {
  return {
    sourceKey,
    ingestionMode: "VERIFIED_ADMIN_IMPORT",
    status: "manual_import_required",
    fetchedAt: new Date().toISOString(),
    rows: [],
    message: `Aucune source automatique approuvée n'est configurée pour ${platform}.`,
  };
}
