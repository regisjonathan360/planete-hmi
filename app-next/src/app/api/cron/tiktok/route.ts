/**
 * POST /api/cron/tiktok
 * Route cron protégée par CRON_SECRET pour la collecte planifiée TikTok.
 *
 * Enchaîne :
 * 1. Vérification du CRON_SECRET (header Authorization: Bearer <secret>)
 * 2. Collecte des vidéos (collector.runCollection)
 * 3. Recalcul des scores (score-engine.recalculate)
 * 4. Génération des classements (chart-builder.buildCharts)
 *
 * Requirements: 9.2, 9.3, 9.4, 11.1
 */
import { NextResponse } from "next/server";
import { runCollection } from "@/lib/tiktok/collector";
import { recalculate } from "@/lib/tiktok/score-engine";
import { buildCharts } from "@/lib/tiktok/chart-builder";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. Vérifier le CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    // 2. Lancer la collecte
    const collectionResult = await runCollection();

    if (!collectionResult.ok) {
      return NextResponse.json(
        { error: "Collecte échouée", details: collectionResult },
        { status: 500 }
      );
    }

    // 3. Recalculer les scores
    const scoreResult = await recalculate();

    // 4. Générer les classements
    await buildCharts();

    return NextResponse.json({
      status: "success",
      collection: collectionResult,
      scoring: scoreResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne." },
      { status: 500 }
    );
  }
}
