/**
 * Property-based tests for the TikTok Score Engine.
 *
 * Validates:
 * - Property 3: Score computation respects weighted formula
 * - Property 4: 7-day growth formula correctness
 * - Property 5: Creator diversity equals distinct username count
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  computeGrowth7d,
  computeCreatorDiversity,
  normalizeMinMax,
  computeCompositeScore,
  MAX_GROWTH_VALUE,
} from "../score-engine";
import type { SoundMetrics, MetricRanges } from "../score-engine";

const NUM_RUNS = 100;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates valid SoundMetrics */
const arbSoundMetrics = (): fc.Arbitrary<SoundMetrics> =>
  fc.record({
    totalVideos: fc.nat(),
    totalViews: fc.integer({ min: 0, max: 10_000_000 }),
    totalLikes: fc.integer({ min: 0, max: 10_000_000 }),
    totalComments: fc.nat(),
    totalShares: fc.nat(),
    growth7d: fc.float({ min: Math.fround(-100), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true }),
    creatorDiversity: fc.nat(),
  });

/** Generates MetricRanges where max >= min for each field */
const arbMetricRanges = (): fc.Arbitrary<MetricRanges> => {
  const arbRange = () =>
    fc
      .tuple(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 })
      )
      .map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) }));

  return fc.record({
    totalVideos: arbRange(),
    totalViews: arbRange(),
    totalLikes: arbRange(),
    totalComments: arbRange(),
    totalShares: arbRange(),
    growth7d: arbRange(),
    creatorDiversity: arbRange(),
  });
};

/** Generates positive coefficients summing roughly to a weight vector */
const arbCoefficients = () =>
  fc.record({
    videoCount: fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    totalViews: fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    totalLikes: fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    totalComments: fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    totalShares: fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    growth7d: fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    creatorDiversity: fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
  });

// ---------------------------------------------------------------------------
// Property 3: Score computation respects weighted formula
// **Validates: Requirements 3.2**
// ---------------------------------------------------------------------------

describe("Property 3: Score computation respects weighted formula", () => {
  it("score equals sum of coefficient * normalizeMinMax(metric) for each dimension", () => {
    fc.assert(
      fc.property(arbSoundMetrics(), arbMetricRanges(), arbCoefficients(), (metrics, ranges, coefficients) => {
        const score = computeCompositeScore(metrics, ranges, coefficients);

        // Manually compute expected score
        const expected =
          coefficients.videoCount * normalizeMinMax(metrics.totalVideos, ranges.totalVideos.min, ranges.totalVideos.max) +
          coefficients.totalViews * normalizeMinMax(metrics.totalViews, ranges.totalViews.min, ranges.totalViews.max) +
          coefficients.totalLikes * normalizeMinMax(metrics.totalLikes, ranges.totalLikes.min, ranges.totalLikes.max) +
          coefficients.totalComments * normalizeMinMax(metrics.totalComments, ranges.totalComments.min, ranges.totalComments.max) +
          coefficients.totalShares * normalizeMinMax(metrics.totalShares, ranges.totalShares.min, ranges.totalShares.max) +
          coefficients.growth7d * normalizeMinMax(metrics.growth7d, ranges.growth7d.min, ranges.growth7d.max) +
          coefficients.creatorDiversity * normalizeMinMax(metrics.creatorDiversity, ranges.creatorDiversity.min, ranges.creatorDiversity.max);

        expect(score).toBeCloseTo(expected, 10);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("increasing any single metric (others fixed) SHALL NOT decrease the score", () => {
    fc.assert(
      fc.property(
        arbSoundMetrics(),
        arbCoefficients(),
        fc.integer({ min: 0, max: 6 }), // index of metric to increase
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true }), // delta
        (baseMetrics, coefficients, metricIndex, delta) => {
          const metricKeys: (keyof SoundMetrics)[] = [
            "totalVideos",
            "totalViews",
            "totalLikes",
            "totalComments",
            "totalShares",
            "growth7d",
            "creatorDiversity",
          ];
          const key = metricKeys[metricIndex];

          // Build ranges that span both original and increased value
          const increased = { ...baseMetrics, [key]: baseMetrics[key] + delta };

          // Ranges must encompass both values for fair comparison
          const makeRange = (k: keyof SoundMetrics) => ({
            min: Math.min(baseMetrics[k], increased[k], 0),
            max: Math.max(baseMetrics[k], increased[k], 1),
          });

          const ranges: MetricRanges = {
            totalVideos: makeRange("totalVideos"),
            totalViews: makeRange("totalViews"),
            totalLikes: makeRange("totalLikes"),
            totalComments: makeRange("totalComments"),
            totalShares: makeRange("totalShares"),
            growth7d: makeRange("growth7d"),
            creatorDiversity: makeRange("creatorDiversity"),
          };

          const scoreBefore = computeCompositeScore(baseMetrics, ranges, coefficients);
          const scoreAfter = computeCompositeScore(increased, ranges, coefficients);

          // Score should not decrease when a metric increases (positive coefficients)
          expect(scoreAfter).toBeGreaterThanOrEqual(scoreBefore - 1e-10);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: 7-day growth formula correctness
// **Validates: Requirements 3.3**
// ---------------------------------------------------------------------------

describe("Property 4: 7-day growth formula correctness", () => {
  it("for P > 0: growth = ((C - P) / P) * 100", () => {
    fc.assert(
      fc.property(
        fc.nat(), // current >= 0
        fc.integer({ min: 1, max: 10_000_000 }), // previous > 0
        (current, previous) => {
          const result = computeGrowth7d(current, previous);
          const expected = ((current - previous) / previous) * 100;
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("for P = 0, C > 0: growth = MAX_GROWTH_VALUE", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }), // current > 0
        (current) => {
          const result = computeGrowth7d(current, 0);
          expect(result).toBe(MAX_GROWTH_VALUE);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("for P = 0, C = 0: growth = 0", () => {
    const result = computeGrowth7d(0, 0);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property 5: Creator diversity equals distinct username count
// **Validates: Requirements 3.4**
// ---------------------------------------------------------------------------

describe("Property 5: Creator diversity equals distinct username count", () => {
  it("unique_creators = count of distinct usernames in the video set", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 50 }),
        (usernames) => {
          const videos = usernames.map((u) => ({ username: u }));
          const result = computeCreatorDiversity(videos);
          const expected = new Set(usernames).size;
          expect(result).toBe(expected);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("duplicate usernames do not increase diversity count", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 2, max: 20 }), // repeat count
        (username, repeatCount) => {
          const videos = Array.from({ length: repeatCount }, () => ({ username }));
          const result = computeCreatorDiversity(videos);
          expect(result).toBe(1);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
