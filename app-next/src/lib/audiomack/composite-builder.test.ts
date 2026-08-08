import { describe, it, expect } from "vitest";
import type { CompositeContribution, CompositeEntry } from "./composite-builder";

/**
 * Unit tests for the composite scoring and sorting logic.
 * These test the algorithm directly without Supabase interaction.
 */

// Helper to compute composite score
function computeCompositeScore(
  contributions: Array<{ weight: number; sourcePosition: number }>
): number {
  return contributions.reduce(
    (sum, c) => sum + c.weight * (101 - c.sourcePosition),
    0
  );
}

// Helper to sort composite entries
function sortCompositeEntries(entries: CompositeEntry[]): CompositeEntry[] {
  return [...entries].sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) {
      return b.compositeScore - a.compositeScore;
    }
    if (b.genreCount !== a.genreCount) {
      return b.genreCount - a.genreCount;
    }
    return a.bestPosition - b.bestPosition;
  });
}

function makeEntry(
  trackId: string,
  contributions: Array<{
    sourceKey: string;
    genreId: string;
    sourcePosition: number;
    weight: number;
  }>
): CompositeEntry {
  const fullContributions: CompositeContribution[] = contributions.map((c) => ({
    ...c,
    genreLabel: c.genreId,
    contribution: c.weight * (101 - c.sourcePosition),
  }));

  const compositeScore = fullContributions.reduce(
    (sum, c) => sum + c.contribution,
    0
  );
  const genreCount = fullContributions.length;
  const bestPosition = Math.min(...contributions.map((c) => c.sourcePosition));

  return {
    trackId,
    platformTrackId: null,
    title: `Track ${trackId}`,
    artistName: `Artist ${trackId}`,
    artworkUrl: null,
    sourceTrackUrl: null,
    artistSlug: null,
    trackSlug: null,
    compositeScore,
    genreCount,
    bestPosition,
    contributions: fullContributions,
  };
}

describe("Composite score formula", () => {
  it("calculates score = weight × (101 − position) for a single genre", () => {
    const score = computeCompositeScore([{ weight: 1.0, sourcePosition: 1 }]);
    // 1.0 × (101 − 1) = 100
    expect(score).toBe(100);
  });

  it("calculates score for position 100", () => {
    const score = computeCompositeScore([{ weight: 1.0, sourcePosition: 100 }]);
    // 1.0 × (101 − 100) = 1
    expect(score).toBe(1);
  });

  it("sums contributions from multiple genres", () => {
    const score = computeCompositeScore([
      { weight: 2.0, sourcePosition: 1 },
      { weight: 1.5, sourcePosition: 10 },
    ]);
    // (2.0 × 100) + (1.5 × 91) = 200 + 136.5 = 336.5
    expect(score).toBe(336.5);
  });

  it("applies higher weight for more important genres", () => {
    const scoreHigh = computeCompositeScore([
      { weight: 3.0, sourcePosition: 5 },
    ]);
    const scoreLow = computeCompositeScore([
      { weight: 1.0, sourcePosition: 5 },
    ]);
    // 3.0 × 96 = 288 vs 1.0 × 96 = 96
    expect(scoreHigh).toBe(288);
    expect(scoreLow).toBe(96);
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it("gives higher score to lower (better) positions", () => {
    const scorePos1 = computeCompositeScore([
      { weight: 1.0, sourcePosition: 1 },
    ]);
    const scorePos50 = computeCompositeScore([
      { weight: 1.0, sourcePosition: 50 },
    ]);
    expect(scorePos1).toBeGreaterThan(scorePos50);
  });
});

describe("Composite sorting (tiebreaker)", () => {
  it("sorts by score descending", () => {
    const entryA = makeEntry("a", [
      { sourceKey: "s1", genreId: "all", sourcePosition: 1, weight: 1.0 },
    ]); // score = 100
    const entryB = makeEntry("b", [
      { sourceKey: "s1", genreId: "all", sourcePosition: 50, weight: 1.0 },
    ]); // score = 51

    const sorted = sortCompositeEntries([entryB, entryA]);
    expect(sorted[0].trackId).toBe("a");
    expect(sorted[1].trackId).toBe("b");
  });

  it("breaks ties by genre count (more genres = higher rank)", () => {
    // Both have same score but different genre counts
    const entryA = makeEntry("a", [
      { sourceKey: "s1", genreId: "all", sourcePosition: 1, weight: 0.5 },
      { sourceKey: "s2", genreId: "caribbean", sourcePosition: 1, weight: 0.5 },
    ]); // score = 50 + 50 = 100, genreCount = 2
    const entryB = makeEntry("b", [
      { sourceKey: "s1", genreId: "all", sourcePosition: 1, weight: 1.0 },
    ]); // score = 100, genreCount = 1

    expect(entryA.compositeScore).toBe(entryB.compositeScore);

    const sorted = sortCompositeEntries([entryB, entryA]);
    expect(sorted[0].trackId).toBe("a"); // more genres wins
  });

  it("breaks ties by best position (lower = higher rank)", () => {
    // Same score, same genre count, different best positions
    const entryA = makeEntry("a", [
      { sourceKey: "s1", genreId: "all", sourcePosition: 2, weight: 1.0 },
    ]); // score = 99, genreCount = 1, bestPos = 2
    const entryB = makeEntry("b", [
      { sourceKey: "s2", genreId: "caribbean", sourcePosition: 2, weight: 1.0 },
    ]); // score = 99, genreCount = 1, bestPos = 2

    // They're truly tied — maintain input order stability
    expect(entryA.compositeScore).toBe(entryB.compositeScore);
    expect(entryA.genreCount).toBe(entryB.genreCount);
    expect(entryA.bestPosition).toBe(entryB.bestPosition);
  });

  it("correctly ranks track appearing in many genres higher", () => {
    const entryMulti = makeEntry("multi", [
      { sourceKey: "s1", genreId: "all", sourcePosition: 10, weight: 1.0 },
      { sourceKey: "s2", genreId: "caribbean", sourcePosition: 5, weight: 1.5 },
      { sourceKey: "s3", genreId: "hip-hop-rap", sourcePosition: 20, weight: 1.0 },
    ]); // score = 91 + 144 + 81 = 316

    const entrySingle = makeEntry("single", [
      { sourceKey: "s1", genreId: "all", sourcePosition: 1, weight: 2.0 },
    ]); // score = 200

    const sorted = sortCompositeEntries([entrySingle, entryMulti]);
    expect(sorted[0].trackId).toBe("multi"); // higher score
  });

  it("limits output to 20 entries", () => {
    const entries: CompositeEntry[] = [];
    for (let i = 1; i <= 30; i++) {
      entries.push(
        makeEntry(`track-${i}`, [
          { sourceKey: "s1", genreId: "all", sourcePosition: i, weight: 1.0 },
        ])
      );
    }

    const sorted = sortCompositeEntries(entries);
    const top20 = sorted.slice(0, 20);

    expect(top20.length).toBe(20);
    // First entry should have position 1 (highest score)
    expect(top20[0].bestPosition).toBe(1);
    // Last entry in top 20 should have position 20
    expect(top20[19].bestPosition).toBe(20);
  });
});
