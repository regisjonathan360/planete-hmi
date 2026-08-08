/**
 * Points system for the Community Interactions Arena.
 *
 * Defines daily caps per category, points awarded per action type,
 * and the core calculation function for awardable points respecting caps.
 *
 * Requirements: 3.6, 3.7, 4.5, 4.8, 5.3, 7.5, 7.6
 */

export type PointCategory = "reaction" | "comment" | "vote" | "challenge";
export type ActionType = "reaction" | "comment" | "vote" | "challenge";

/**
 * Daily caps per point category.
 * - reaction: max 50 points/day
 * - comment: max 40 points/day (20 comments × 2 pts each)
 * - vote: no cap
 * - challenge: no cap
 */
export const DAILY_CAPS: Record<PointCategory, number | null> = {
  reaction: 50,
  comment: 40,
  vote: null,
  challenge: null,
};

/**
 * Points awarded per single action.
 * - reaction: 1 point
 * - comment: 2 points
 * - vote: 3 points
 * - challenge: 0 (variable, defined per challenge)
 */
export const POINTS_PER_ACTION: Record<ActionType, number> = {
  reaction: 1,
  comment: 2,
  vote: 3,
  challenge: 0,
};

/**
 * Calculate how many points can actually be awarded given the current daily total,
 * the requested amount, and the category cap.
 *
 * - If cap is null (no limit), return the full requested amount.
 * - If dailyTotal already meets or exceeds the cap, return 0.
 * - Otherwise, return the minimum of requested and remaining room under the cap.
 *
 * @param dailyTotal - Points already earned today in this category
 * @param requested - Points the action would normally award
 * @param cap - Daily cap for this category, or null if uncapped
 * @returns The number of points to actually award (0 to requested)
 */
export function calculateAwardablePoints(
  dailyTotal: number,
  requested: number,
  cap: number | null
): number {
  if (cap === null) {
    return requested;
  }
  if (dailyTotal >= cap) {
    return 0;
  }
  return Math.min(requested, cap - dailyTotal);
}
