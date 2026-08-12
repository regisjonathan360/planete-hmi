/**
 * PUT /api/admin/arene/solitaire/presets/[rank] — Applique la géométrie d'un rang
 *
 * Le preset sert de base à toutes les cartes du rang ; une carte peut le
 * surcharger via /api/admin/arene/solitaire/cards/[key].
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { solitairePresetSchema, solitaireRankSchema } from "@/lib/arene/validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ rank: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { rank } = await params;
  const rankParsed = solitaireRankSchema.safeParse(rank);
  if (!rankParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Rang invalide." } },
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

  const parsed = solitairePresetSchema.safeParse(body);
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

  const { data, error } = await supabase
    .from("solitaire_rank_presets")
    .upsert(
      {
        rank: rankParsed.data,
        ...input,
      },
      { onConflict: "rank" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "database_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ preset: data });
}