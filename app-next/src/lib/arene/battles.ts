/**
 * Logique des battles communautaires — détermination du vainqueur et état d'activité.
 */

export type BattleWinner = "side_a" | "side_b" | "tie";

/**
 * Détermine le vainqueur d'une battle terminée en comparant les votes de chaque côté.
 *
 * - Si votesA > votesB → 'side_a'
 * - Si votesB > votesA → 'side_b'
 * - Si votesA === votesB → 'tie'
 *
 * @param votesA Nombre de votes pour le côté A (≥ 0)
 * @param votesB Nombre de votes pour le côté B (≥ 0)
 * @returns Le côté gagnant ou 'tie' en cas d'égalité
 */
export function determineWinner(votesA: number, votesB: number): BattleWinner {
  if (votesA > votesB) return "side_a";
  if (votesB > votesA) return "side_b";
  return "tie";
}

/**
 * Vérifie si une battle est encore active (son timestamp de fin est dans le futur).
 *
 * @param endsAt Timestamp ISO 8601 de fin de la battle
 * @returns `true` si la battle n'a pas encore expiré, `false` sinon
 */
export function isBattleActive(endsAt: string): boolean {
  const endTime = new Date(endsAt).getTime();
  const now = Date.now();
  return endTime > now;
}
