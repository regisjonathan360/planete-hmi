/**
 * POST /api/cron/producers — détection planifiée des producteurs / beatmakers.
 *
 * Relit les titres du catalogue, crée les fiches manquantes (marquées
 * `is_auto_generated`, donc cantonnées à la page Producteurs jusqu'à validation
 * en admin), enrichit via Spotify puis complète les photos de profil vides
 * depuis les plateformes rattachées.
 *
 * Comme les collectes de classements, rien n'est publié : tout crédit détecté
 * reste « à confirmer » jusqu'à validation humaine.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncProducers } from "@/lib/producers/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Fenêtre volontairement modeste : la route doit tenir dans maxDuration.
    const report = await syncProducers(supabase, { trackLimit: 300 });

    const { data: backfill } = await supabase.rpc("backfill_artist_images", { p_limit: 500 });
    const backfillRow = Array.isArray(backfill) ? backfill[0] : backfill;

    return NextResponse.json({
      status: "ok",
      ...report,
      imagesCompleted: Number(backfillRow?.updated_count ?? 0),
      imagesRemaining: Number(backfillRow?.remaining_count ?? 0),
      message: `${report.productionsLinked} crédit(s) rattaché(s), ${report.producersCreated} fiche(s) créée(s).`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Synchronisation impossible.",
      },
      { status: 500 },
    );
  }
}
