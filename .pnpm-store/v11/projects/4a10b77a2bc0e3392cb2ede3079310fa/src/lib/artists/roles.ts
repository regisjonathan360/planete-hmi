export const ARTIST_TYPES = [
  "artist",
  "group",
  "producer",
  "beatmaker",
  "dj",
  "musician",
  "singer",
  "rapper",
] as const;

export type ArtistType = (typeof ARTIST_TYPES)[number];

export const CATEGORY_ROLE_TAG: Record<Exclude<ArtistType, "artist" | "beatmaker">, string> = {
  group: "groupe",
  producer: "beatmaker",
  dj: "dj",
  musician: "musicien",
  singer: "chanteur",
  rapper: "rappeur",
};

const ROLE_ALIASES: Record<string, string> = {
  chanteur: "chanteur",
  chanteuse: "chanteur",
  singer: "chanteur",
  vocalist: "chanteur",
  rappeur: "rappeur",
  rappeuse: "rappeur",
  rapper: "rappeur",
  beatmaker: "beatmaker",
  producteur: "beatmaker",
  productrice: "beatmaker",
  producer: "beatmaker",
  co_producer: "beatmaker",
  executive_producer: "beatmaker",
  groupe: "groupe",
  group: "groupe",
  orchestre: "groupe",
  dj: "dj",
  musicien: "musicien",
  musicienne: "musicien",
  musician: "musicien",
  instrumentiste: "musicien",
  animateur: "animateur",
  animatrice: "animateur",
  ambianceur: "animateur",
  host: "animateur",
  mc: "animateur",
  auteur: "auteur_compositeur",
  autrice: "auteur_compositeur",
  compositeur: "auteur_compositeur",
  compositrice: "auteur_compositeur",
  auteur_compositeur: "auteur_compositeur",
};

function roleKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeArtistRoleTag(value: string): string {
  const key = roleKey(value);
  return ROLE_ALIASES[key] ?? key;
}

export function canonicalizeArtistRoles(tags: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== "string" || !tag.trim()) continue;
    const normalized = normalizeArtistRoleTag(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function roleTagForArtistType(type: ArtistType): string | null {
  if (type === "artist") return null;
  if (type === "beatmaker") return "beatmaker";
  return CATEGORY_ROLE_TAG[type];
}

export function artistTypeFromRoles(tags: readonly string[]): ArtistType {
  const roles = new Set(canonicalizeArtistRoles(tags));
  if (roles.has("groupe")) return "group";
  if (roles.has("beatmaker")) return "producer";
  if (roles.has("dj")) return "dj";
  if (roles.has("musicien")) return "musician";
  if (roles.has("rappeur")) return "rapper";
  if (roles.has("chanteur")) return "singer";
  return "artist";
}

export function synchronizeArtistRoleFields(
  artistType: ArtistType,
  tags: readonly string[],
): { artistType: ArtistType; tags: string[] } {
  const canonicalTags = canonicalizeArtistRoles(tags);
  const requiredTag = roleTagForArtistType(artistType);

  if (requiredTag && !canonicalTags.includes(requiredTag)) {
    canonicalTags.push(requiredTag);
  }

  return {
    artistType: artistType === "artist" ? artistTypeFromRoles(canonicalTags) : artistType,
    tags: canonicalTags,
  };
}
