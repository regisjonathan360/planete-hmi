/**
 * Extraction des crédits de production depuis un titre de chanson.
 *
 * La Web API Spotify n'expose aucun endpoint de crédits (producteurs,
 * beatmakers) : ces informations ne sont visibles que dans l'application. On ne
 * les invente donc pas. En revanche, la scène haïtienne les écrit quasi
 * systématiquement dans le titre publié sur les plateformes :
 *
 *   « Bèl Ti Fanm (Prod. by Michael Brun) »
 *   « Anmwey [Prod Tonymix x Dj Bullet] »
 *   « Kite M Pale - produced by Fresh Izzo »
 *
 * Ce module lit ces mentions telles qu'elles sont publiées. Chaque crédit
 * extrait reste marqué `title_credit` avec un score de confiance, et doit être
 * validé en admin avant d'être considéré comme vérifié.
 */

export type ProductionRole = "producer" | "beatmaker" | "co-producer" | "executive_producer";

export interface ExtractedCredit {
  /** Nom du producteur tel qu'écrit dans le titre, nettoyé. */
  name: string;
  role: ProductionRole;
  /** 0 → 1. Plus la mention est explicite, plus le score est haut. */
  confidence: number;
  /** Extrait brut d'origine, conservé pour audit en admin. */
  rawMention: string;
}

export interface TitleCredits {
  /** Titre débarrassé de la mention de production. */
  cleanTitle: string;
  credits: ExtractedCredit[];
}

/**
 * Mentions reconnues, de la plus explicite à la plus faible.
 * Le groupe 1 est le mot-clé, le groupe 2 la liste de noms.
 */
const MENTION_PATTERNS: { pattern: RegExp; role: ProductionRole; confidence: number }[] = [
  // (Executive producer: X) / [exec. prod X]
  {
    pattern: /[([|\-–—]\s*(exec(?:utive)?\.?\s*prod(?:uced|ucer|\.)?)\s*(?:by|par|:)?\s*([^)\]|]+?)\s*[)\]|]?$/i,
    role: "executive_producer",
    confidence: 0.8,
  },
  // (Co-prod. X)
  {
    pattern: /[([|\-–—]\s*(co[-\s]?prod(?:uced|ucer|\.)?)\s*(?:by|par|:)?\s*([^)\]|]+?)\s*[)\]|]?$/i,
    role: "co-producer",
    confidence: 0.8,
  },
  // (Beat by X) / [beatmaker: X]
  {
    pattern: /[([|\-–—]\s*(beat(?:s|maker)?)\s*(?:by|par|:)\s*([^)\]|]+?)\s*[)\]|]?$/i,
    role: "beatmaker",
    confidence: 0.75,
  },
  // (Prod. by X) / [Prod X] / | prod par X
  {
    pattern: /[([|\-–—]\s*(prod(?:uced|uction|ucer|\.)?)\s*(?:by|par|:)?\s*([^)\]|]+?)\s*[)\]|]?$/i,
    role: "producer",
    confidence: 0.85,
  },
];

/** Mentions à l'intérieur du titre (pas seulement en fin). */
const INLINE_PATTERNS: { pattern: RegExp; role: ProductionRole; confidence: number }[] = [
  {
    pattern: /\(\s*prod(?:uced|uction|ucer|\.)?\s*(?:by|par|:)?\s*([^)]+?)\s*\)/i,
    role: "producer",
    confidence: 0.85,
  },
  {
    pattern: /\[\s*prod(?:uced|uction|ucer|\.)?\s*(?:by|par|:)?\s*([^\]]+?)\s*\]/i,
    role: "producer",
    confidence: 0.85,
  },
];

/** Séparateurs de noms multiples : « X & Y », « X, Y », « X x Y ». */
const NAME_SEPARATOR = /\s*(?:&|,|\/|\+|\bx\b|\bet\b|\band\b|\bfeat\.?\b|\bft\.?\b)\s*/i;

/** Mots qui ne sont jamais un nom de producteur. */
const BLOCKLIST = new Set([
  "prod",
  "prods",
  "produced",
  "producer",
  "production",
  "productions",
  "beat",
  "beats",
  "beatmaker",
  "unknown",
  "inconnu",
  "n/a",
  "na",
  "me",
  "self",
  "moi",
  "various",
  "various artists",
]);

function cleanName(raw: string): string | null {
  let name = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[\s\-–—:.|]+/, "")
    .replace(/[\s\-–—:.|]+$/, "")
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Un « @pseudo » reste un identifiant valide, on retire juste l'arobase.
  name = name.replace(/^@+/, "");

  if (!name) return null;
  if (name.length < 2 || name.length > 60) return null;
  if (/https?:\/\/|www\./i.test(name)) return null;
  // Refuse ce qui n'est que ponctuation ou chiffres.
  if (!/[\p{L}]/u.test(name)) return null;
  if (BLOCKLIST.has(name.toLowerCase())) return null;

  return name;
}

function splitNames(raw: string): string[] {
  // Une URL n'est jamais un crédit : on l'écarte avant de découper sur « / ».
  if (/https?:\/\/|www\./i.test(raw)) return [];

  return raw
    .split(NAME_SEPARATOR)
    .map(cleanName)
    .filter((n): n is string => n !== null);
}

/** Clé de déduplication insensible à la casse, aux accents et aux espaces. */
export function producerKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Lit les crédits de production contenus dans un titre.
 * Ne renvoie jamais de crédit deviné : sans mention explicite, la liste est vide.
 */
export function extractProductionCredits(title: string | null | undefined): TitleCredits {
  const original = String(title ?? "").trim();
  if (!original) return { cleanTitle: "", credits: [] };

  const credits: ExtractedCredit[] = [];
  const seen = new Set<string>();
  let working = original;

  const collect = (names: string[], role: ProductionRole, confidence: number, raw: string) => {
    for (const name of names) {
      const key = `${producerKey(name)}::${role}`;
      if (!producerKey(name) || seen.has(key)) continue;
      seen.add(key);
      credits.push({ name, role, confidence, rawMention: raw.trim() });
    }
  };

  // 1. Mention en fin de titre (le cas le plus courant).
  for (const { pattern, role, confidence } of MENTION_PATTERNS) {
    const match = working.match(pattern);
    if (!match) continue;
    const names = splitNames(match[2] ?? "");
    if (names.length === 0) continue;
    collect(names, role, confidence, match[0]);
    working = working.slice(0, match.index).trim();
    break;
  }

  // 2. Mention entre parenthèses ou crochets au milieu du titre.
  for (const { pattern, role, confidence } of INLINE_PATTERNS) {
    let match = working.match(pattern);
    while (match) {
      const names = splitNames(match[1] ?? "");
      if (names.length > 0) collect(names, role, confidence, match[0]);
      working = (working.slice(0, match.index) + working.slice(match.index! + match[0].length))
        .replace(/\s{2,}/g, " ")
        .trim();
      match = working.match(pattern);
    }
  }

  const cleanTitle =
    working.replace(/[\s\-–—|]+$/, "").trim() || original;

  return { cleanTitle, credits };
}
