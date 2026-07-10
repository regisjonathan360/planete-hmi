/**
 * Property-Based Tests — Chart Builder
 *
 * Validates Properties 7–12 from the design document using fast-check.
 * These tests exercise pure functions only (no DB dependency).
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import {
  filterValidatedSounds,
  sortGlobalChart,
  sortEnMonteeChart,
  filterAndSortNouveautes,
  buildChartEntries,
} from "../chart-builder";
import type { TikTokSound } from "../types";

// ---------------------------------------------------------------------------
// Arbitrary — TikTokSound generator
// ---------------------------------------------------------------------------

const soundArb = (
  overrides?: Partial<{
    validation_status: string;
    first_seen_at: string;
    score: number;
    growth_7d: number;
  }>
) =>
  fc.record({
    id: fc.uuid(),
    music_id: fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.trim().length > 0),
    sound_title: fc.string({ minLength: 1, maxLength: 50 }),
    sound_author: fc.option(fc.string({ minLength: 1, maxLength: 30 }), {
      nil: null,
    }),
    total_videos: fc.nat({ max: 10000 }),
    total_views: fc.nat({ max: 10_000_000 }),
    total_likes: fc.nat({ max: 5_000_000 }),
    total_comments: fc.nat({ max: 500_000 }),
    total_shares: fc.nat({ max: 500_000 }),
    unique_creators: fc.nat({ max: 5000 }),
    score:
      overrides?.score !== undefined
        ? fc.constant(overrides.score)
        : fc.float({ min: 0, max: 1, noNaN: true }),
    growth_7d:
      overrides?.growth_7d !== undefined
        ? fc.constant(overrides.growth_7d)
        : fc.float({ min: -100, max: 10000, noNaN: true }),
    previous_total_videos: fc.option(fc.nat({ max: 10000 }), { nil: null }),
    previous_snapshot_at: fc.option(fc.constant("2025-01-01T00:00:00Z"), {
      nil: null,
    }),
    validation_status: fc.constant(
      overrides?.validation_status ?? "valide"
    ) as any,
    first_seen_at: fc.constant(
      overrides?.first_seen_at ?? new Date().toISOString()
    ),
    last_updated_at: fc.constant(new Date().toISOString()),
    artist_id: fc.option(fc.uuid(), { nil: null }),
  }) as fc.Arbitrary<TikTokSound>;

// ---------------------------------------------------------------------------
// Property 7 — filterValidatedSounds
// **Validates: Requirements 5.2**
// ---------------------------------------------------------------------------

describe("Property 7 — filterValidatedSounds: only validated sounds pass", () => {
  it("output only contains sounds with validation_status === 'valide'", () => {
    const statusArb = fc.constantFrom(
      "valide",
      "a_verifier",
      "refuse"
    ) as fc.Arbitrary<"valide" | "a_verifier" | "refuse">;

    const mixedSoundsArb = fc.array(
      statusArb.chain((status) => soundArb({ validation_status: status })),
      { minLength: 0, maxLength: 30 }
    );

    fc.assert(
      fc.property(mixedSoundsArb, (sounds) => {
        const result = filterValidatedSounds(sounds);

        // Every output item must be "valide"
        for (const s of result) {
          expect(s.validation_status).toBe("valide");
        }

        // Count must match the number of "valide" in input
        const expectedCount = sounds.filter(
          (s) => s.validation_status === "valide"
        ).length;
        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8 — sortGlobalChart
// **Validates: Requirements 5.3**
// ---------------------------------------------------------------------------

describe("Property 8 — sortGlobalChart: sorted by score descending", () => {
  it("for consecutive entries i, i+1: score(i) >= score(i+1)", () => {
    const soundsArb = fc.array(soundArb(), { minLength: 0, maxLength: 30 });

    fc.assert(
      fc.property(soundsArb, (sounds) => {
        const sorted = sortGlobalChart(sounds);

        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].score).toBeGreaterThanOrEqual(sorted[i + 1].score);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9 — sortEnMonteeChart
// **Validates: Requirements 5.4**
// ---------------------------------------------------------------------------

describe("Property 9 — sortEnMonteeChart: sorted by growth_7d descending", () => {
  it("for consecutive entries i, i+1: growth_7d(i) >= growth_7d(i+1)", () => {
    const soundsArb = fc.array(soundArb(), { minLength: 0, maxLength: 30 });

    fc.assert(
      fc.property(soundsArb, (sounds) => {
        const sorted = sortEnMonteeChart(sounds);

        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].growth_7d).toBeGreaterThanOrEqual(
            sorted[i + 1].growth_7d
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10 — filterAndSortNouveautes
// **Validates: Requirements 5.5**
// ---------------------------------------------------------------------------

describe("Property 10 — filterAndSortNouveautes: 14-day window filter + score sort", () => {
  it("only sounds with first_seen_at within 14 days are included, sorted by score desc", () => {
    const referenceDate = new Date("2025-06-15T12:00:00Z");
    const windowDays = 14;

    // Generate dates: some within window, some outside
    const recentDateArb = fc.integer({ min: 0, max: 13 }).map((daysAgo) => {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString();
    });

    const oldDateArb = fc.integer({ min: 15, max: 60 }).map((daysAgo) => {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString();
    });

    const dateArb = fc.oneof(recentDateArb, oldDateArb);

    const soundsArb = fc.array(
      dateArb.chain((date) => soundArb({ first_seen_at: date })),
      { minLength: 0, maxLength: 30 }
    );

    fc.assert(
      fc.property(soundsArb, (sounds) => {
        const result = filterAndSortNouveautes(sounds, windowDays, referenceDate);

        const cutoff = new Date(referenceDate);
        cutoff.setDate(cutoff.getDate() - windowDays);

        // All results must have first_seen_at >= cutoff
        for (const s of result) {
          const firstSeen = new Date(s.first_seen_at);
          expect(firstSeen.getTime()).toBeGreaterThanOrEqual(cutoff.getTime());
        }

        // Results must be sorted by score descending
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
        }

        // Count must match expected
        const expectedCount = sounds.filter(
          (s) => new Date(s.first_seen_at) >= cutoff
        ).length;
        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11 — buildChartEntries
// **Validates: Requirements 6.2**
// ---------------------------------------------------------------------------

describe("Property 11 — buildChartEntries: metric_value and metric_unit correctness", () => {
  it("for every entry, metric_value === sound.total_videos and metric_unit === 'posts_count'", () => {
    const soundsArb = fc.array(soundArb(), { minLength: 0, maxLength: 30 });

    fc.assert(
      fc.property(soundsArb, (sounds) => {
        const entries = buildChartEntries(sounds);

        expect(entries.length).toBe(sounds.length);

        for (let i = 0; i < entries.length; i++) {
          expect(entries[i].metric_value).toBe(sounds[i].total_videos);
          expect(entries[i].metric_unit).toBe("posts_count");
          expect(entries[i].source_position).toBe(i + 1);
          expect(entries[i].music_id).toBe(sounds[i].music_id);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12 — HMI Shorts constraints
// **Validates: Requirements 6.3**
// ---------------------------------------------------------------------------

describe("Property 12 — HMI Shorts constraints: max 10 entries, all validated", () => {
  /**
   * Simulates the HMI Shorts constraint: take at most 10 entries
   * from a validated, sorted chart.
   */
  function buildHmiShorts(sounds: TikTokSound[]): TikTokSound[] {
    const validated = filterValidatedSounds(sounds);
    const sorted = sortGlobalChart(validated);
    return sorted.slice(0, 10);
  }

  it("max 10 entries and every entry references a validated sound", () => {
    const statusArb = fc.constantFrom(
      "valide",
      "a_verifier",
      "refuse"
    ) as fc.Arbitrary<"valide" | "a_verifier" | "refuse">;

    const mixedSoundsArb = fc.array(
      statusArb.chain((status) => soundArb({ validation_status: status })),
      { minLength: 0, maxLength: 50 }
    );

    fc.assert(
      fc.property(mixedSoundsArb, (sounds) => {
        const shorts = buildHmiShorts(sounds);

        // Max 10 entries
        expect(shorts.length).toBeLessThanOrEqual(10);

        // Every entry must be validated
        for (const s of shorts) {
          expect(s.validation_status).toBe("valide");
        }
      }),
      { numRuns: 100 }
    );
  });
});
