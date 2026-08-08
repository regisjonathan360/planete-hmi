/**
 * Photo de profil des artistes : résolution de secours.
 *
 * Quand `artists.image_url` est vide, on réutilise la photo de profil d'une des
 * plateformes déjà rattachées à la fiche de l'artiste
 * (`artist_platform_identities.platform_image_url`) ou, à défaut, la miniature
 * de sa chaîne YouTube officielle.
 *
 * L'ordre de préférence est le miroir exact de
 * `public.artist_platform_avatar_rank()` (migration
 * 20260727083000_producers_and_artist_avatars.sql) : toute modification ici doit
 * être répercutée dans le SQL, et inversement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Image utilisée quand aucune plateforme ne fournit de portrait. */
export const ARTIST_IMAGE_PLACEHOLDER =
  "/image/artists/planet-hmi-artist-placeholder-square.webp.webp";

/** Plateformes de la plus fiable à la moins fiable pour un portrait d'artiste. */
export const PLATFORM_AVATAR_PRIORITY = [
  "spotify",
  "apple_music",
  "deezer",
  "audiomack",
  "youtube",
  "youtube_music",
  "tidal",
  "soundcloud",
  "tiktok",
] as const;

const RANK_BY_PLATFORM = new Map<string, number>(
  PLATFORM_AVATAR_PRIORITY.map((platform, index) => [platform, index + 1]),
);

/** Rang d'une plateforme ; les inconnues passent en dernier. */
export function platformAvatarRank(platform: string | null | undefined): number {
  return RANK_BY_PLATFORM.get(String(platform ?? "").trim().toLowerCase()) ?? 50;
}

function isUsableUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

interface AvatarCandidate {
  imageUrl: string;
  rank: number;
  /** 0 = identité vérifiée, 1 = non vérifiée. Trié en premier. */
  unverified: number;
  seenAt: number;
}

function bestOf(candidates: AvatarCandidate[]): string | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      a.unverified - b.unverified || a.rank - b.rank || b.seenAt - a.seenAt,
  )[0].imageUrl;
}

const toTime = (value: unknown): number => {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : 0;
};

/**
 * Résout en une seule passe les photos manquantes d'un lot d'artistes.
 *
 * @returns une Map artistId → URL de photo trouvée. Les artistes déjà pourvus
 *          ou sans aucune plateforme exploitable en sont absents.
 */
export async function resolveFallbackAvatars(
  supabase: SupabaseClient,
  artistIds: readonly string[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const ids = [...new Set(artistIds.filter(isUsableUrl))];
  if (ids.length === 0) return resolved;

  const byArtist = new Map<string, AvatarCandidate[]>();
  const push = (artistId: string, candidate: AvatarCandidate) => {
    const list = byArtist.get(artistId);
    if (list) list.push(candidate);
    else byArtist.set(artistId, [candidate]);
  };

  const [identities, channels] = await Promise.all([
    supabase
      .from("artist_platform_identities")
      .select("artist_id, platform, platform_image_url, is_verified, last_seen_at, created_at")
      .in("artist_id", ids)
      .not("platform_image_url", "is", null),
    supabase
      .from("youtube_channels")
      .select("artist_id, thumbnail_url, is_youtube_verified, updated_at")
      .in("artist_id", ids)
      .eq("is_active", true)
      .not("thumbnail_url", "is", null),
  ]);

  for (const row of identities.data ?? []) {
    if (!isUsableUrl(row.platform_image_url)) continue;
    push(row.artist_id as string, {
      imageUrl: (row.platform_image_url as string).trim(),
      rank: platformAvatarRank(row.platform as string),
      unverified: row.is_verified ? 0 : 1,
      seenAt: toTime(row.last_seen_at ?? row.created_at),
    });
  }

  for (const row of channels.data ?? []) {
    if (!isUsableUrl(row.thumbnail_url) || !row.artist_id) continue;
    push(row.artist_id as string, {
      imageUrl: (row.thumbnail_url as string).trim(),
      rank: platformAvatarRank("youtube"),
      unverified: row.is_youtube_verified ? 0 : 1,
      seenAt: toTime(row.updated_at),
    });
  }

  for (const [artistId, candidates] of byArtist) {
    const best = bestOf(candidates);
    if (best) resolved.set(artistId, best);
  }

  return resolved;
}

/**
 * Complète `imageUrl` sur une liste d'artistes en interrogeant les plateformes
 * seulement pour ceux dont la photo manque.
 */
export async function withFallbackAvatars<T extends { id: string; imageUrl: string | null }>(
  supabase: SupabaseClient,
  artists: T[],
): Promise<T[]> {
  const missing = artists.filter((a) => !isUsableUrl(a.imageUrl)).map((a) => a.id);
  if (missing.length === 0) return artists;

  const resolved = await resolveFallbackAvatars(supabase, missing);
  if (resolved.size === 0) return artists;

  return artists.map((artist) =>
    isUsableUrl(artist.imageUrl)
      ? artist
      : { ...artist, imageUrl: resolved.get(artist.id) ?? null },
  );
}

/** URL affichable : photo de la fiche, sinon secours plateforme, sinon placeholder. */
export function artistAvatarSrc(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    if (isUsableUrl(candidate)) return candidate.trim();
  }
  return ARTIST_IMAGE_PLACEHOLDER;
}
