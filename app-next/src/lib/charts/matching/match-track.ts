/**
 * Rapproche une entrée brute d'une liste de pistes candidates et décide de
 * la résolution (auto / file de vérification).
 */
import { DonneesComparaisonPiste } from "../types";
import {
  EntreeAComparer,
  ResolutionCorrespondance,
  classerConfiance,
  scoreConfiance,
} from "./confidence";

export interface CandidatPiste extends DonneesComparaisonPiste {
  trackId: string;
}

export interface ResultatCorrespondance {
  trackId: string | null;
  confidence: number;
  resolution: ResolutionCorrespondance;
  /** true si la correspondance peut être publiée automatiquement. */
  publiable: boolean;
}

/**
 * Choisit le meilleur candidat. Ne publie JAMAIS une correspondance incertaine
 * (< seuil auto) : celle-ci part en file de vérification humaine.
 */
export function trouverCorrespondance(
  entree: EntreeAComparer,
  candidats: CandidatPiste[]
): ResultatCorrespondance {
  let meilleur: { trackId: string; score: number } | null = null;

  for (const c of candidats) {
    const score = scoreConfiance(entree, c);
    if (!meilleur || score > meilleur.score) {
      meilleur = { trackId: c.trackId, score };
    }
  }

  if (!meilleur) {
    return { trackId: null, confidence: 0, resolution: "revue_obligatoire", publiable: false };
  }

  const resolution = classerConfiance(meilleur.score);
  return {
    trackId: meilleur.trackId,
    confidence: meilleur.score,
    resolution,
    publiable: resolution === "auto",
  };
}
