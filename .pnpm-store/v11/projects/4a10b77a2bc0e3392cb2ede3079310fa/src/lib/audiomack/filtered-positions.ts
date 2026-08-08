/**
 * Utilitaire pour calculer les positions filtrées (Top 20) d'un classement.
 */

/**
 * Assign filtered positions 1..min(E, maxDisplay) to eligible entries.
 * Returns entries with their assigned filtered position.
 *
 * Only eligible entries receive a position. Positions form a contiguous
 * sequence starting at 1 up to min(eligible count, maxDisplay).
 */
export function computeFilteredPositions<T>(
  entries: Array<{ eligible: boolean; data: T }>,
  maxDisplay: number = 20
): Array<{ filteredPosition: number; data: T }> {
  const result: Array<{ filteredPosition: number; data: T }> = [];
  let position = 1;

  for (const entry of entries) {
    if (!entry.eligible) continue;
    if (position > maxDisplay) break;

    result.push({
      filteredPosition: position,
      data: entry.data,
    });
    position++;
  }

  return result;
}
