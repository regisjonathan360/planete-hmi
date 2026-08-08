/**
 * Système de niveaux cosmiques de l'arène communautaire.
 * Détermine le grade d'un membre en fonction de ses points cosmiques.
 */

export type Niveau = 'etoile' | 'constellation' | 'nebuleuse' | 'galaxie' | 'univers';

/**
 * Seuils de niveaux ordonnés du plus élevé au plus bas.
 * L'itération se fait du haut vers le bas pour retourner le premier match.
 */
export const NIVEAU_THRESHOLDS: { niveau: Niveau; minPoints: number }[] = [
  { niveau: 'univers', minPoints: 5000 },
  { niveau: 'galaxie', minPoints: 1500 },
  { niveau: 'nebuleuse', minPoints: 500 },
  { niveau: 'constellation', minPoints: 100 },
  { niveau: 'etoile', minPoints: 0 },
];

/**
 * Calcule le niveau cosmique d'un membre en fonction de ses points.
 * Itère les seuils du plus élevé au plus bas et retourne le premier dont
 * le `minPoints` est inférieur ou égal aux points du membre.
 *
 * @param points - Nombre de points cosmiques (doit être >= 0)
 * @returns Le niveau cosmique correspondant
 */
export function computeNiveau(points: number): Niveau {
  for (const threshold of NIVEAU_THRESHOLDS) {
    if (points >= threshold.minPoints) {
      return threshold.niveau;
    }
  }
  // Fallback (ne devrait jamais être atteint car le dernier seuil est 0)
  return 'etoile';
}
