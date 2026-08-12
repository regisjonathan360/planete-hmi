/**
 * POST /api/admin/arene/solitaire/cards/[key] — Personnalise une carte
 *
 * Upsert : artiste (null = rendre la carte classique) + overrides facultatifs
 * de masque/cadrage (null = suivre le preset du rang).
 * Liste aussi les artistes pour le picker quand ?q est fourni.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { solitaireCardKeySchema, solitaireCardSchema } from "@/lib/arene/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { key } = await params;
  const keyParsed = solitaireCardKeySchema.safeParse(key);
  if (!keyParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Clé de carte invalide." } },
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

  const parsed = solitaireCardSchema.safeParse(body);
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

  const upsertPayload: Record<string, unknown> = {
    card_key: keyParsed.data,
    artist_id: input.artist_id,
  };
  for (const field of [
    "mask_type",
    "mask_scale",
    "mask_pos_x",
    "mask_pos_y",
    "image_zoom",
    "image_pos_x",
    "image_pos_y",
  ] as const) {
    if (input[field] !== undefined) upsertPayload[field] = input[field];
  }

  const { data, error } = await supabase
    .from("solitaire_cards")
    .upsert(upsertPayload, { onConflict: "card_key" })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "database_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ card: data }, { status: 201 });
}