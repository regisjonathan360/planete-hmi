/**
 * Modération automatique — filtre de termes interdits.
 * Utilisé pour bloquer les commentaires et pseudos contenant des termes bannis.
 */

export type ModerationResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Vérifie si le texte contient au moins un terme interdit (correspondance
 * de sous-chaîne, insensible à la casse).
 *
 * Si la liste de termes interdits est vide, retourne toujours `false`.
 */
export function containsBannedTerm(
  text: string,
  bannedTerms: string[],
): boolean {
  if (bannedTerms.length === 0) return false;

  const lowerText = text.toLowerCase();
  return bannedTerms.some((term) => lowerText.includes(term.toLowerCase()));
}

/**
 * Filtre un commentaire en vérifiant s'il contient des termes interdits.
 * Retourne un `ModerationResult` indiquant si le commentaire est autorisé
 * ou bloqué avec la raison.
 */
export function filterComment(
  body: string,
  bannedTerms: string[],
): ModerationResult {
  if (containsBannedTerm(body, bannedTerms)) {
    return {
      allowed: false,
      reason:
        "Le contenu enfreint les règles de la communauté. Veuillez reformuler.",
    };
  }

  return { allowed: true };
}
