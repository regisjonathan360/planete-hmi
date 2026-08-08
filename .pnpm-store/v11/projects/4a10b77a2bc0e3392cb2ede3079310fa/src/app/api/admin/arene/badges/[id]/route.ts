/**
 * PATCH /api/admin/arene/badges/[id] — Modifier un badge (nom, description, icône)
 *
 * Requirements: 8.4, 8.5, 15.2
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation schema — all fields optional for partial update
// ---------------------------------------------------------------------------

const badgeUpdateSchema = z
  .object({
    name: z.string().min(3).max(50).optional(),
    description: z.string().min(10).max(200).optional(),
    icon_url: z.url().optional(),
    badge_type: z
      .enum([
        "first_comment",
        "first_vote",
        "10_battles",
        "50_reactions",
        "7_days_streak",
        "challenge_complete",
        "level_up",
        "special",
      ])
      .optional(),
    is_special: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ doit être fourni.",
  });

// ---------------------------------------------------------------------------
// PATCH — Update a badge
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

  const parsed = badgeUpdateSchema.safeParse(body);
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

  // Verify the badge exists
  const { data: existing, error: fetchError } = await supabase
    .from("badges")
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
      { error: { code: "not_found", message: "Badge introuvable." } },
      { status: 404 }
    );
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }
  if (input.description !== undefined) {
    updatePayload.description = input.description;
  }
  if (input.icon_url !== undefined) {
    updatePayload.icon_url = input.icon_url;
  }
  if (input.badge_type !== undefined) {
    updatePayload.badge_type = input.badge_type;
  }
  if (input.is_special !== undefined) {
    updatePayload.is_special = input.is_special;
  }

  const { data, error } = await supabase
    .from("badges")
    .update(updatePayload)
    .eq("id", idParsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "database_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ badge: data });
}
