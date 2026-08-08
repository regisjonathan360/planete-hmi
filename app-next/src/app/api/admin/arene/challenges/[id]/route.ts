/**
 * PATCH /api/admin/arene/challenges/[id] — Update a challenge (status, title, description)
 *
 * Supports:
 * - Editing title and description while active
 * - Ending a challenge (status → 'ended')
 * - Cancelling a challenge (status → 'ended' with early termination)
 *
 * Requirements: 6.1, 6.5, 15.2
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Partial update schema — all fields optional
const challengeUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["active", "ended"]).optional(),
});

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

  // Validate UUID
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Identifiant invalide." } },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Corps de requête JSON invalide." } },
      { status: 400 }
    );
  }

  const parsed = challengeUpdateSchema.safeParse(body);
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

  // Ensure there is at least one field to update
  if (!input.title && !input.description && !input.status) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Aucun champ à mettre à jour." } },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Fetch current challenge to verify it exists
  const { data: existing, error: fetchError } = await supabase
    .from("challenges")
    .select("id, status")
    .eq("id", idParsed.data)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Défi introuvable." } },
      { status: 404 }
    );
  }

  // Cannot edit an already ended challenge
  if (existing.status === "ended") {
    return NextResponse.json(
      { error: { code: "conflict", message: "Ce défi est déjà terminé et ne peut plus être modifié." } },
      { status: 409 }
    );
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {};

  if (input.title !== undefined) {
    updatePayload.title = input.title;
  }
  if (input.description !== undefined) {
    updatePayload.description = input.description;
  }
  if (input.status !== undefined) {
    updatePayload.status = input.status;
    // When ending a challenge, set ends_at to now if it hasn't expired yet
    if (input.status === "ended") {
      updatePayload.ends_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from("challenges")
    .update(updatePayload)
    .eq("id", idParsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur lors de la mise à jour du défi." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
