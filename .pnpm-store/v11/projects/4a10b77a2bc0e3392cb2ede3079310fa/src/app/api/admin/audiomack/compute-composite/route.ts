/**
 * POST /api/admin/audiomack/compute-composite
 *
 * Calcule le classement composite multi-genres et le persiste en brouillon.
 * - Appelle buildComposite() pour fusionner les éditions publiées
 * - Appelle saveCompositeEdition() pour persister le résultat
 * - Retourne les entrées calculées + avertissements
 *
 * Protégé par requireAdmin.
 */
import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildComposite, saveCompositeEdition } from "@/lib/audiomack/composite-builder";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();

  // Compute composite scores from published editions
  let result;
  try {
    result = await buildComposite(supabase);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erreur lors du calcul du composite.",
        details: err instanceof Error ? err.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }

  const { entries, warnings } = result;

  if (entries.length === 0) {
    return NextResponse.json(
      {
        status: "empty",
        entries: [],
        warnings,
        message: "Aucune entrée composite calculée. Vérifiez que des éditions sont publiées avec un poids > 0.",
      },
      { status: 200 }
    );
  }

  // Determine period (use current week: Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Save as draft edition
  let editionId: string;
  try {
    const saveResult = await saveCompositeEdition(supabase, entries, {
      periodStart: monday.toISOString(),
      periodEnd: sunday.toISOString(),
    });
    editionId = saveResult.editionId;
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erreur lors de la sauvegarde de l'édition composite.",
        details: err instanceof Error ? err.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "draft_saved",
    editionId,
    entryCount: entries.length,
    entries: entries.map((e, i) => ({
      position: i + 1,
      title: e.title,
      artistName: e.artistName,
      compositeScore: e.compositeScore,
      genreCount: e.genreCount,
      bestPosition: e.bestPosition,
      contributions: e.contributions,
    })),
    warnings,
    message: `Classement composite calculé avec ${entries.length} entrées — sauvegardé en brouillon.`,
  });
}
