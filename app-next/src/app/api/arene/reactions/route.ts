/**
 * POST /api/arene/reactions — Toggle reaction (add or remove)
 *
 * Body: { contentType: 'song' | 'comment' | 'battle', contentId: UUID, reactionType: ReactionType }
 *
 * Logic:
 * 1. Auth check (401 if not authenticated)
 * 2. Validate body with Zod
 * 3. Check rate limit (10 reactions / 60s)
 * 4. Check if reaction already exists (toggle)
 * 5. If exists → DELETE (toggle off), decrement reaction_count on profile
 * 6. If not exists → INSERT, increment reaction_count on profile, call award_points RPC
 * 7. Insert activity_feed entry for new reactions
 * 8. Return result with points info
 *
 * Requirements: 3.1-3.8, 15.1
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/arene/rate-limit";
import { checkAndAwardBadges } from "@/lib/arene/badges";
import { updateChallengeProgress } from "@/lib/arene/challenges";

export const dynamic = "force-dynamic";

const reactionSchema = z.object({
  contentType: z.enum(["song", "comment", "battle"]),
  contentId: z.string().uuid(),
  reactionType: z.enum(["star", "fire", "rocket", "planet", "magic", "heart"]),
});

export async function POST(request: Request) {
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
          message: "Authentification requise pour réagir.",
        },
      },
      { status: 401 }
    );
  }

  // 2. Validate body with Zod
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

  const parsed = reactionSchema.safeParse(body);
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

  const { contentType, contentId, reactionType } = parsed.data;

  // 3. Check rate limit (10 reactions / 60s)
  const { data: recentReactions } = await supabase
    .from("reactions")
    .select("created_at")
    .eq("member_id", user.id)
    .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  const timestamps = (recentReactions ?? []).map(
    (r: { created_at: string }) => new Date(r.created_at)
  );

  const rateLimitResult = checkRateLimit(user.id, "reaction", timestamps);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: `Trop de réactions. Réessayez dans ${rateLimitResult.retryAfterSeconds} seconde(s).`,
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        },
      },
      { status: 429 }
    );
  }

  // 4. Check if reaction already exists (member_id + content_type + content_id + reaction_type)
  const { data: existingReaction } = await supabase
    .from("reactions")
    .select("id")
    .eq("member_id", user.id)
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .eq("reaction_type", reactionType)
    .maybeSingle();

  if (existingReaction) {
    // 5. Toggle OFF → DELETE reaction, decrement reaction_count on profile
    const { error: deleteError } = await supabase
      .from("reactions")
      .delete()
      .eq("id", existingReaction.id);

    if (deleteError) {
      return NextResponse.json(
        {
          error: {
            code: "internal_error",
            message: "Erreur lors de la suppression de la réaction.",
          },
        },
        { status: 500 }
      );
    }

    // Decrement reaction_count on profile (floor at 0)
    const { data: profile } = await supabase
      .from("community_profiles")
      .select("reaction_count")
      .eq("member_id", user.id)
      .single();

    if (profile && profile.reaction_count > 0) {
      await supabase
        .from("community_profiles")
        .update({
          reaction_count: profile.reaction_count - 1,
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", user.id);
    }

    return NextResponse.json({
      action: "removed",
      contentType,
      contentId,
      reactionType,
      points: null,
    });
  }

  // 6. Toggle ON → INSERT reaction, increment reaction_count, call award_points
  const { error: insertError } = await supabase.from("reactions").insert({
    member_id: user.id,
    content_type: contentType,
    content_id: contentId,
    reaction_type: reactionType,
  });

  if (insertError) {
    // Handle unique constraint violation (race condition)
    if (insertError.code === "23505") {
      return NextResponse.json(
        {
          error: {
            code: "already_exists",
            message: "Cette réaction existe déjà.",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: "Erreur lors de l'ajout de la réaction.",
        },
      },
      { status: 500 }
    );
  }

  // Increment reaction_count on profile
  const { data: currentProfile } = await supabase
    .from("community_profiles")
    .select("reaction_count")
    .eq("member_id", user.id)
    .single();

  await supabase
    .from("community_profiles")
    .update({
      reaction_count: (currentProfile?.reaction_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", user.id);

  // Call award_points RPC (category='reaction', points=1)
  const { data: pointsResult } = await supabase.rpc("award_points", {
    p_member_id: user.id,
    p_category: "reaction",
    p_points: 1,
  });

  // 7. Insert activity_feed entry for new reactions
  await supabase.from("activity_feed").insert({
    actor_id: user.id,
    activity_type: "reaction",
    target_type: contentType,
    target_id: contentId,
    metadata: { reaction_type: reactionType },
  });

  // 8. Check and award badges based on updated stats
  const updatedReactionCount = (currentProfile?.reaction_count ?? 0) + 1;
  await checkAndAwardBadges(supabase, user.id, "reaction", {
    commentCount: 0, // not relevant for reaction action
    voteCount: 0,
    reactionCount: updatedReactionCount,
  });

  // 9. Update challenge progress for react_contents challenges
  await updateChallengeProgress(supabase, user.id, "react_contents");

  // 10. Refresh leaderboard cache after points awarded
  if (pointsResult?.awarded > 0) {
    try { await supabase.rpc("refresh_leaderboard_cache"); } catch { /* ignore */ }
  }

  // 11. Return result with points info
  return NextResponse.json({
    action: "added",
    contentType,
    contentId,
    reactionType,
    points: pointsResult
      ? {
          awarded: pointsResult.awarded,
          capReached: pointsResult.cap_reached,
          newTotal: pointsResult.new_total,
          levelUp: pointsResult.level_up,
          newNiveau: pointsResult.new_niveau,
        }
      : null,
  });
}
