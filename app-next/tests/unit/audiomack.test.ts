import { describe, it, expect } from "vitest";
import { normalizeAudiomackResponse, trackIdentityKey } from "../../src/lib/audiomack/normalize";
import { calculateMovements } from "../../src/lib/audiomack/movements";
import { validateEntries } from "../../src/lib/audiomack/schemas";
import type { AudiomackSnapshotEntry } from "../../src/lib/audiomack/types";

const MOCK_RAW = {
  results: [
    { id: "111", title: "Konpa Love", artist: "Artist A", image: "https://img.am/1.jpg", artist_url_slug: "artist-a", url_slug: "konpa-love" },
    { id: "222", title: "Raboday Fire", artist: "Artist B", image: "https://img.am/2.jpg", artist_url_slug: "artist-b", url_slug: "raboday-fire" },
    { id: "333", title: "Island Vibes", artist: "Artist C", image: null, artist_url_slug: "artist-c", url_slug: "island-vibes" },
  ],
};

describe("normalizeAudiomackResponse", () => {
  it("normalise une réponse valide", () => {
    const entries = normalizeAudiomackResponse(MOCK_RAW);
    expect(entries).toHaveLength(3);
    expect(entries[0].rank).toBe(1);
    expect(entries[0].title).toBe("Konpa Love");
    expect(entries[0].platformTrackId).toBe("111");
    expect(entries[0].sourceTrackUrl).toBe("https://audiomack.com/artist-a/song/konpa-love");
  });

  it("gère une réponse vide", () => {
    expect(normalizeAudiomackResponse({ results: [] })).toHaveLength(0);
    expect(normalizeAudiomackResponse({})).toHaveLength(0);
  });
});

describe("validateEntries", () => {
  it("rejette une réponse vide", () => {
    const { valid, errors } = validateEntries([]);
    expect(valid).toBe(false);
    expect(errors).toContain("Aucun morceau dans la réponse.");
  });

  it("rejette les rangs dupliqués", () => {
    const entries = normalizeAudiomackResponse(MOCK_RAW);
    entries[1].rank = 1; // doublon
    const { valid, errors } = validateEntries(entries);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("dupliqué"))).toBe(true);
  });

  it("valide des entrées correctes", () => {
    const entries = normalizeAudiomackResponse(MOCK_RAW);
    const { valid } = validateEntries(entries);
    expect(valid).toBe(true);
  });
});

describe("calculateMovements", () => {
  const current = normalizeAudiomackResponse(MOCK_RAW);

  it("détecte un nouveau titre (pas de précédent)", () => {
    const result = calculateMovements(current, null);
    expect(result[0].isNew).toBe(true);
    expect(result[0].rankChange).toBeNull();
    expect(result[0].weeksOnChart).toBe(1);
    expect(result[0].peakRank).toBe(1);
  });

  it("calcule une hausse", () => {
    const prev: AudiomackSnapshotEntry[] = [{
      ...current[0], rank: 5, previousRank: null, rankChange: null, isNew: false, weeksOnChart: 2, peakRank: 3,
    }];
    // current[0] est rang 1, prev était rang 5 => hausse de 4
    const result = calculateMovements([current[0]], prev);
    expect(result[0].rankChange).toBe(4); // 5 - 1 = 4
    expect(result[0].isNew).toBe(false);
    expect(result[0].weeksOnChart).toBe(3);
  });

  it("calcule une baisse", () => {
    const prev: AudiomackSnapshotEntry[] = [{
      ...current[0], rank: 1, previousRank: null, rankChange: null, isNew: false, weeksOnChart: 3, peakRank: 1,
    }];
    const modCurrent = [{ ...current[0], rank: 4 }];
    const result = calculateMovements(modCurrent, prev);
    expect(result[0].rankChange).toBe(-3); // 1 - 4 = -3
  });

  it("détecte une position stable", () => {
    const prev: AudiomackSnapshotEntry[] = [{
      ...current[0], rank: 1, previousRank: null, rankChange: null, isNew: false, weeksOnChart: 1, peakRank: 1,
    }];
    const result = calculateMovements([current[0]], prev);
    expect(result[0].rankChange).toBe(0);
  });

  it("calcule weeks_on_chart (incrémenté)", () => {
    const prev: AudiomackSnapshotEntry[] = [{
      ...current[0], rank: 2, previousRank: null, rankChange: null, isNew: false, weeksOnChart: 5, peakRank: 1,
    }];
    const result = calculateMovements([current[0]], prev);
    expect(result[0].weeksOnChart).toBe(6);
  });

  it("calcule peak_rank (min du précédent et actuel)", () => {
    const prev: AudiomackSnapshotEntry[] = [{
      ...current[0], rank: 3, previousRank: null, rankChange: null, isNew: false, weeksOnChart: 2, peakRank: 2,
    }];
    // current[0].rank = 1, prev peak = 2 => new peak = 1
    const result = calculateMovements([current[0]], prev);
    expect(result[0].peakRank).toBe(1);
  });
});

describe("trackIdentityKey", () => {
  it("priorité : platformTrackId > slug > texte", () => {
    expect(trackIdentityKey({ platformTrackId: "123", artistSlug: "a", trackSlug: "b", artistName: "X", title: "Y" })).toBe("id:123");
    expect(trackIdentityKey({ platformTrackId: null, artistSlug: "a", trackSlug: "b", artistName: "X", title: "Y" })).toBe("slug:a/b");
    expect(trackIdentityKey({ platformTrackId: null, artistSlug: null, trackSlug: null, artistName: "X", title: "Y" })).toBe("text:x|y");
  });
});
