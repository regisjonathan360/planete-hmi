import { describe, expect, it } from "vitest";
import { determineWinner, isBattleActive } from "./battles";

describe("determineWinner", () => {
  it("retourne 'side_a' quand votesA > votesB", () => {
    expect(determineWinner(10, 5)).toBe("side_a");
  });

  it("retourne 'side_b' quand votesB > votesA", () => {
    expect(determineWinner(3, 7)).toBe("side_b");
  });

  it("retourne 'tie' quand votesA === votesB", () => {
    expect(determineWinner(4, 4)).toBe("tie");
  });

  it("retourne 'tie' quand les deux côtés ont 0 votes", () => {
    expect(determineWinner(0, 0)).toBe("tie");
  });
});

describe("isBattleActive", () => {
  it("retourne true quand endsAt est dans le futur", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isBattleActive(future)).toBe(true);
  });

  it("retourne false quand endsAt est dans le passé", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isBattleActive(past)).toBe(false);
  });

  it("retourne false quand endsAt est exactement maintenant (edge: boundary)", () => {
    // A timestamp equal to now (or very slightly behind due to execution time) should be false
    const now = new Date().toISOString();
    // Since endTime must be strictly > now for active, equal means not active
    expect(isBattleActive(now)).toBe(false);
  });
});
