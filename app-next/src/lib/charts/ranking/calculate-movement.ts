/**
 * Calcule le mouvement et le statut d'une entrée par rapport à la dernière
 * édition publiée du même classement.
 *
 *   movement = previous_filtered_position - filtered_position
 *   up    <=> movement > 0
 *   down  <=> movement < 0
 *   stable<=> movement = 0
 *
 * Distinction new / reentry :
 *  - new     : la chanson n'a JAMAIS figuré dans une édition publiée ;
 *  - reentry : déjà classée, absente ≥ 1 semaine, puis de retour.
 */
import { EntryStatus } from "../types";

export interface HistoriquePiste {
  /** Position filtrée à l'édition publiée précédente (null si absente). */
  previousFilteredPosition: number | null;
  /** A déjà figuré au moins une fois dans une édition publiée antérieure. */
  aDejaFigure: boolean;
}

export interface MouvementCalcule {
  movement: number | null;
  previousFilteredPosition: number | null;
  entryStatus: EntryStatus;
}

export function calculerMouvement(
  filteredPosition: number,
  historique: HistoriquePiste
): MouvementCalcule {
  const { previousFilteredPosition, aDejaFigure } = historique;

  if (previousFilteredPosition == null) {
    // Absente de l'édition précédente.
    return {
      movement: null,
      previousFilteredPosition: null,
      entryStatus: aDejaFigure ? "reentry" : "new",
    };
  }

  const movement = previousFilteredPosition - filteredPosition;
  let entryStatus: EntryStatus;
  if (movement > 0) entryStatus = "up";
  else if (movement < 0) entryStatus = "down";
  else entryStatus = "stable";

  return { movement, previousFilteredPosition, entryStatus };
}
