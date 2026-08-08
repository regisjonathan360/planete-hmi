/**
 * POST /api/admin/arene/moderation/[id] — Action de modération sur un commentaire
 *
 * Actions possibles :
 * - 'validate' : rend le commentaire visible (status='published', reset report_count)
 * - 'delete'   : supprime le commentaire, notifie l'auteur, vérifie seuil de suspension
 * - 'restore'  : restaure le commentaire (status='published', reset report_count)
 *
 * Requirements: 10.5, 10.6, 10.7, 15.2
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const moderationActionSchema = z.object({
  action: z.enum(["validate", "delete", "restore"]),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// POST — Execute moderation action on a comment
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Admin guard
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  // 2. Validate comment ID
  const { id } = await params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Identifiant de commentaire invalide." } },
      { status: 400 }
    );
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Corps de requête JSON invalide." } },
      { status: 400 }
    );
  }

  const parsed = moderationActionSchema.safeParse(body);
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

  const { action, reason } = parsed.data;

  const supabase = createAdminClient();

  // 4. Fetch the comment
  const { data: comment, error: fetchError } = await supabase
    .from("comments")
    .select("id, member_id, body, status")
    .eq("id", idParsed.data)
    .single();

  if (fetchError || !comment) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Commentaire introuvable." } },
      { status: 404 }
    );
  }

  // 5. Execute action
  let suspensionTriggered = false;

  switch (action) {
    case "validate": {
      // Set status='published', reset report_count
      const { error: updateError } = await supabase
        .from("comments")
        .update({ status: "published", report_count: 0 })
        .eq("id", comment.id);

      if (updateError) {
        return NextResponse.json(
          { error: { code: "server_error", message: updateError.message } },
          { status: 500 }
        );
      }
      break;
    }

    case "delete": {
      // Set status='deleted'
      const { error: updateError } = await supabase
        .from("comments")
        .update({ status: "deleted" })
        .eq("id", comment.id);

      if (updateError) {
        return NextResponse.json(
          { error: { code: "server_error", message: updateError.message } },
          { status: 500 }
        );
      }

      // Send notification to the comment author
      await supabase.from("notifications").insert({
        member_id: comment.member_id,
        type: "comment_deleted",
        title: "Commentaire supprimé par la modération",
        body: reason || "Votre commentaire a été supprimé pour non-respect des règles de la communauté.",
        metadata: { comment_id: comment.id, admin_id: auth.user.id },
      });

      // Check suspension threshold: 5 deletions in 30-day window
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all comments by this member
      const { data: memberComments } = await supabase
        .from("comments")
        .select("id")
        .eq("member_id", comment.member_id);

      const memberCommentIds = (memberComments ?? []).map((c: { id: string }) => c.id);

      // Count how many of these comments were deleted by moderation in the last 30 days
      let memberDeletionCount = 0;
      if (memberCommentIds.length > 0) {
        const { count } = await supabase
          .from("moderation_actions")
          .select("id", { count: "exact", head: true })
          .in("comment_id", memberCommentIds)
          .eq("action", "delete")
          .gte("created_at", thirtyDaysAgo.toISOString());

        memberDeletionCount = count ?? 0;
      }

      // Include current deletion (+1 since we haven't inserted moderation_actions yet)
      const totalDeletions = memberDeletionCount + 1;

      if (totalDeletions >= 5) {
        suspensionTriggered = true;

        // Suspend the member for 7 days
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + 7);

        await supabase
          .from("community_profiles")
          .update({
            is_suspended: true,
            suspended_until: suspendedUntil.toISOString(),
          })
          .eq("member_id", comment.member_id);

        // Notify member of suspension
        await supabase.from("notifications").insert({
          member_id: comment.member_id,
          type: "suspension",
          title: "Suspension temporaire",
          body: `Votre capacité de commenter est suspendue jusqu'au ${suspendedUntil.toLocaleDateString("fr-FR")} suite à des infractions répétées aux règles de la communauté.`,
          metadata: {
            suspended_until: suspendedUntil.toISOString(),
            deletion_count: totalDeletions,
          },
        });
      }
      break;
    }

    case "restore": {
      // Set status='published', reset report_count
      const { error: updateError } = await supabase
        .from("comments")
        .update({ status: "published", report_count: 0 })
        .eq("id", comment.id);

      if (updateError) {
        return NextResponse.json(
          { error: { code: "server_error", message: updateError.message } },
          { status: 500 }
        );
      }
      break;
    }
  }

  // 6. Insert moderation_actions record
  const { error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      admin_id: auth.user.id,
      comment_id: comment.id,
      action,
      reason: reason ?? null,
    });

  if (actionError) {
    return NextResponse.json(
      { error: { code: "server_error", message: actionError.message } },
      { status: 500 }
    );
  }

  // 7. Return success
  return NextResponse.json({
    success: true,
    commentId: comment.id,
    action,
    ...(action === "delete" && { suspensionTriggered }),
  });
}
