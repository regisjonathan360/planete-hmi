/**
 * GET/PATCH /api/admin/audiomack/genres
 *
 * GET:   Retourne toutes les configurations de genres depuis chart_sources (platform=audiomack).
 * PATCH: Met à jour is_enabled, weight, display_order pour un source_key donné.
 *        Valide le poids dans la plage 0.0–5.0.
 *
 * Protégé par requireAdmin.
 */
import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — Liste toutes les configs de genre Audiomack
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("chart_sources")
    .select(
      "id, source_key, genre_id, display_name, is_enabled, is_automatic, weight, display_order, is_composite_source"
    )
    .eq("platform", "audiomack")
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `Erreur lors de la récupération des genres: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ genres: data ?? [] });
}

// ---------------------------------------------------------------------------
// PATCH — Met à jour la config d'un genre
// ---------------------------------------------------------------------------
const patchSchema = z.object({
  source_key: z.string().min(1),
  is_enabled: z.boolean().optional(),
  weight: z.number().min(0).max(5).optional(),
  display_order: z.number().int().min(0).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { source_key, is_enabled, weight, display_order } = parsed.data;

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (is_enabled !== undefined) updates.is_enabled = is_enabled;
  if (weight !== undefined) updates.weight = weight;
  if (display_order !== undefined) updates.display_order = display_order;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Aucun champ à mettre à jour." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("chart_sources")
    .update(updates)
    .eq("source_key", source_key)
    .eq("platform", "audiomack")
    .select("id, source_key, genre_id, display_name, is_enabled, weight, display_order")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Erreur lors de la mise à jour: ${error.message}` },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: `Source "${source_key}" introuvable.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ updated: data });
}
