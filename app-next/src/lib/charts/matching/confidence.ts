/**
 * Score de confiance de correspondance entre une entrée brute et une piste
 * candidate. Retourne une valeur dans [0, 1].
 *
 * Ordre de priorité (cf. design) :
 *   ISRC identique > identifiant plateforme déjà associé >
 *   (artiste principal + titre normalisé) > durée proche >
 *   date de sortie proche > album identique.
 */
import { DonneesComparaisonPiste } from "../types";

export const SEUIL_AUTO = 0.95; // >= : correspondance automatique
export const SEUIL_REVUE = 0.8; // [0.80, 0.95[ : vérification recommandée
// < 0.80 : vérification humaine obligatoire

export interface EntreeAComparer extends DonneesComparaisonPiste {
  /** Vrai si l'identifiant plateforme est DÉJÀ associé à cette piste candidate. */
  platformIdDejaAssocie?: boolean;
}

function proche(a: number | null | undefined, b: number | null | undefined, tolerance: number): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tolerance;
}

function memeAnneeMois(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Calcule un score de confiance borné [0,1]. */
export function scoreConfiance(
  entree: EntreeAComparer,
  candidat: DonneesComparaisonPiste
): number {
  // Signaux forts et déterministes.
  if (entree.isrc && candidat.isrc && entree.isrc === candidat.isrc) return 1;
  if (entree.platformIdDejaAssocie) return 1;

  let score = 0;

  const memeTitre =
    !!entree.normalizedTitle &&
    entree.normalizedTitle === candidat.normalizedTitle;
  const memeArtiste =
    !!entree.primaryArtistKey &&
    entree.primaryArtistKey === candidat.primaryArtistKey;

  if (memeTitre && memeArtiste) score += 0.9;
  else if (memeTitre) score += 0.55;
  else if (memeArtiste) score += 0.2;

  // Durée proche (± 2 s).
  if (proche(entree.durationMs, candidat.durationMs, 2000)) score += 0.05;
  // Date de sortie proche (même mois).
  if (memeAnneeMois(entree.releaseDate, candidat.releaseDate)) score += 0.03;
  // Album identique.
  if (
    entree.albumTitle &&
    candidat.albumTitle &&
    entree.albumTitle.toLowerCase() === candidat.albumTitle.toLowerCase()
  ) {
    score += 0.02;
  }

  return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
}

export type ResolutionCorrespondance = "auto" | "revue_recommandee" | "revue_obligatoire";

export function classerConfiance(score: number): ResolutionCorrespondance {
  if (score >= SEUIL_AUTO) return "auto";
  if (score >= SEUIL_REVUE) return "revue_recommandee";
  return "revue_obligatoire";
}
