/**
 * POST /api/cron/audiomack - scheduled Audiomack Haiti collection.
 * Keeps the original Audiomack source order, then publishes the filtered HMI
 * edition according to the admin artist statuses.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/audiomack/provider";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToCharts } from "@/lib/audiomack/chart-sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const provider = getProvider();
  const supabase = createAdminClient();

  const result = await provider.fetchChart();
  if (!result.ok || !result.entries.length) {
    await supabase.from("chart_snapshots").insert({
      platform: "audiomack",
      country_code: "HT",
      chart_name: "Weekly 100: Haiti",
      source_url: "https://audiomack.com/geo-charts/playlist/haiti",
      source_updated_at: result.sourceUpdatedAt ?? null,
      status: "error",
      error_message: result.error ?? "Aucune donnee recue.",
    });
    return NextResponse.json({
      status: "error",
      provider: provider.name,
      message: result.error ?? "Collecte echouee. Dernier classement conserve.",
    });
  }

  const { created, error } = await saveSnapshot(supabase, result.entries, {
    sourceUpdatedAt: result.sourceUpdatedAt ?? null,
  });
  const synced = await syncAudiomackEntriesToCharts(supabase, result.entries, {
    sourceUpdatedAt: result.sourceUpdatedAt ?? null,
  });

  return NextResponse.json({
    status: created ? "success" : "no_change",
    provider: provider.name,
    entries: result.entries.length,
    eligibleEntries: synced.eligible,
    editionId: synced.editionId,
    message: error ?? (created ? "Nouveau snapshot enregistre." : "Contenu identique."),
  });
}
