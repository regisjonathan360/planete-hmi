/**
 * Calcule les indicateurs d'historique d'une chanson dans un classement :
 * meilleure position, semaines totales, semaines consécutives.
 *
 * `historiquePublie` = positions filtrées de la chanson dans les éditions
 * publiées ANTÉRIEURES, de la plus ancienne à la plus récente. `null`
 * représente une édition où la chanson était absente.
 */

export interface IndicateursHistorique {
  peakFilteredPosition: number;
  weeksOnChart: number;
  consecutiveWeeks: number;
}

export function calculerHistorique(
  filteredPositionActuelle: number,
  historiquePublie: (number | null)[]
): IndicateursHistorique {
  const presencesPassees = historiquePublie.filter(
    (p): p is number => p != null
  );

  const toutes = [...presencesPassees, filteredPositionActuelle];
  const peak = Math.min(...toutes);
  const weeksOnChart = toutes.length;

  // Semaines consécutives incluant l'édition actuelle : on remonte tant que
  // la chanson était présente sans interruption.
  let consecutive = 1;
  for (let i = historiquePublie.length - 1; i >= 0; i--) {
    if (historiquePublie[i] != null) consecutive++;
    else break;
  }

  return {
    peakFilteredPosition: peak,
    weeksOnChart,
    consecutiveWeeks: consecutive,
  };
}
