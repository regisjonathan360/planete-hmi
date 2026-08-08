/**
 * Challenge completion tracker for the community arena.
 *
 * Updates challenge progress for a member after an action,
 * and awards points when a challenge target is reached.
 *
 * Requirements: 6.2, 6.6
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Update challenge progress for a member based on an action type.
 *
 * Finds active challenges matching the action type, upserts progress,
 * and awards points + marks completed when target is reached.
 *
 * @param supabase - Authenticated Supabase client
 * @param memberId - The member's auth user ID
 * @param actionType - The type of action: 'vote_battles', 'comment_songs', or 'react_contents'
 */
export async function updateChallengeProgress(
  supabase: SupabaseClient,
  memberId: string,
  actionType: "vote_battles" | "comment_songs" | "react_contents"
): Promise<void> {
  // Find active challenges matching the action type
  const { data: activeChallenges } = await supabase
    .from("challenges")
    .select("id, target_count, reward_points")
    .eq("challenge_type", actionType)
    .eq("status", "active")
    .gte("ends_at", new Date().toISOString());

  if (!activeChallenges || activeChallenges.length === 0) {
    return;
  }

  for (const challenge of activeChallenges) {
    // Upsert challenge_completions: increment progress
    const { data: existing } = await supabase
      .from("challenge_completions")
      .select("id, progress, completed")
      .eq("member_id", memberId)
      .eq("challenge_id", challenge.id)
      .maybeSingle();

    if (existing?.completed) {
      // Already completed — skip
      continue;
    }

    let newProgress: number;

    if (existing) {
      // Update existing progress
      newProgress = existing.progress + 1;
      await supabase
        .from("challenge_completions")
        .update({
          progress: newProgress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Insert new progress entry
      newProgress = 1;
      await supabase.from("challenge_completions").insert({
        member_id: memberId,
        challenge_id: challenge.id,
        progress: newProgress,
      });
    }

    // Check if challenge target is reached
    if (newProgress >= challenge.target_count) {
      // Mark as completed
      await supabase
        .from("challenge_completions")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", memberId)
        .eq("challenge_id", challenge.id);

      // Award points via RPC
      await supabase.rpc("award_points", {
        p_member_id: memberId,
        p_category: "challenge",
        p_points: challenge.reward_points,
      });

      // Increment participant_count on the challenge
      const { data: currentChallenge } = await supabase
        .from("challenges")
        .select("participant_count")
        .eq("id", challenge.id)
        .single();

      if (currentChallenge) {
        await supabase
          .from("challenges")
          .update({
            participant_count: (currentChallenge.participant_count ?? 0) + 1,
          })
          .eq("id", challenge.id);
      }
    }
  }
}
