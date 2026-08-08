/**
 * POST /api/arene/reports — Signaler un commentaire
 *
 * Permet à un Membre authentifié de signaler un commentaire avec une raison.
 * Empêche les doublons (un seul signalement par membre/commentaire).
 * Auto-masque le commentaire quand report_count >= 3.
 *
 * Requirements: 10.2, 10.3, 10.4
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const reportSchema = z.object({
  commentId: z.string().uuid(),
  reason: z.enum(["insulte", "spam", "discours_haineux", "autre"]),
});

// ---------------------------------------------------------------------------
// POST — Report a comment
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

  const parsed = reportSchema.safeParse(body);
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

  const { commentId, reason } = parsed.data;

  // 3. Check if member already reported this comment → 409
  const { data: existingReport } = await supabase
    .from("moderation_reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("comment_id", commentId)
    .maybeSingle();

  if (existingReport) {
    return NextResponse.json(
      {
        error: {
          code: "conflict",
          message: "Vous avez déjà signalé ce commentaire.",
        },
      },
      { status: 409 }
    );
  }

  // 4. Check that the comment exists and is published
  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("id, report_count, status")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) {
    return NextResponse.json(
      {
        error: {
          code: "not_found",
          message: "Commentaire introuvable.",
        },
      },
      { status: 404 }
    );
  }

  // 5. INSERT into moderation_reports
  const { error: insertError } = await supabase
    .from("moderation_reports")
    .insert({
      reporter_id: user.id,
      comment_id: commentId,
      reason,
    });

  if (insertError) {
    // Handle unique constraint violation (race condition fallback)
    if (insertError.code === "23505") {
      return NextResponse.json(
        {
          error: {
            code: "conflict",
            message: "Vous avez déjà signalé ce commentaire.",
          },
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: insertError.message } },
      { status: 500 }
    );
  }

  // 6. Increment report_count on the comment
  const newReportCount = (comment.report_count ?? 0) + 1;

  const updateData: { report_count: number; status?: string } = {
    report_count: newReportCount,
  };

  // 7. If report_count >= 3, auto-hide the comment
  if (newReportCount >= 3) {
    updateData.status = "hidden";
  }

  const { error: updateError } = await supabase
    .from("comments")
    .update(updateData)
    .eq("id", commentId);

  if (updateError) {
    return NextResponse.json(
      { error: { code: "server_error", message: updateError.message } },
      { status: 500 }
    );
  }

  // 8. Return 201 success
  return NextResponse.json(
    {
      success: true,
      message: "Signalement enregistré.",
      commentHidden: newReportCount >= 3,
    },
    { status: 201 }
  );
}
