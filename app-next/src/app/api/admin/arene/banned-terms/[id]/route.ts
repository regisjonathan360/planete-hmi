/**
 * DELETE /api/admin/arene/banned-terms/[id] — Supprimer un terme interdit
 *
 * Requirements: 10.9, 15.2
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// DELETE — Remove a banned term
// ---------------------------------------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Identifiant invalide." } },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    // Check that the term exists
    const { data: existing, error: fetchError } = await supabase
      .from("banned_terms")
      .select("id")
      .eq("id", idParsed.data)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: { code: "database_error", message: fetchError.message } },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Terme introuvable." } },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from("banned_terms")
      .delete()
      .eq("id", idParsed.data);

    if (deleteError) {
      return NextResponse.json(
        { error: { code: "database_error", message: deleteError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}
