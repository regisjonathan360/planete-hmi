import { describe, expect, it } from "vitest";
import {
  calculateAwardablePoints,
  DAILY_CAPS,
  POINTS_PER_ACTION,
  type ActionType,
  type PointCategory,
} from "./points";

describe("points constants", () => {
  it("defines daily caps: 50 for reactions, 40 for comments, null for votes and challenges", () => {
    expect(DAILY_CAPS.reaction).toBe(50);
    expect(DAILY_CAPS.comment).toBe(40);
    expect(DAILY_CAPS.vote).toBeNull();
    expect(DAILY_CAPS.challenge).toBeNull();
  });

  it("defines points per action: reaction=1, comment=2, vote=3, challenge=0", () => {
    expect(POINTS_PER_ACTION.reaction).toBe(1);
    expect(POINTS_PER_ACTION.comment).toBe(2);
    expect(POINTS_PER_ACTION.vote).toBe(3);
    expect(POINTS_PER_ACTION.challenge).toBe(0);
  });

  it("covers all categories in DAILY_CAPS", () => {
    const categories: PointCategory[] = ["reaction", "comment", "vote", "challenge"];
    for (const cat of categories) {
      expect(cat in DAILY_CAPS).toBe(true);
    }
  });

  it("covers all action types in POINTS_PER_ACTION", () => {
    const actions: ActionType[] = ["reaction", "comment", "vote", "challenge"];
    for (const action of actions) {
      expect(action in POINTS_PER_ACTION).toBe(true);
    }
  });
});

describe("calculateAwardablePoints", () => {
  it("returns requested amount when cap is null (uncapped)", () => {
    expect(calculateAwardablePoints(0, 3, null)).toBe(3);
    expect(calculateAwardablePoints(100, 5, null)).toBe(5);
    expect(calculateAwardablePoints(9999, 10, null)).toBe(10);
  });

  it("returns 0 when dailyTotal already reached the cap", () => {
    expect(calculateAwardablePoints(50, 1, 50)).toBe(0);
    expect(calculateAwardablePoints(55, 1, 50)).toBe(0);
    expect(calculateAwardablePoints(40, 2, 40)).toBe(0);
  });

  it("returns requested amount when enough room under the cap", () => {
    expect(calculateAwardablePoints(0, 1, 50)).toBe(1);
    expect(calculateAwardablePoints(10, 2, 40)).toBe(2);
    expect(calculateAwardablePoints(45, 3, 50)).toBe(3);
  });

  it("returns only remaining room when requested exceeds available space", () => {
    expect(calculateAwardablePoints(49, 5, 50)).toBe(1);
    expect(calculateAwardablePoints(38, 5, 40)).toBe(2);
    expect(calculateAwardablePoints(48, 3, 50)).toBe(2);
  });

  it("returns 0 when requested is 0 regardless of cap", () => {
    expect(calculateAwardablePoints(0, 0, 50)).toBe(0);
    expect(calculateAwardablePoints(0, 0, null)).toBe(0);
  });
});
