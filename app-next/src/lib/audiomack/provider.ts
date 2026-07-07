/**
 * Système de providers pour Audiomack.
 * Permet de basculer entre :
 *  - AudiomackOAuthProvider (API officielle OAuth 1.0a)
 *  - MockAudiomackProvider (développement/démo)
 *  - ManualAudiomackProvider (import JSON validé)
 * sans modifier les composants React.
 */
import "server-only";
import type { AudiomackNormalizedEntry, AudiomackRawPlaylist } from "./types";
import { normalizeAudiomackResponse } from "./normalize";
import { fetchAudiomackHaitiChart, hasAudiomackKeys } from "./oauth-client";

export interface AudiomackProvider {
  name: string;
  isAvailable(): boolean;
  fetchChart(): Promise<{ ok: boolean; entries: AudiomackNormalizedEntry[]; error?: string }>;
}

/** Provider officiel OAuth 1.0a */
export const oauthProvider: AudiomackProvider = {
  name: "oauth",
  isAvailable: () => hasAudiomackKeys(),
  async fetchChart() {
    const result = await fetchAudiomackHaitiChart();
    if (!result) return { ok: false, entries: [], error: "Clés Audiomack non configurées." };
    if (!result.ok) return { ok: false, entries: [], error: result.error };
    const entries = normalizeAudiomackResponse(result.data as AudiomackRawPlaylist);
    if (!entries.length) return { ok: false, entries: [], error: "Réponse vide." };
    return { ok: true, entries };
  },
};

/** Provider mock (développement) — génère des données fictives */
export const mockProvider: AudiomackProvider = {
  name: "mock",
  isAvailable: () => true,
  async fetchChart() {
    const mockTracks = [
      { title: "Konpa Love", artist: "Demo Artist HT 1", id: "mock-1" },
      { title: "Raboday Fire", artist: "Demo Artist HT 2", id: "mock-2" },
      { title: "Island Vibes", artist: "Demo Artist HT 3", id: "mock-3" },
      { title: "Kreyòl Riddim", artist: "Demo Artist HT 4", id: "mock-4" },
      { title: "Port-au-Prince Nights", artist: "Demo Artist HT 5", id: "mock-5" },
    ];
    const entries: AudiomackNormalizedEntry[] = mockTracks.map((t, i) => ({
      platform: "audiomack",
      countryCode: "HT",
      rank: i + 1,
      platformTrackId: t.id,
      title: t.title,
      artistName: t.artist,
      artworkUrl: null,
      sourceTrackUrl: `https://audiomack.com/demo/song/mock-${i + 1}`,
      artistSlug: "demo",
      trackSlug: `mock-${i + 1}`,
      albumName: null,
      genre: "Konpa",
    }));
    return { ok: true, entries };
  },
};

/** Sélectionne le provider approprié. */
export function getProvider(): AudiomackProvider {
  if (oauthProvider.isAvailable()) return oauthProvider;
  return mockProvider;
}
