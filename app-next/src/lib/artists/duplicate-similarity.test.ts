import { describe, expect, it } from "vitest";
import {
  compareArtistNames,
  DUPLICATE_THRESHOLDS,
  normalizeArtistName,
} from "./duplicate-similarity";

describe("comparaison avancée des noms d'artistes", () => {
  it("normalise les accents, apostrophes et ponctuations", () => {
    expect(normalizeArtistName("  J-Perry d'Haïti ")).toBe("j perry dhaiti");
  });

  it.each([
    ["T-Vice", "T Vice"],
    ["Klass", "Class"],
    ["Roody Roodboy", "Roody Rood Boy"],
    ["DJ Bullet", "Bullet Official"],
    ["BIC Tizon Dife", "B.I.C."],
    ["Phyllisia Ross", "Filisia Ross"],
  ])("détecte %s et %s comme noms proches", (left, right) => {
    expect(compareArtistNames(left, right).score).toBeGreaterThanOrEqual(
      DUPLICATE_THRESHOLDS.broad,
    );
  });

  it.each([
    ["Rutshelle Guillaume", "T-Vice"],
    ["Alan Cavé", "Bedjine"],
    ["Kenny Haiti", "Roody Roodboy"],
  ])("ne rapproche pas excessivement %s et %s", (left, right) => {
    expect(compareArtistNames(left, right).score).toBeLessThan(
      DUPLICATE_THRESHOLDS.broad,
    );
  });

  it("explique les raisons du rapprochement", () => {
    const result = compareArtistNames("Phyllisia Ross", "Filisia Ross");
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
