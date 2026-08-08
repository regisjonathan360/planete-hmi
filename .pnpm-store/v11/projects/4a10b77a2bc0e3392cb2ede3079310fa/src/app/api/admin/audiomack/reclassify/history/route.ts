/**
 * GET /api/admin/audiomack/reclassify/history
 *
 * Retourne l'historique des reclassements pour une édition donnée.
 * Query: ?editionId=<uuid>
 *
 * Protégé par requireAdmin.
 */
import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const editionId = searchParams.get("editionId");

  if (!editionId) {
    return NextResponse.json(
      { error: "Le paramètre editionId est requis." },
      { status: 400 }
    );
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(editionId)) {
    return NextResponse.json(
      { error: "editionId doit être un UUID valide." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("reclassification_history")
    .select("id, chart_edition_id, applied_at, applied_by, coefficients, previous_order, new_order")
    .eq("chart_edition_id", editionId)
    .order("applied_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Erreur lors de la récupération de l'historique: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ history: data ?? [] });
}
