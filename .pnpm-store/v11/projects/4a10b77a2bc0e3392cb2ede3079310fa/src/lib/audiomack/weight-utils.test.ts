import { describe, it, expect } from "vitest";
import { validateWeight, normalizeWeights } from "./weight-utils";

describe("validateWeight", () => {
  it("accepte 0.0 (minimum)", () => {
    expect(validateWeight(0.0)).toBe(true);
  });

  it("accepte 5.0 (maximum)", () => {
    expect(validateWeight(5.0)).toBe(true);
  });

  it("accepte une valeur intermédiaire", () => {
    expect(validateWeight(2.5)).toBe(true);
    expect(validateWeight(1.0)).toBe(true);
    expect(validateWeight(3.75)).toBe(true);
  });

  it("rejette une valeur négative", () => {
    expect(validateWeight(-0.1)).toBe(false);
    expect(validateWeight(-5)).toBe(false);
  });

  it("rejette une valeur supérieure à 5.0", () => {
    expect(validateWeight(5.01)).toBe(false);
    expect(validateWeight(10)).toBe(false);
  });

  it("rejette NaN", () => {
    expect(validateWeight(NaN)).toBe(false);
  });

  it("rejette Infinity", () => {
    expect(validateWeight(Infinity)).toBe(false);
    expect(validateWeight(-Infinity)).toBe(false);
  });
});

describe("normalizeWeights", () => {
  it("normalise des poids simples en pourcentages", () => {
    const weights = new Map([
      ["all", 2.0],
      ["caribbean", 2.0],
      ["hip-hop-rap", 1.0],
    ]);
    const result = normalizeWeights(weights);

    expect(result.get("all")).toBeCloseTo(40, 1);
    expect(result.get("caribbean")).toBeCloseTo(40, 1);
    expect(result.get("hip-hop-rap")).toBeCloseTo(20, 1);
  });

  it("les pourcentages totalisent 100%", () => {
    const weights = new Map([
      ["all", 1.0],
      ["caribbean", 3.0],
      ["latin", 1.5],
    ]);
    const result = normalizeWeights(weights);
    const sum = Array.from(result.values()).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it("retourne une map vide si tous les poids sont 0", () => {
    const weights = new Map([
      ["all", 0],
      ["caribbean", 0],
    ]);
    const result = normalizeWeights(weights);
    expect(result.size).toBe(0);
  });

  it("retourne une map vide pour une map vide en entrée", () => {
    const weights = new Map<string, number>();
    const result = normalizeWeights(weights);
    expect(result.size).toBe(0);
  });

  it("gère un seul genre (100%)", () => {
    const weights = new Map([["all", 3.0]]);
    const result = normalizeWeights(weights);
    expect(result.get("all")).toBeCloseTo(100, 2);
  });

  it("gère un mix de poids à 0 et non-0", () => {
    const weights = new Map([
      ["all", 0],
      ["caribbean", 4.0],
      ["latin", 1.0],
    ]);
    const result = normalizeWeights(weights);
    expect(result.get("all")).toBeCloseTo(0, 2);
    expect(result.get("caribbean")).toBeCloseTo(80, 2);
    expect(result.get("latin")).toBeCloseTo(20, 2);
  });
});
