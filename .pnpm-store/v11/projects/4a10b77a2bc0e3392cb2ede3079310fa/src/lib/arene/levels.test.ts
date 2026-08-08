import { describe, expect, it } from "vitest";
import { computeNiveau, NIVEAU_THRESHOLDS, type Niveau } from "./levels";

describe("computeNiveau", () => {
  it("retourne 'etoile' pour 0 points", () => {
    expect(computeNiveau(0)).toBe("etoile");
  });

  it("retourne 'etoile' pour 99 points (limite haute)", () => {
    expect(computeNiveau(99)).toBe("etoile");
  });

  it("retourne 'constellation' pour 100 points (seuil bas)", () => {
    expect(computeNiveau(100)).toBe("constellation");
  });

  it("retourne 'constellation' pour 499 points (limite haute)", () => {
    expect(computeNiveau(499)).toBe("constellation");
  });

  it("retourne 'nebuleuse' pour 500 points (seuil bas)", () => {
    expect(computeNiveau(500)).toBe("nebuleuse");
  });

  it("retourne 'nebuleuse' pour 1499 points (limite haute)", () => {
    expect(computeNiveau(1499)).toBe("nebuleuse");
  });

  it("retourne 'galaxie' pour 1500 points (seuil bas)", () => {
    expect(computeNiveau(1500)).toBe("galaxie");
  });

  it("retourne 'galaxie' pour 4999 points (limite haute)", () => {
    expect(computeNiveau(4999)).toBe("galaxie");
  });

  it("retourne 'univers' pour 5000 points (seuil bas)", () => {
    expect(computeNiveau(5000)).toBe("univers");
  });

  it("retourne 'univers' pour un très grand nombre de points", () => {
    expect(computeNiveau(100000)).toBe("univers");
  });
});

describe("NIVEAU_THRESHOLDS", () => {
  it("contient 5 niveaux", () => {
    expect(NIVEAU_THRESHOLDS).toHaveLength(5);
  });

  it("est ordonné du plus élevé au plus bas (minPoints décroissant)", () => {
    for (let i = 0; i < NIVEAU_THRESHOLDS.length - 1; i++) {
      expect(NIVEAU_THRESHOLDS[i].minPoints).toBeGreaterThan(
        NIVEAU_THRESHOLDS[i + 1].minPoints
      );
    }
  });

  it("commence à 0 pour le niveau le plus bas", () => {
    const last = NIVEAU_THRESHOLDS[NIVEAU_THRESHOLDS.length - 1];
    expect(last.minPoints).toBe(0);
    expect(last.niveau).toBe("etoile");
  });
});
