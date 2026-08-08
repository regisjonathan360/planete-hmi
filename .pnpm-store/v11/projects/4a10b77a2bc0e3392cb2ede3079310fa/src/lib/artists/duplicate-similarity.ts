export type DuplicateSensitivity = "broad" | "balanced" | "strict";

export interface NameSimilarity {
  score: number;
  reasons: string[];
  normalizedA: string;
  normalizedB: string;
}

const NOISE_WORDS = new Set([
  "artiste",
  "artist",
  "band",
  "dj",
  "haiti",
  "haitian",
  "ht",
  "music",
  "musique",
  "official",
  "officiel",
  "prod",
  "production",
  "productions",
  "records",
  "the",
  "509",
]);

export const DUPLICATE_THRESHOLDS: Record<DuplicateSensitivity, number> = {
  broad: 0.4,
  balanced: 0.52,
  strict: 0.66,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function normalizeArtistName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalizeArtistName(value).split(" ").filter(Boolean);
}

function canonicalTokens(value: string): string[] {
  const original = tokens(value);
  const withoutNoise = original.filter((token) => !NOISE_WORDS.has(token));
  return withoutNoise.length ? withoutNoise : original;
}

function compact(value: string): string {
  return tokens(value).join("");
}

function canonical(value: string): string {
  return canonicalTokens(value).join(" ");
}

function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[a.length][b.length];
}

function editSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - damerauLevenshtein(a, b) / longest : 1;
}

function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);
  const aMatches = Array<boolean>(a.length).fill(false);
  const bMatches = Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - range);
    const end = Math.min(i + range + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  const matchedA = a.split("").filter((_, index) => aMatches[index]);
  const matchedB = b.split("").filter((_, index) => bMatches[index]);
  let transpositions = 0;
  for (let i = 0; i < matchedA.length; i++) {
    if (matchedA[i] !== matchedB[i]) transpositions++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function ngrams(value: string, size = 2): Set<string> {
  const result = new Set<string>();
  if (value.length < size) {
    if (value) result.add(value);
    return result;
  }
  for (let i = 0; i <= value.length - size; i++) result.add(value.slice(i, i + size));
  return result;
}

function diceSimilarity(a: string, b: string): number {
  const left = ngrams(a);
  const right = ngrams(b);
  if (!left.size && !right.size) return 1;
  let common = 0;
  for (const item of left) if (right.has(item)) common++;
  return (2 * common) / (left.size + right.size);
}

function tokenJaccard(a: string, b: string): number {
  const left = new Set(canonicalTokens(a));
  const right = new Set(canonicalTokens(b));
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  let common = 0;
  for (const item of left) if (right.has(item)) common++;
  return common / union.size;
}

function phoneticKey(value: string): string {
  return canonical(value)
    .replace(/\b(?:de|du|la|le|les|of)\b/g, "")
    .replace(/ph/g, "f")
    .replace(/(?:sh|ch|tch)/g, "x")
    .replace(/(?:dj|j|ge|gi)/g, "j")
    .replace(/[ckq]/g, "k")
    .replace(/[sz]/g, "s")
    .replace(/gn/g, "n")
    .replace(/ou/g, "u")
    .replace(/[aeiouy]/g, "")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, "");
}

function initials(value: string): string {
  return canonicalTokens(value).map((token) => token[0]).join("");
}

export function compareArtistNames(nameA: string, nameB: string): NameSimilarity {
  const normalizedA = normalizeArtistName(nameA);
  const normalizedB = normalizeArtistName(nameB);
  const compactA = compact(nameA);
  const compactB = compact(nameB);
  const canonicalA = canonical(nameA);
  const canonicalB = canonical(nameB);
  const canonicalCompactA = canonicalA.replace(/\s/g, "");
  const canonicalCompactB = canonicalB.replace(/\s/g, "");
  const reasons: string[] = [];

  if (!compactA || !compactB) {
    return { score: 0, reasons, normalizedA, normalizedB };
  }
  if (compactA === compactB) {
    return {
      score: 0.99,
      reasons: ["Nom identique après normalisation"],
      normalizedA,
      normalizedB,
    };
  }
  if (canonicalCompactA === canonicalCompactB) {
    return {
      score: 0.96,
      reasons: ["Même nom sans les termes génériques"],
      normalizedA,
      normalizedB,
    };
  }

  const shortestLength = Math.min(canonicalCompactA.length, canonicalCompactB.length);
  if (shortestLength <= 2) {
    return { score: 0, reasons, normalizedA, normalizedB };
  }

  const edit = editSimilarity(canonicalCompactA, canonicalCompactB);
  const jaro = jaroWinkler(canonicalCompactA, canonicalCompactB);
  const dice = diceSimilarity(canonicalCompactA, canonicalCompactB);
  const token = tokenJaccard(nameA, nameB);
  let score = 0.3 * edit + 0.34 * jaro + 0.2 * dice + 0.16 * token;

  if (edit >= 0.72) reasons.push("Orthographe très proche");
  else if (edit >= 0.55) reasons.push("Orthographe partiellement proche");
  if (jaro >= 0.84) reasons.push("Même structure de nom");
  if (token >= 0.5) reasons.push("Plusieurs mots en commun");

  const shorter = canonicalCompactA.length <= canonicalCompactB.length
    ? canonicalCompactA
    : canonicalCompactB;
  const longer = shorter === canonicalCompactA ? canonicalCompactB : canonicalCompactA;
  const isContainedAlias = shorter.length >= 3 && longer.includes(shorter);
  if (isContainedAlias) {
    const lengthRatio = shorter.length / longer.length;
    score = Math.max(score, 0.58 + 0.24 * lengthRatio);
    reasons.push("Un nom est contenu dans l’autre");
  }

  const phoneticA = phoneticKey(nameA);
  const phoneticB = phoneticKey(nameB);
  if (phoneticA.length >= 3 && phoneticA === phoneticB) {
    score = Math.max(score, 0.78);
    reasons.push("Prononciation probablement identique");
  } else if (phoneticA.length >= 4 && phoneticB.length >= 4) {
    const phoneticSimilarity = editSimilarity(phoneticA, phoneticB);
    if (phoneticSimilarity >= 0.72) {
      score = Math.max(score, 0.68 + (phoneticSimilarity - 0.72) * 0.35);
      reasons.push("Prononciation proche");
    }
  }

  const initialsA = initials(nameA);
  const initialsB = initials(nameB);
  if (
    initialsA.length >= 2 &&
    initialsA === initialsB &&
    canonicalTokens(nameA).length > 1 &&
    canonicalTokens(nameB).length > 1
  ) {
    score = Math.max(score, 0.57);
    reasons.push("Mêmes initiales");
  }

  const lengthRatio = shortestLength / Math.max(canonicalCompactA.length, canonicalCompactB.length);
  if (!isContainedAlias && lengthRatio < 0.34 && token === 0) score *= 0.72;
  if (!isContainedAlias && shortestLength <= 4 && edit < 0.75 && token === 0) score *= 0.8;

  return {
    score: Math.round(clamp(score) * 1000) / 1000,
    reasons: [...new Set(reasons)].slice(0, 3),
    normalizedA,
    normalizedB,
  };
}
