/**
 * Normalisation commune des lignes d'import vérifié en NormalizedChartEntry.
 * Utilisée par les adaptateurs en mode VERIFIED_ADMIN_IMPORT.
 */
import { NormalizedChartEntry } from "./types";
import { ImportRow, validerLignesImport } from "../validation/schemas";

export function normaliserLignesImport(rows: unknown[]): NormalizedChartEntry[] {
  const { valides } = validerLignesImport(rows);
  return valides.map(ligneVersEntree);
}

export function ligneVersEntree(r: ImportRow): NormalizedChartEntry {
  return {
    sourcePosition: r.source_position,
    rawTrackTitle: r.track_title,
    rawArtistText: r.artist_names,
    externalId: r.source_identifier,
    externalUrl: r.source_url,
    isrc: r.isrc,
    artworkUrl: r.artwork_url,
    metricValue: r.metric_value,
    metricUnit: r.metric_unit,
  };
}
