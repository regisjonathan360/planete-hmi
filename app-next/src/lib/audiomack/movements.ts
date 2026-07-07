/**
 * Calcul des mouvements hebdomadaires pour Audiomack.
 * Compare le snapshot courant au précédent.
 */
import type { AudiomackNormalizedEntry, AudiomackSnapshotEntry } from "./types";
import { trackIdentityKey } from "./normalize";

interface PreviousEntryData {
  rank: number;
  weeksOnChart: number;
  peakRank: number;
}

export function calculateMovements(
  currentEntries: AudiomackNormalizedEntry[],
  previousEntries: AudiomackSnapshotEntry[] | null
): AudiomackSnapshotEntry[] {
  // Indexer le snapshot précédent par clé d'identité
  const prevMap = new Map<string, PreviousEntryData>();
  if (previousEntries) {
    for (const e of previousEntries) {
      const key = trackIdentityKey(e);
      prevMap.set(key, {
        rank: e.rank,
        weeksOnChart: e.weeksOnChart,
        peakRank: e.peakRank,
      });
    }
  }

  return currentEntries.map((entry): AudiomackSnapshotEntry => {
    const key = trackIdentityKey(entry);
    const prev = prevMap.get(key);

    if (!prev) {
      // Nouveau titre
      return {
        ...entry,
        previousRank: null,
        rankChange: null,
        isNew: true,
        weeksOnChart: 1,
        peakRank: entry.rank,
      };
    }

    // Titre existant
    const rankChange = prev.rank - entry.rank;
    return {
      ...entry,
      previousRank: prev.rank,
      rankChange,
      isNew: false,
      weeksOnChart: prev.weeksOnChart + 1,
      peakRank: Math.min(prev.peakRank, entry.rank),
    };
  });
}
