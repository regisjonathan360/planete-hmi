/**
 * Normalisation des titres de chansons.
 *
 * Objectif : produire une clé comparable stable tout en CONSERVANT les
 * informations musicales significatives (remix, live, acoustic, sped up…).
 * Les mentions purement décoratives (official video, audio, lyric video…)
 * sont retirées.
 *
 * Exemples :
 *   "4 Kampé (Official Music Video)" -> "4 kampe"
 *   "4 Kampé — Remix"                -> "4 kampe remix"
 */

/** Marqueurs de version musicale à préserver (forme normalisée). */
export const MARQUEURS_SIGNIFICATIFS = [
  "remix",
  "live",
  "acoustic",
  "sped up",
  "slowed",
  "instrumental",
] as const;

/** Mentions décoratives à retirer (comparées en minuscules, sans accents). */
const MENTIONS_DECORATIVES = [
  "official music video",
  "official video",
  "official audio",
  "official lyric video",
  "lyric video",
  "lyrics video",
  "visualizer",
  "visualiser",
  "audio",
  "hd",
  "4k",
  "mv",
];

/** Retire les accents (pour comparaison uniquement). */
export function retirerAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalise un titre pour la comparaison/déduplication.
 * Déterministe et idempotent : normalizeTitle(normalizeTitle(x)) === normalizeTitle(x).
 */
export function normalizeTitle(input: string): string {
  if (!input) return "";

  let s = retirerAccents(String(input)).toLowerCase();

  // Unifier les séparateurs décoratifs en espaces.
  s = s.replace(/[\u2010-\u2015\-_/|]/g, " ");

  // Extraire d'abord les marqueurs significatifs présents (avant de purger
  // la ponctuation), pour les réinjecter en fin de clé.
  const marqueursPresents: string[] = [];
  for (const m of MARQUEURS_SIGNIFICATIFS) {
    // \b ne gère pas l'espace dans "sped up" : on teste la sous-chaîne mot.
    const motif = new RegExp("(^|[^a-z])" + m.replace(" ", "\\s+") + "([^a-z]|$)");
    if (motif.test(s)) marqueursPresents.push(m);
  }

  // Retirer le contenu entre parenthèses/crochets s'il n'est QUE décoratif.
  s = s.replace(/[([{][^)\]}]*[)\]}]/g, (bloc) => {
    const interne = bloc.slice(1, -1);
    const contientMarqueur = MARQUEURS_SIGNIFICATIFS.some((m) =>
      interne.includes(m.replace(" ", " "))
    );
    return contientMarqueur ? " " + interne + " " : " ";
  });

  // Retirer les mentions décoratives résiduelles.
  for (const mention of MENTIONS_DECORATIVES) {
    s = s.replace(new RegExp("(^|[^a-z])" + mention + "([^a-z]|$)", "g"), " ");
  }

  // Ne garder que lettres/chiffres/espaces.
  s = s.replace(/[^a-z0-9\s]/g, " ");

  // Retirer les marqueurs du corps (ils seront réajoutés proprement à la fin).
  for (const m of marqueursPresents) {
    s = s.replace(new RegExp("(^|\\s)" + m.replace(" ", "\\s+") + "(\\s|$)", "g"), " ");
  }

  // Réduire les espaces.
  s = s.replace(/\s+/g, " ").trim();

  // Réinjecter les marqueurs significatifs, dédupliqués, dans un ordre stable.
  if (marqueursPresents.length) {
    const uniques = MARQUEURS_SIGNIFICATIFS.filter((m) => marqueursPresents.includes(m));
    s = (s + " " + uniques.join(" ")).trim();
  }

  return s;
}
