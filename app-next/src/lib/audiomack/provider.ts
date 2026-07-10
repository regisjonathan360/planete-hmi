/**
 * Provider selection for Audiomack.
 *
 * Priority:
 * 1. Official OAuth API, when keys are configured.
 * 2. Official public Audiomack Haiti page.
 * 3. Optional mock data only when AUDIOMACK_USE_MOCK=true.
 */
import "server-only";
import type { AudiomackNormalizedEntry, AudiomackRawPlaylist } from "./types";
import { normalizeAudiomackResponse } from "./normalize";
import { fetchAudiomackHaitiChart, hasAudiomackKeys } from "./oauth-client";
import { fetchAudiomackOfficialHaitiChart } from "./official-page";

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

export const oauthProvider: AudiomackProvider = {
  name: "oauth",
  isAvailable: () => hasAudiomackKeys(),
  async fetchChart() {
    const result = await fetchAudiomackHaitiChart();
    if (!result) return { ok: false, entries: [], error: "Cles Audiomack non configurees." };
    if (!result.ok) return { ok: false, entries: [], error: result.error };

    const entries = normalizeAudiomackResponse(result.data as AudiomackRawPlaylist);
    if (!entries.length) return { ok: false, entries: [], error: "Reponse vide." };

    return { ok: true, entries, sourceUpdatedAt: null };
  },
};

export const officialPageProvider: AudiomackProvider = {
  name: "official_page",
  isAvailable: () => true,
  async fetchChart() {
    return fetchAudiomackOfficialHaitiChart();
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
  if (oauthProvider.isAvailable()) return oauthProvider;
  if (mockProvider.isAvailable()) return mockProvider;
  return officialPageProvider;
}
