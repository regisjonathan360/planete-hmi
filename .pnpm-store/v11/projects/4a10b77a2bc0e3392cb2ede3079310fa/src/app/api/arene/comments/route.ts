/**
 * GET /api/arene/comments — Liste paginée des commentaires d'un fil (anti-chronologique)
 * POST /api/arene/comments — Créer un commentaire avec validation, modération et rate limit
 *
 * Requirements: 4.1-4.8, 10.1, 10.8, 15.1
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { commentBodySchema } from "@/lib/arene/validation";
import { filterComment } from "@/lib/arene/moderation";
import { parsePagination, buildPaginationMeta } from "@/lib/arene/pagination";
import { checkRateLimit } from "@/lib/arene/rate-limit";
import { checkAndAwardBadges } from "@/lib/arene/badges";
import { updateChallengeProgress } from "@/lib/arene/challenges";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const getCommentsSchema = z.object({
  threadType: z.enum(["song", "battle", "challenge", "free"]),
  threadId: z.string().uuid(),
});

const createCommentSchema = z.object({
  threadType: z.enum(["song", "battle", "challenge", "free"]),
  threadId: z.string().uuid(),
  body: commentBodySchema,
});

// ---------------------------------------------------------------------------
// GET — Paginated comments by thread (anti-chronological, 20/page)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Validate thread params
  const threadParsed = getCommentsSchema.safeParse({
    threadType: searchParams.get("threadType"),
    threadId: searchParams.get("threadId"),
  });

  if (!threadParsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Paramètres threadType et threadId requis.",
          details: threadParsed.error.issues,
        },
      },
      { status: 400 }
    );
  }

  const { threadType, threadId } = threadParsed.data;
  const { page, pageSize } = parsePagination(searchParams);

  const supabase = await createClient();

  // Count total published comments in thread
  const { count } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("thread_type", threadType)
    .eq("thread_id", threadId)
    .eq("status", "published");

  const total = count ?? 0;

  // Fetch paginated comments (anti-chronological)
  const offset = (page - 1) * pageSize;
  const { data: comments, error } = await supabase
    .from("comments")
    .select(
      `
      id,
      member_id,
      thread_type,
      thread_id,
      body,
      status,
      created_at,
      community_profiles!inner(pseudo, niveau, avatar_url)
    `
    )
    .eq("thread_type", threadType)
    .eq("thread_id", threadId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: error.message } },
      { status: 500 }
    );
  }

  const pagination = buildPaginationMeta(total, page, pageSize);

  return NextResponse.json({
    comments: comments ?? [],
    pagination,
  });
}

// ---------------------------------------------------------------------------
// POST — Create comment with validation, banned term check, rate limit
// ---------------------------------------------------------------------------

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
          message: "Authentification requise.",
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
          message: "Corps de requête JSON invalide.",
        },
      },
      { status: 400 }
    );
  }

  const parsed = createCommentSchema.safeParse(body);
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

  const { threadType, threadId, body: commentBody } = parsed.data;

  // 3. Check rate limit (1 comment / 10s)
  const { data: recentComments } = await supabase
    .from("comments")
    .select("created_at")
    .eq("member_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const timestamps = (recentComments ?? []).map(
    (c: { created_at: string }) => new Date(c.created_at)
  );

  const rateResult = checkRateLimit(user.id, "comment", timestamps);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: `Veuillez patienter ${rateResult.retryAfterSeconds} seconde(s) avant de poster un nouveau commentaire.`,
          retryAfterSeconds: rateResult.retryAfterSeconds,
        },
      },
      { status: 429 }
    );
  }

  // 4. Fetch banned terms and check moderation
  const { data: bannedTermsData } = await supabase
    .from("banned_terms")
    .select("term");

  const bannedTerms = (bannedTermsData ?? []).map(
    (t: { term: string }) => t.term
  );

  const moderationResult = filterComment(commentBody, bannedTerms);

  // 5. If moderated → return 422
  if (!moderationResult.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "moderated",
          message: moderationResult.reason,
        },
      },
      { status: 422 }
    );
  }

  // 6. INSERT comment with status='published'
  const { data: newComment, error: insertError } = await supabase
    .from("comments")
    .insert({
      member_id: user.id,
      thread_type: threadType,
      thread_id: threadId,
      body: commentBody,
      status: "published",
    })
    .select("id, member_id, thread_type, thread_id, body, status, created_at")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: { code: "server_error", message: insertError.message } },
      { status: 500 }
    );
  }

  // 7. Increment comment_count on community_profiles
  const { data: profile } = await supabase
    .from("community_profiles")
    .select("comment_count")
    .eq("member_id", user.id)
    .single();

  if (profile) {
    await supabase
      .from("community_profiles")
      .update({ comment_count: (profile.comment_count ?? 0) + 1 })
      .eq("member_id", user.id);
  }

  // 8. Call award_points RPC with category='comment', points=2
  const { data: pointsResult } = await supabase.rpc("award_points", {
    p_member_id: user.id,
    p_category: "comment",
    p_points: 2,
  });

  // 9. Insert activity_feed entry
  await supabase.from("activity_feed").insert({
    actor_id: user.id,
    activity_type: "comment",
    target_type: threadType,
    target_id: threadId,
    target_label: commentBody.substring(0, 100),
    metadata: { comment_id: newComment.id },
  });

  // 10. Check and award badges based on updated comment count
  const updatedCommentCount = (profile?.comment_count ?? 0) + 1;
  await checkAndAwardBadges(supabase, user.id, "comment", {
    commentCount: updatedCommentCount,
    voteCount: 0,
    reactionCount: 0,
  });

  // 11. Update challenge progress for comment_songs challenges
  await updateChallengeProgress(supabase, user.id, "comment_songs");

  // 12. Refresh leaderboard cache after points awarded
  if (pointsResult?.awarded > 0) {
    try { await supabase.rpc("refresh_leaderboard_cache"); } catch { /* ignore */ }
  }

  // 13. Return comment + points info
  return NextResponse.json(
    {
      comment: newComment,
      points: pointsResult ?? { awarded: 0, cap_reached: false },
    },
    { status: 201 }
  );
}
