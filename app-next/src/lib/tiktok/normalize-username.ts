/**
 * Normalisation des pseudos TikTok.
 * Extrait un pseudo canonique depuis différents formats :
 * - @x_ojo_official
 * - x_ojo_official
 * - https://www.tiktok.com/@x_ojo_official
 * - https://www.tiktok.com/@x_ojo_official/
 * - https://www.tiktok.com/@x_ojo_official?lang=fr
 * - Différentes capitalisations
 *
 * Le résultat est toujours en minuscules, sans @ ni espaces.
 */

/**
 * Extrait le pseudo TikTok canonique depuis une URL, un @pseudo, ou un pseudo brut.
 * Retourne null si la valeur est vide ou invalide.
 */
export function normalizeTikTokUsername(value: string | null | undefined): string | null {
  if (!value) return null;

  let raw = value.trim();

  // Extraire depuis une URL TikTok
  const urlMatch = raw.match(
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/i
  );
  if (urlMatch) {
    raw = urlMatch[1];
  } else {
    // Retirer le @ initial
    if (raw.startsWith("@")) raw = raw.slice(1);
    // Retirer tout ce qui suit un ? ou /
    raw = raw.split(/[?/]/)[0];
  }

  // Nettoyage final
  raw = raw.trim().toLowerCase();

  // Validation : un pseudo TikTok contient uniquement des lettres, chiffres, _ et .
  if (!raw || !/^[a-z0-9_.]+$/.test(raw)) return null;

  return raw;
}

/**
 * Compare deux pseudos TikTok normalisés.
 * Retourne true si les deux correspondent exactement après normalisation.
 */
export function tiktokUsernamesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const normA = normalizeTikTokUsername(a);
  const normB = normalizeTikTokUsername(b);
  if (!normA || !normB) return false;
  return normA === normB;
}
