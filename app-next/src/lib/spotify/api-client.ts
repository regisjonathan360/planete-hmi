/**
 * Client Spotify Web API — flux « client credentials ».
 *
 * Périmètre volontairement restreint à l'ENRICHISSEMENT : retrouver le profil
 * Spotify d'un artiste (identifiant, portrait, lien, genres) et lire les
 * métadonnées publiques d'un titre. Aucune métrique d'écoute n'est lue ni
 * fabriquée, conformément à l'adaptateur de classement Spotify.
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

export interface SpotifyArtistProfile {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  followers: number | null;
  genres: string[];
  /** 0 → 1 : proximité entre le nom cherché et le nom trouvé. */
  matchConfidence: number;
}

export class SpotifyNotConfiguredError extends Error {
  constructor() {
    super("Spotify non configuré : SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET sont requis.");
    this.name = "SpotifyNotConfiguredError";
  }
}

export function isSpotifyConfigured(): boolean {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Jeton applicatif, mis en cache jusqu'à 30 s avant son expiration. */
export async function getSpotifyAccessToken(): Promise<string> {
  if (!isSpotifyConfigured()) throw new SpotifyNotConfiguredError();
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Authentification Spotify refusée (HTTP ${response.status}).`);
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Réponse Spotify sans jeton d'accès.");

  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + Math.max(30, (json.expires_in ?? 3600) - 30) * 1000,
  };
  return cachedToken.value;
}

/** Réinitialise le cache de jeton (utile en test). */
export function resetSpotifyTokenCache(): void {
  cachedToken = null;
}

async function spotifyGet<T>(path: string): Promise<T | null> {
  const token = await getSpotifyAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
    throw new Error(`Quota Spotify atteint, réessayez dans ${retryAfter}s.`);
  }
  if (!response.ok) throw new Error(`Spotify a répondu HTTP ${response.status}.`);

  return (await response.json()) as T;
}

/** Normalisation servant à comparer deux noms d'artistes. */
export function normalizeArtistName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(dj|mc|prod|official)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Similarité 0 → 1 entre deux noms (égalité, inclusion, puis Jaccard 2-grammes). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeArtistName(a);
  const nb = normalizeArtistName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const grams = (value: string) => {
    const set = new Set<string>();
    for (let i = 0; i < value.length - 1; i++) set.add(value.slice(i, i + 2));
    return set;
  };
  const ga = grams(na);
  const gb = grams(nb);
  if (ga.size === 0 || gb.size === 0) return 0;

  let shared = 0;
  for (const gram of ga) if (gb.has(gram)) shared++;
  return shared / (ga.size + gb.size - shared);
}

interface SpotifySearchResponse {
  artists?: {
    items?: {
      id: string;
      name: string;
      external_urls?: { spotify?: string };
      images?: { url: string; width?: number }[];
      followers?: { total?: number };
      genres?: string[];
    }[];
  };
}

/**
 * Cherche le profil Spotify d'un artiste par son nom.
 *
 * @param minConfidence seuil sous lequel aucun résultat n'est retenu. Un nom
 *        approximatif vaut mieux ignoré qu'associé au mauvais artiste.
 */
export async function searchSpotifyArtist(
  name: string,
  minConfidence = 0.72,
): Promise<SpotifyArtistProfile | null> {
  const query = name.trim();
  if (!query) return null;

  const data = await spotifyGet<SpotifySearchResponse>(
    `/search?type=artist&limit=5&q=${encodeURIComponent(query)}`,
  );
  const items = data?.artists?.items ?? [];
  if (items.length === 0) return null;

  let best: SpotifyArtistProfile | null = null;
  for (const item of items) {
    const confidence = nameSimilarity(query, item.name);
    if (confidence < minConfidence) continue;
    if (best && confidence <= best.matchConfidence) continue;

    // Spotify trie les images du plus grand au plus petit.
    const image = item.images?.[0]?.url ?? null;
    best = {
      id: item.id,
      name: item.name,
      url: item.external_urls?.spotify ?? `https://open.spotify.com/artist/${item.id}`,
      imageUrl: image,
      followers: item.followers?.total ?? null,
      genres: item.genres ?? [],
      matchConfidence: Number(confidence.toFixed(2)),
    };
  }

  return best;
}

interface SpotifyTrackResponse {
  id: string;
  name: string;
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
  album?: {
    name?: string;
    release_date?: string;
    images?: { url: string }[];
  };
  artists?: { id: string; name: string }[];
}

export interface SpotifyTrackDetails {
  id: string;
  title: string;
  isrc: string | null;
  url: string;
  albumName: string | null;
  releaseDate: string | null;
  artworkUrl: string | null;
  artists: { id: string; name: string }[];
}

/** Métadonnées publiques d'un titre. Renvoie null si l'identifiant est inconnu. */
export async function getSpotifyTrack(trackId: string): Promise<SpotifyTrackDetails | null> {
  const id = trackId.trim();
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return null;

  const data = await spotifyGet<SpotifyTrackResponse>(`/tracks/${id}`);
  if (!data) return null;

  return {
    id: data.id,
    title: data.name,
    isrc: data.external_ids?.isrc ?? null,
    url: data.external_urls?.spotify ?? `https://open.spotify.com/track/${data.id}`,
    albumName: data.album?.name ?? null,
    releaseDate: data.album?.release_date ?? null,
    artworkUrl: data.album?.images?.[0]?.url ?? null,
    artists: (data.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
  };
}
