/**
 * DELETE /api/arene/comments/[id] — Soft-delete d'un commentaire (status='deleted')
 *
 * Seul l'auteur du commentaire peut le supprimer (member_id = auth.uid()).
 *
 * Requirements: 4.7, 15.1
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  // 2. Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Identifiant de commentaire invalide.",
        },
      },
      { status: 400 }
    );
  }

  // 3. Fetch comment and verify ownership
  const { data: comment, error: fetchError } = await supabase
    .from("comments")
    .select("id, member_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !comment) {
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

  // Verify ownership
  if (comment.member_id !== user.id) {
    return NextResponse.json(
      {
        error: {
          code: "forbidden",
          message: "Vous ne pouvez supprimer que vos propres commentaires.",
        },
      },
      { status: 403 }
    );
  }

  // Check if already deleted
  if (comment.status === "deleted") {
    return NextResponse.json(
      {
        error: {
          code: "already_deleted",
          message: "Ce commentaire a déjà été supprimé.",
        },
      },
      { status: 409 }
    );
  }

  // 4. Soft-delete: update status to 'deleted'
  const { error: updateError } = await supabase
    .from("comments")
    .update({ status: "deleted" })
    .eq("id", id)
    .eq("member_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: { code: "server_error", message: updateError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "ok",
    message: "Commentaire supprimé.",
  });
}
