/**
 * Calcule les positions filtrées Planète HMI (1..N) à partir des positions
 * source, en ne conservant que les entrées admissibles.
 *
 * Règles (cf. design) :
 *  - la position source n'est JAMAIS modifiée ;
 *  - tri par position source croissante ;
 *  - attribution de filtered_position 1..N (N ≤ 20) ;
 *  - aucun remplissage artificiel : N = nombre réel d'admissibles.
 */

export interface EntreeSource<T = unknown> {
  sourcePosition: number;
  eligible: boolean;
  data?: T;
}

export interface EntreeFiltree<T = unknown> {
  sourcePosition: number;
  filteredPosition: number;
  data?: T;
}

export const MAX_POSITIONS = 20;

export function calculerPositionsFiltrees<T>(
  entrees: EntreeSource<T>[],
  maxPositions: number = MAX_POSITIONS
): EntreeFiltree<T>[] {
  return entrees
    .filter((e) => e.eligible)
    .slice() // ne pas muter l'entrée
    .sort((a, b) => a.sourcePosition - b.sourcePosition)
    .slice(0, maxPositions)
    .map((e, i) => ({
      sourcePosition: e.sourcePosition,
      filteredPosition: i + 1,
      data: e.data,
    }));
}
