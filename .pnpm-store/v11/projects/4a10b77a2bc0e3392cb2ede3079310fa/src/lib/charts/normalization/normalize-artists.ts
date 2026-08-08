/**
 * Normalisation du champ artiste brut renvoyé par les plateformes.
 *
 * Les plateformes fournissent souvent une seule chaîne mêlant plusieurs
 * artistes ("Artiste A feat. Artiste B", "A, B & C"). On découpe cette
 * chaîne en artistes ordonnés, en marquant les rôles détectables
 * (featured), sans jamais inventer d'artiste.
 */

import { retirerAccents } from "./normalize-title";

export type RoleDetecte = "primary" | "co_primary" | "featured";

export interface ArtisteNormalise {
  nom: string;
  nomCle: string; // clé de comparaison (minuscule, sans accents)
  role: RoleDetecte;
  billingOrder: number;
}

// Séparateurs de "featuring" (le reste devient featured).
const SEP_FEAT = /\s*(?:feat\.?|featuring|ft\.?|avec|invit[ée]\b)\s*/i;
// Séparateurs de co-artistes principaux.
const SEP_PRINCIPAUX = /\s*(?:,|&|\bet\b|\bx\b|\bvs\.?\b|\/|\+)\s*/i;

/** Clé de comparaison d'un nom d'artiste. */
export function normalizeArtistName(nom: string): string {
  return retirerAccents(String(nom || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Découpe une chaîne d'artistes brute en artistes ordonnés avec rôle.
 * Le premier bloc "principal" est `primary`, les suivants `co_primary`,
 * et tout ce qui suit un "feat" est `featured`.
 */
export function normalizeArtists(raw: string): ArtisteNormalise[] {
  if (!raw) return [];

  const [partiePrincipale, ...reste] = String(raw).split(SEP_FEAT);
  const partieFeat = reste.join(" ");

  const principaux = partiePrincipale
    .split(SEP_PRINCIPAUX)
    .map((s) => s.trim())
    .filter(Boolean);

  const featured = partieFeat
    .split(SEP_PRINCIPAUX)
    .map((s) => s.trim())
    .filter(Boolean);

  const resultat: ArtisteNormalise[] = [];
  let ordre = 0;

  principaux.forEach((nom, i) => {
    resultat.push({
      nom,
      nomCle: normalizeArtistName(nom),
      role: i === 0 ? "primary" : "co_primary",
      billingOrder: ordre++,
    });
  });

  featured.forEach((nom) => {
    resultat.push({
      nom,
      nomCle: normalizeArtistName(nom),
      role: "featured",
      billingOrder: ordre++,
    });
  });

  return resultat;
}
