import { describe, expect, it } from "vitest";
import { artistMatchRank, normalizeSearchText } from "./route";

describe("recherche publique des artistes", () => {
  it("ignore les accents et la casse", () => {
    expect(normalizeSearchText("  BÉLO  ")).toBe("belo");
    expect(normalizeSearchText("Planète HMI")).toBe("planete hmi");
  });

  it("classe une correspondance exacte avant un préfixe et une inclusion", () => {
    const query = normalizeSearchText("belo");

    expect(artistMatchRank("Bélo", query)).toBe(0);
    expect(artistMatchRank("Belo & Friends", query)).toBe(1);
    expect(artistMatchRank("Jean Belo Louis", query)).toBe(2);
    expect(artistMatchRank("Ti Corn", query)).toBe(3);
  });
});
