import { describe, it, expect } from "vitest";
import { computeFilteredPositions } from "./filtered-positions";

describe("computeFilteredPositions", () => {
  it("assigne des positions séquentielles aux entrées éligibles", () => {
    const entries = [
      { eligible: true, data: { title: "Track A" } },
      { eligible: true, data: { title: "Track B" } },
      { eligible: true, data: { title: "Track C" } },
    ];
    const result = computeFilteredPositions(entries);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ filteredPosition: 1, data: { title: "Track A" } });
    expect(result[1]).toEqual({ filteredPosition: 2, data: { title: "Track B" } });
    expect(result[2]).toEqual({ filteredPosition: 3, data: { title: "Track C" } });
  });

  it("ignore les entrées non éligibles", () => {
    const entries = [
      { eligible: true, data: "A" },
      { eligible: false, data: "B" },
      { eligible: true, data: "C" },
      { eligible: false, data: "D" },
      { eligible: true, data: "E" },
    ];
    const result = computeFilteredPositions(entries);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ filteredPosition: 1, data: "A" });
    expect(result[1]).toEqual({ filteredPosition: 2, data: "C" });
    expect(result[2]).toEqual({ filteredPosition: 3, data: "E" });
  });

  it("limite au maxDisplay (défaut 20)", () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      eligible: true,
      data: i + 1,
    }));
    const result = computeFilteredPositions(entries);

    expect(result).toHaveLength(20);
    expect(result[0].filteredPosition).toBe(1);
    expect(result[19].filteredPosition).toBe(20);
  });

  it("respecte un maxDisplay personnalisé", () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      eligible: true,
      data: i,
    }));
    const result = computeFilteredPositions(entries, 5);

    expect(result).toHaveLength(5);
    expect(result[4].filteredPosition).toBe(5);
  });

  it("retourne moins d'entrées si moins d'éligibles que maxDisplay", () => {
    const entries = [
      { eligible: true, data: "X" },
      { eligible: true, data: "Y" },
    ];
    const result = computeFilteredPositions(entries, 20);

    expect(result).toHaveLength(2);
    expect(result[0].filteredPosition).toBe(1);
    expect(result[1].filteredPosition).toBe(2);
  });

  it("retourne un tableau vide si aucune entrée éligible", () => {
    const entries = [
      { eligible: false, data: "A" },
      { eligible: false, data: "B" },
    ];
    const result = computeFilteredPositions(entries);
    expect(result).toHaveLength(0);
  });

  it("retourne un tableau vide pour un tableau vide en entrée", () => {
    const result = computeFilteredPositions([]);
    expect(result).toHaveLength(0);
  });

  it("les positions forment une séquence contiguë à partir de 1", () => {
    const entries = [
      { eligible: false, data: 1 },
      { eligible: true, data: 2 },
      { eligible: false, data: 3 },
      { eligible: true, data: 4 },
      { eligible: false, data: 5 },
      { eligible: true, data: 6 },
    ];
    const result = computeFilteredPositions(entries);

    expect(result.map((r) => r.filteredPosition)).toEqual([1, 2, 3]);
  });

  it("préserve le type de data générique", () => {
    interface TrackInfo {
      id: number;
      name: string;
    }
    const entries: Array<{ eligible: boolean; data: TrackInfo }> = [
      { eligible: true, data: { id: 1, name: "First" } },
      { eligible: true, data: { id: 2, name: "Second" } },
    ];
    const result = computeFilteredPositions(entries);

    expect(result[0].data.id).toBe(1);
    expect(result[1].data.name).toBe("Second");
  });
});
