/**
 * POST /api/admin/audiomack/extract-stats
 *
 * Lance l'extraction des statistiques (plays, likes, reposts, comments)
 * pour toutes les entrées d'une édition donnée.
 *
 * Body: { editionId: string }
 * Retourne: { extracted: number, failed: number }
 *
 * Protégé par requireAdmin.
 */
import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractEditionStats } from "@/lib/audiomack/stats-extractor";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  editionId: z.string().uuid("editionId doit être un UUID valide."),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { editionId } = parsed.data;
  const supabase = createAdminClient();

  // Verify the edition exists
  const { data: edition, error: editionError } = await supabase
    .from("chart_editions")
    .select("id, status, entry_count")
    .eq("id", editionId)
    .maybeSingle();

  if (editionError) {
    return NextResponse.json(
      { error: `Erreur lors de la vérification de l'édition: ${editionError.message}` },
      { status: 500 }
    );
  }

  if (!edition) {
    return NextResponse.json(
      { error: `Édition "${editionId}" introuvable.` },
      { status: 404 }
    );
  }

  // Run stats extraction
  let result;
  try {
    result = await extractEditionStats(supabase, editionId);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erreur lors de l'extraction des statistiques.",
        details: err instanceof Error ? err.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "completed",
    editionId,
    extracted: result.extracted,
    failed: result.failed,
    total: result.extracted + result.failed,
    message: `Extraction terminée : ${result.extracted} réussie(s), ${result.failed} échouée(s).`,
  });
}
