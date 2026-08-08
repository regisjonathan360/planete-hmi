/**
 * POST /api/admin/audiomack/reclassify
 *
 * Reclassement basé sur les statistiques réelles extraites.
 * Deux modes :
 *  - preview: retourne le comparatif avant/après sans modifier les données
 *  - apply: applique le reclassement et retourne l'historyId
 *
 * Body: { mode: 'preview' | 'apply', editionId: string, coefficients: { plays, likes, reposts } }
 *
 * Protégé par requireAdmin.
 */
import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  previewReclassification,
  applyReclassification,
} from "@/lib/audiomack/reclassification-engine";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["preview", "apply"]),
  editionId: z.string().uuid("editionId doit être un UUID valide."),
  coefficients: z.object({
    plays: z.number().min(0, "Le coefficient plays doit être ≥ 0."),
    likes: z.number().min(0, "Le coefficient likes doit être ≥ 0."),
    reposts: z.number().min(0, "Le coefficient reposts doit être ≥ 0."),
  }),
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

  const { mode, editionId, coefficients } = parsed.data;
  const supabase = createAdminClient();

  // Verify the edition exists
  const { data: edition, error: editionError } = await supabase
    .from("chart_editions")
    .select("id, status")
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

  if (mode === "preview") {
    try {
      const preview = await previewReclassification(supabase, editionId, coefficients);
      return NextResponse.json({
        status: "preview",
        editionId,
        coefficients,
        ...preview,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: "Erreur lors de la prévisualisation du reclassement.",
          details: err instanceof Error ? err.message : "Erreur inconnue",
        },
        { status: 500 }
      );
    }
  }

  // mode === "apply"
  try {
    const result = await applyReclassification(
      supabase,
      editionId,
      coefficients,
      auth.user.email ?? auth.user.id
    );
    return NextResponse.json({
      status: "applied",
      editionId,
      historyId: result.historyId,
      coefficients,
      message: "Reclassement appliqué avec succès.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erreur lors de l'application du reclassement.",
        details: err instanceof Error ? err.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
