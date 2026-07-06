/**
 * Éligibilité haïtienne d'une chanson.
 *
 * Règle par défaut (restrictive) : une chanson est admissible au classement
 * principal si AU MOINS un artiste `primary` ou `co_primary` est haïtien
 * vérifié. Un artiste haïtien uniquement `featured` ne suffit pas (la chanson
 * peut alors être classée séparément comme « Collaboration haïtienne »).
 */
import {
  CreditArtiste,
  ROLES_ADMISSIBLES_PRINCIPAUX,
  STATUTS_HAITIENS_VERIFIES,
  ArtistRole,
} from "../types";

export interface OptionsEligibilite {
  /** Rôles ouvrant droit à l'admissibilité principale. */
  rolesAdmissibles?: ArtistRole[];
}

export function estArtisteHaitienVerifie(credit: CreditArtiste): boolean {
  return STATUTS_HAITIENS_VERIFIES.includes(credit.haitianStatus);
}

/** La chanson est-elle admissible au classement principal ? */
export function estAdmissiblePrincipal(
  credits: CreditArtiste[],
  options: OptionsEligibilite = {}
): boolean {
  const roles = options.rolesAdmissibles ?? ROLES_ADMISSIBLES_PRINCIPAUX;
  return credits.some(
    (c) => roles.includes(c.role) && estArtisteHaitienVerifie(c)
  );
}

/**
 * La chanson n'a qu'un artiste haïtien `featured` (aucun principal haïtien) :
 * candidate au classement « Collaboration haïtienne ».
 */
export function estCollaborationHaitienne(credits: CreditArtiste[]): boolean {
  if (estAdmissiblePrincipal(credits)) return false;
  return credits.some(
    (c) => c.role === "featured" && estArtisteHaitienVerifie(c)
  );
}
