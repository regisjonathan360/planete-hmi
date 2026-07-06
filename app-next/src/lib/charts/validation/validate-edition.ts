/**
 * Validation d'une édition avant passage au statut `validated`.
 * L'édition est refusée si l'une des conditions bloquantes est vraie
 * (cf. Requirement 21.2).
 */
import { MAX_POSITIONS } from "../ranking/calculate-filtered-positions";

export interface EntreeAValider {
  trackId: string | null;
  filteredPosition: number;
  sourcePosition: number;
  artisteVerifie: boolean; // au moins un primary/co_primary haïtien vérifié
  periodStart: string; // ISO de l'entrée (doit correspondre à l'édition)
}

export interface EditionAValider {
  sourceKey: string | null;
  periodStart: string;
  periodEnd: string;
  entries: EntreeAValider[];
}

export interface ResultatValidationEdition {
  valid: boolean;
  erreurs: string[];
}

export function validerEdition(edition: EditionAValider): ResultatValidationEdition {
  const erreurs: string[] = [];
  const { entries } = edition;

  if (!edition.sourceKey) erreurs.push("Source non identifiée.");

  if (
    !edition.periodStart ||
    !edition.periodEnd ||
    new Date(edition.periodStart).getTime() >= new Date(edition.periodEnd).getTime()
  ) {
    erreurs.push("Période incohérente.");
  }

  // Positions filtrées dupliquées.
  const positions = entries.map((e) => e.filteredPosition);
  if (new Set(positions).size !== positions.length) {
    erreurs.push("Positions filtrées dupliquées.");
  }

  // Chansons dupliquées.
  const trackIds = entries.map((e) => e.trackId);
  const trackIdsNonNuls = trackIds.filter((t): t is string => !!t);
  if (new Set(trackIdsNonNuls).size !== trackIdsNonNuls.length) {
    erreurs.push("Chansons dupliquées.");
  }

  // Position < 1.
  if (entries.some((e) => e.filteredPosition < 1)) {
    erreurs.push("Position filtrée inférieure à 1.");
  }

  // Plus de 20 positions filtrées.
  if (entries.length > MAX_POSITIONS) {
    erreurs.push(`Plus de ${MAX_POSITIONS} positions filtrées.`);
  }

  // Chanson sans correspondance.
  if (entries.some((e) => !e.trackId)) {
    erreurs.push("Une entrée n'a pas de correspondance de chanson.");
  }

  // Artiste non vérifié.
  if (entries.some((e) => !e.artisteVerifie)) {
    erreurs.push("Une entrée n'a pas d'artiste haïtien vérifié admissible.");
  }

  // Données provenant d'une autre semaine.
  if (entries.some((e) => e.periodStart && e.periodStart !== edition.periodStart)) {
    erreurs.push("Données provenant d'une autre semaine.");
  }

  return { valid: erreurs.length === 0, erreurs };
}
