/**
 * POST /api/admin/tiktok/collect
 * Déclenche une collecte manuelle TikTok (même pipeline que le cron).
 *
 * Protégé par requireAdmin.
 * Body optionnel : { start_date?: string, end_date?: string }
 *
 * Requirements: 9.1, 7.3, 6.6
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { runCollection } from "@/lib/tiktok/collector";
import { recalculate } from "@/lib/tiktok/score-engine";
import { buildCharts } from "@/lib/tiktok/chart-builder";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    // Optional body params: { start_date?, end_date? }
    let params: { start_date?: string; end_date?: string } = {};
    try {
      params = await request.json();
    } catch {
      /* no body is fine */
    }

    const collectionResult = await runCollection(params);
    if (!collectionResult.ok) {
      return NextResponse.json(
        { error: "Collecte échouée", details: collectionResult },
        { status: 500 }
      );
    }

    const scoreResult = await recalculate();
    await buildCharts();

    return NextResponse.json({
      status: "success",
      collection: collectionResult,
      scoring: scoreResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur collecte." },
      { status: 500 }
    );
  }
}
