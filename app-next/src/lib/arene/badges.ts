/**
 * Badge awarding service for the community arena.
 *
 * Checks badge conditions based on member stats and awards badges
 * that haven't been earned yet (idempotent via UNIQUE constraint).
 *
 * Requirements: 8.1, 8.2, 8.6
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check badge conditions and award any newly earned badges.
 *
 * @param supabase - Authenticated Supabase client
 * @param memberId - The member's auth user ID
 * @param action - The action that triggered this check (e.g. 'comment', 'vote', 'reaction')
 * @param stats - Current member stats after the action
 * @returns Array of badge names that were newly awarded
 */
export async function checkAndAwardBadges(
  supabase: SupabaseClient,
  memberId: string,
  action: string,
  stats: { commentCount: number; voteCount: number; reactionCount: number }
): Promise<string[]> {
  const awardedBadgeNames: string[] = [];

  // Determine which badge types to check based on the action and stats
  const badgeTypesToCheck: string[] = [];

  if (action === "comment" && stats.commentCount === 1) {
    badgeTypesToCheck.push("first_comment");
  }

  if (action === "vote" && stats.voteCount === 1) {
    badgeTypesToCheck.push("first_vote");
  }

  if (action === "vote" && stats.voteCount >= 10) {
    badgeTypesToCheck.push("10_battles");
  }

  if (action === "reaction" && stats.reactionCount >= 50) {
    badgeTypesToCheck.push("50_reactions");
  }

  if (action === "challenge_complete") {
    badgeTypesToCheck.push("challenge_complete");
  }

  if (action === "level_up") {
    badgeTypesToCheck.push("level_up");
  }

  if (badgeTypesToCheck.length === 0) {
    return awardedBadgeNames;
  }

  // Query badges table for matching badge_types
  const { data: badges } = await supabase
    .from("badges")
    .select("id, name, badge_type")
    .in("badge_type", badgeTypesToCheck);

  if (!badges || badges.length === 0) {
    return awardedBadgeNames;
  }

  // Attempt to insert each badge (ignore if already exists via unique constraint)
  for (const badge of badges) {
    const { error } = await supabase.from("member_badges").insert({
      member_id: memberId,
      badge_id: badge.id,
    });

    // If no error, the badge was newly awarded
    if (!error) {
      awardedBadgeNames.push(badge.name);

      // Insert notification for the new badge
      await supabase.from("notifications").insert({
        member_id: memberId,
        type: "badge_earned",
        title: `Badge obtenu : ${badge.name}`,
        body: `Félicitations ! Vous avez obtenu le badge "${badge.name}".`,
        metadata: { badge_id: badge.id, badge_type: badge.badge_type },
      });

      // Insert activity_feed entry for badge award
      await supabase.from("activity_feed").insert({
        actor_id: memberId,
        activity_type: "badge_earned",
        target_type: "badge",
        target_id: badge.id,
        target_label: badge.name,
        metadata: { badge_type: badge.badge_type },
      });
    }
    // If error code 23505 (unique violation), badge already exists — skip silently
  }

  return awardedBadgeNames;
}
