/**
 * Utilitaires pour la validation et normalisation des poids de genres.
 */

/**
 * Validate a genre weight (must be 0.0 ≤ value ≤ 5.0).
 */
export function validateWeight(value: number): boolean {
  if (typeof value !== "number" || Number.isNaN(value)) return false;
  return value >= 0.0 && value <= 5.0;
}

/**
 * Normalize weights to percentages (each weight / sum * 100).
 * Returns empty map if all weights are 0.
 */
export function normalizeWeights(
  weights: Map<string, number>
): Map<string, number> {
  const result = new Map<string, number>();

  const sum = Array.from(weights.values()).reduce((acc, w) => acc + w, 0);

  if (sum === 0) return result;

  for (const [key, weight] of weights) {
    result.set(key, (weight / sum) * 100);
  }

  return result;
}
