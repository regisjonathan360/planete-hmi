import { describe, it, expect } from "vitest";
import {
  computeScoreStats,
  DEFAULT_COEFFICIENTS,
} from "./reclassification-engine";

describe("computeScoreStats", () => {
  it("computes score with default coefficients", () => {
    const metrics = { plays: 1000, likes: 50, reposts: 20 };
    // Score = (1000 × 1.0) + (50 × 5.0) + (20 × 3.0) = 1000 + 250 + 60 = 1310
    expect(computeScoreStats(metrics, DEFAULT_COEFFICIENTS)).toBe(1310);
  });

  it("returns 0 for zero metrics", () => {
    const metrics = { plays: 0, likes: 0, reposts: 0 };
    expect(computeScoreStats(metrics, DEFAULT_COEFFICIENTS)).toBe(0);
  });

  it("applies custom coefficients correctly", () => {
    const metrics = { plays: 500, likes: 100, reposts: 50 };
    const coefficients = { plays: 2.0, likes: 10.0, reposts: 4.0 };
    // Score = (500 × 2.0) + (100 × 10.0) + (50 × 4.0) = 1000 + 1000 + 200 = 2200
    expect(computeScoreStats(metrics, coefficients)).toBe(2200);
  });

  it("handles large play counts", () => {
    const metrics = { plays: 10_000_000, likes: 500_000, reposts: 100_000 };
    // Score = (10M × 1.0) + (500K × 5.0) + (100K × 3.0) = 10M + 2.5M + 300K = 12,800,000
    expect(computeScoreStats(metrics, DEFAULT_COEFFICIENTS)).toBe(12_800_000);
  });

  it("handles zero coefficients", () => {
    const metrics = { plays: 1000, likes: 500, reposts: 200 };
    const coefficients = { plays: 0, likes: 0, reposts: 0 };
    expect(computeScoreStats(metrics, coefficients)).toBe(0);
  });

  it("handles fractional coefficients", () => {
    const metrics = { plays: 100, likes: 100, reposts: 100 };
    const coefficients = { plays: 0.5, likes: 2.5, reposts: 1.5 };
    // Score = (100 × 0.5) + (100 × 2.5) + (100 × 1.5) = 50 + 250 + 150 = 450
    expect(computeScoreStats(metrics, coefficients)).toBe(450);
  });

  it("weights likes higher than plays by default", () => {
    // With equal raw values, likes should contribute more
    const metricsA = { plays: 100, likes: 0, reposts: 0 };
    const metricsB = { plays: 0, likes: 100, reposts: 0 };
    const scoreA = computeScoreStats(metricsA, DEFAULT_COEFFICIENTS);
    const scoreB = computeScoreStats(metricsB, DEFAULT_COEFFICIENTS);
    // plays coefficient = 1.0, likes coefficient = 5.0
    expect(scoreB).toBeGreaterThan(scoreA);
    expect(scoreA).toBe(100); // 100 × 1.0
    expect(scoreB).toBe(500); // 100 × 5.0
  });

  it("weights reposts between plays and likes by default", () => {
    const metricsReposts = { plays: 0, likes: 0, reposts: 100 };
    const scorePlays = computeScoreStats(
      { plays: 100, likes: 0, reposts: 0 },
      DEFAULT_COEFFICIENTS
    );
    const scoreReposts = computeScoreStats(metricsReposts, DEFAULT_COEFFICIENTS);
    const scoreLikes = computeScoreStats(
      { plays: 0, likes: 100, reposts: 0 },
      DEFAULT_COEFFICIENTS
    );
    // plays=1.0 < reposts=3.0 < likes=5.0
    expect(scoreReposts).toBeGreaterThan(scorePlays);
    expect(scoreReposts).toBeLessThan(scoreLikes);
  });

  it("is additive (score equals sum of individual metric contributions)", () => {
    const metrics = { plays: 200, likes: 30, reposts: 10 };
    const playsContrib = 200 * DEFAULT_COEFFICIENTS.plays;
    const likesContrib = 30 * DEFAULT_COEFFICIENTS.likes;
    const repostsContrib = 10 * DEFAULT_COEFFICIENTS.reposts;
    expect(computeScoreStats(metrics, DEFAULT_COEFFICIENTS)).toBe(
      playsContrib + likesContrib + repostsContrib
    );
  });
});
