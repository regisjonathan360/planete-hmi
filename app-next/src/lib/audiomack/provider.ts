/**
 * Provider Audiomack.
 *
 * Priorité :
 * 1. API publique Audiomack (api.audiomack.com/v1) — classements officiels
 *    Haïti (Top Songs 100 + charts genre), signés OAuth1 avec les
 *    identifiants publics de l'appli web.
 * 2. Page officielle audiomack.com/top/songs (SSR) — repli si l'API échoue.
 * 3. Mock uniquement si AUDIOMACK_USE_MOCK=true.
 */
import "server-only";
import type { AudiomackNormalizedEntry, AudiomackRawPlaylist } from "./types";
import { normalizeAudiomackResponse } from "./normalize";
import { fetchAudiomackHaitiChart, hasAudiomackKeys } from "./oauth-client";
import { fetchAudiomackOfficialPage } from "./official-page";
import { fetchAudiomackApiChart } from "./public-api";
import { audiomackGenreSourceUrl } from "@/lib/charts/audiomack-sources";

export interface AudiomackProviderResult {
  ok: boolean;
  entries: AudiomackNormalizedEntry[];
  sourceUpdatedAt?: string | null;
  error?: string;
}

export interface AudiomackProvider {
  name: string;
  isAvailable(): boolean;
  fetchChart(): Promise<AudiomackProviderResult>;
}

/**
 * Collecte le classement Audiomack Haïti (100 titres via l'API officielle).
 * @param genreId slug genre (ex. "gospel") — undefined = Top Songs global Haïti.
 * @param sourceUrl URL de la page SSR correspondante (repli).
 */
export async function fetchAudiomackChart(options: { genreId?: string | null; sourceUrl?: string } = {}): Promise<AudiomackProviderResult> {
  const { genreId = null, sourceUrl } = options;

  // 1. API publique officielle (source primaire)
  const api = await fetchAudiomackApiChart({ genre: genreId ?? undefined });
  if (api.ok && api.entries.length > 0) {
    return { ok: true, entries: api.entries, sourceUpdatedAt: api.sourceUpdatedAt ?? null };
  }

  // 2. Repli : page SSR officielle
  const page = await fetchAudiomackOfficialPage(
    sourceUrl ?? (genreId ? audiomackGenreSourceUrl(genreId) : "https://audiomack.com/top/songs?country=haiti")
  );
  if (page.ok && page.entries.length > 0) {
    return { ok: true, entries: page.entries, sourceUpdatedAt: page.sourceUpdatedAt };
  }

  // 3. Erreur : on rapporte le message de la source la plus parlante
  return {
    ok: false,
    entries: [],
    error: api.entries.length === 0 && api.error
      ? api.error
      : page.error ?? "Aucune donnee Audiomack recuperable.",
  };
}

export const oauthProvider: AudiomackProvider = {
  name: "oauth",
  isAvailable: () => hasAudiomackKeys(),
  async fetchChart() {
    const result = await fetchAudiomackHaitiChart();
    if (!result) return { ok: false, entries: [], error: "Cles Audiomack non configurees." };
    if (!result.ok) return { ok: false, entries: [], error: result.error };

    const data = result.data as AudiomackRawPlaylist;
    // L'endpoint playlist renvoie l'objet playlist ; la liste est dans
    // data.results.tracks (Weekly 100: Haiti — 99/100 titres).
    const playlist = (data.results ?? null) as (AudiomackRawPlaylist & { tracks?: unknown }) | null;
    const tracks =
      Array.isArray(data.results)
        ? (data.results as unknown as AudiomackRawPlaylist["results"])
        : Array.isArray(playlist?.tracks)
          ? (playlist?.tracks as AudiomackRawPlaylist["results"])
          : [];

    if (!tracks?.length) return { ok: false, entries: [], error: "Reponse vide." };
    const entries = normalizeAudiomackResponse({ tracks });
    return { ok: true, entries, sourceUpdatedAt: null };
  },
};

export const officialPageProvider: AudiomackProvider = {
  name: "public_api",
  isAvailable: () => true,
  async fetchChart() {
    // Chaîne complète : API publique (100 titres) puis repli SSR.
    return fetchAudiomackChart({});
  },
};

export const mockProvider: AudiomackProvider = {
  name: "mock",
  isAvailable: () => process.env.AUDIOMACK_USE_MOCK === "true",
  async fetchChart() {
    const mockTracks = [
      { title: "Konpa Love", artist: "Demo Artist HT 1", id: "mock-1" },
      { title: "Raboday Fire", artist: "Demo Artist HT 2", id: "mock-2" },
      { title: "Island Vibes", artist: "Demo Artist HT 3", id: "mock-3" },
      { title: "Kreyol Riddim", artist: "Demo Artist HT 4", id: "mock-4" },
      { title: "Port-au-Prince Nights", artist: "Demo Artist HT 5", id: "mock-5" },
    ];

    const entries: AudiomackNormalizedEntry[] = mockTracks.map((track, index) => ({
      platform: "audiomack",
      countryCode: "HT",
      rank: index + 1,
      platformTrackId: track.id,
      title: track.title,
      artistName: track.artist,
      artworkUrl: null,
      artistImageUrl: null,
      sourceTrackUrl: `https://audiomack.com/demo/song/mock-${index + 1}`,
      artistSlug: "demo",
      trackSlug: `mock-${index + 1}`,
      albumName: null,
      genre: "Konpa",
    }));

    return { ok: true, entries, sourceUpdatedAt: null };
  },
};

export function getProvider(): AudiomackProvider {
  if (mockProvider.isAvailable()) return mockProvider;
  // Toujours utiliser la chaîne API → SSR : les clés OAuth privées
  // (env) pointent vers un endpoint obsolète et sont de toute façon
  // supplantées par l'API publique.
  return officialPageProvider;
}
