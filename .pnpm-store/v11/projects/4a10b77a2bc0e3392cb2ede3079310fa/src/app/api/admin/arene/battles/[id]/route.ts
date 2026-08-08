/**
 * PATCH  /api/admin/arene/battles/[id] — Modifier une battle (titre, description, statut)
 * DELETE /api/admin/arene/battles/[id] — Supprimer une battle (seulement si aucun vote)
 *
 * Requirements: 5.1, 15.2
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const battleUpdateSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(["cancelled", "ended"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ doit être fourni.",
  });

// ---------------------------------------------------------------------------
// PATCH — Update a battle
// ---------------------------------------------------------------------------

export async function PATCH(
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
    const body = await request.json();
    const parsed = battleUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Données invalides.",
            details: parsed.error.issues.map((i) => ({
              path: i.path.join("."),
              msg: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = createAdminClient();

    // Check the battle exists
    const { data: existing, error: fetchError } = await supabase
      .from("battles")
      .select("id, status")
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
        { error: { code: "not_found", message: "Battle introuvable." } },
        { status: 404 }
      );
    }

    // Build the update object
    const updateFields: Record<string, unknown> = {};

    if (input.title !== undefined) {
      updateFields.title = input.title;
    }
    if (input.description !== undefined) {
      updateFields.description = input.description;
    }
    if (input.status !== undefined) {
      // Only allow status transitions from active
      if (existing.status !== "active") {
        return NextResponse.json(
          {
            error: {
              code: "conflict",
              message: "Seule une battle active peut être annulée ou terminée.",
            },
          },
          { status: 409 }
        );
      }
      updateFields.status = input.status;

      // If ending the battle, set ends_at to now and determine the winner
      if (input.status === "ended") {
        updateFields.ends_at = new Date().toISOString();

        // Fetch vote counts to determine winner
        const { data: battleData } = await supabase
          .from("battles")
          .select("votes_a, votes_b")
          .eq("id", idParsed.data)
          .single();

        if (battleData) {
          if (battleData.votes_a > battleData.votes_b) {
            updateFields.winner = "side_a";
          } else if (battleData.votes_b > battleData.votes_a) {
            updateFields.winner = "side_b";
          } else {
            updateFields.winner = "tie";
          }
        }
      }
    }

    const { data, error } = await supabase
      .from("battles")
      .update(updateFields)
      .eq("id", idParsed.data)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: "database_error", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ battle: data });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete a battle (only if no votes have been cast)
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

    // Check the battle exists and has no votes
    const { data: existing, error: fetchError } = await supabase
      .from("battles")
      .select("id, votes_a, votes_b")
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
        { error: { code: "not_found", message: "Battle introuvable." } },
        { status: 404 }
      );
    }

    // Only allow deletion if no votes have been cast
    if ((existing.votes_a ?? 0) > 0 || (existing.votes_b ?? 0) > 0) {
      return NextResponse.json(
        {
          error: {
            code: "conflict",
            message:
              "Impossible de supprimer une battle ayant déjà reçu des votes.",
          },
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("battles")
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
