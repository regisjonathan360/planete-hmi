/**
 * POST /api/arene/battles/[id]/vote — Vote dans une battle
 *
 * Body: { side: 'side_a' | 'side_b' }
 *
 * Logic:
 * 1. Auth check (401 if not authenticated)
 * 2. Extract battle `id` from route params
 * 3. Validate body with Zod
 * 4. Fetch the battle → check it exists (404 if not)
 * 5. Check isBattleActive(battle.ends_at) → if false, return 410
 * 6. Check if member already voted → if yes, return 409
 * 7. INSERT into battle_votes
 * 8. UPDATE battles: increment votes_a or votes_b
 * 9. Increment vote_count on community_profiles
 * 10. Call award_points RPC (category='vote', points=3)
 * 11. Insert activity_feed entry
 * 12. Return success with points info
 *
 * Requirements: 5.3, 5.4, 5.5, 15.1
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isBattleActive } from "@/lib/arene/battles";
import { checkAndAwardBadges } from "@/lib/arene/badges";
import { updateChallengeProgress } from "@/lib/arene/challenges";

export const dynamic = "force-dynamic";

const voteSchema = z.object({
  side: z.enum(["side_a", "side_b"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "Authentification requise pour voter.",
        },
      },
      { status: 401 }
    );
  }

  // 2. Extract battle id from route params
  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Identifiant de battle invalide.",
        },
      },
      { status: 400 }
    );
  }

  const battleId = idParsed.data;

  // 3. Validate body with Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Corps de requête invalide.",
        },
      },
      { status: 400 }
    );
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Données invalides.",
          details: parsed.error.issues,
        },
      },
      { status: 400 }
    );
  }

  const { side } = parsed.data;

  // 4. Fetch the battle → check it exists (404 if not)
  const { data: battle, error: battleError } = await supabase
    .from("battles")
    .select("id, title, ends_at, status, side_a_label, side_b_label")
    .eq("id", battleId)
    .single();

  if (battleError || !battle) {
    return NextResponse.json(
      {
        error: {
          code: "not_found",
          message: "Battle introuvable.",
        },
      },
      { status: 404 }
    );
  }

  // 5. Check isBattleActive(battle.ends_at) → if false, return 410 Gone
  if (!isBattleActive(battle.ends_at)) {
    return NextResponse.json(
      {
        error: {
          code: "gone",
          message: "Cette battle est terminée.",
        },
      },
      { status: 410 }
    );
  }

  // 6. Check if member already voted → if yes, return 409
  const { data: existingVote } = await supabase
    .from("battle_votes")
    .select("id")
    .eq("member_id", user.id)
    .eq("battle_id", battleId)
    .maybeSingle();

  if (existingVote) {
    return NextResponse.json(
      {
        error: {
          code: "conflict",
          message: "Vous avez déjà voté dans cette battle.",
        },
      },
      { status: 409 }
    );
  }

  // 7. INSERT into battle_votes
  const { error: voteError } = await supabase.from("battle_votes").insert({
    member_id: user.id,
    battle_id: battleId,
    side,
  });

  if (voteError) {
    // Handle unique constraint violation (race condition)
    if (voteError.code === "23505") {
      return NextResponse.json(
        {
          error: {
            code: "conflict",
            message: "Vous avez déjà voté dans cette battle.",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: "Erreur lors de l'enregistrement du vote.",
        },
      },
      { status: 500 }
    );
  }

  // 8. UPDATE battles: increment votes_a or votes_b based on side
  const voteColumn = side === "side_a" ? "votes_a" : "votes_b";

  // Fetch current count to increment
  const { data: currentBattle } = await supabase
    .from("battles")
    .select("votes_a, votes_b")
    .eq("id", battleId)
    .single();

  const currentCount = (side === "side_a" ? currentBattle?.votes_a : currentBattle?.votes_b) ?? 0;

  await supabase
    .from("battles")
    .update({ [voteColumn]: currentCount + 1 })
    .eq("id", battleId);

  // 9. Increment vote_count on community_profiles
  const { data: profile } = await supabase
    .from("community_profiles")
    .select("vote_count")
    .eq("member_id", user.id)
    .single();

  const currentVoteCount = profile?.vote_count ?? 0;

  await supabase
    .from("community_profiles")
    .update({
      vote_count: currentVoteCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", user.id);

  // 10. Call award_points RPC (category='vote', points=3, no cap)
  const { data: pointsResult } = await supabase.rpc("award_points", {
    p_member_id: user.id,
    p_category: "vote",
    p_points: 3,
  });

  // 11. Insert activity_feed entry
  const targetLabel =
    side === "side_a" ? battle.side_a_label : battle.side_b_label;

  await supabase.from("activity_feed").insert({
    actor_id: user.id,
    activity_type: "vote",
    target_type: "battle",
    target_id: battleId,
    target_label: targetLabel,
    metadata: { side, battle_title: battle.title },
  });

  // 12. Check and award badges based on updated vote count
  const updatedVoteCount = currentVoteCount + 1;
  await checkAndAwardBadges(supabase, user.id, "vote", {
    commentCount: 0,
    voteCount: updatedVoteCount,
    reactionCount: 0,
  });

  // 13. Update challenge progress for vote_battles challenges
  await updateChallengeProgress(supabase, user.id, "vote_battles");

  // 14. Refresh leaderboard cache after points awarded
  if (pointsResult?.awarded > 0) {
    try { await supabase.rpc("refresh_leaderboard_cache"); } catch { /* ignore */ }
  }

  // 15. Return success with points info
  return NextResponse.json(
    {
      success: true,
      battleId,
      side,
      points: pointsResult
        ? {
            awarded: pointsResult.awarded,
            capReached: pointsResult.cap_reached,
            newTotal: pointsResult.new_total,
            levelUp: pointsResult.level_up,
            newNiveau: pointsResult.new_niveau,
          }
        : null,
    },
    { status: 201 }
  );
}
