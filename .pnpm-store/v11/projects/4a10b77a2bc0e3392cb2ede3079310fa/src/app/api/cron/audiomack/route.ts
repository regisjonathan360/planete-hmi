/**
 * POST /api/cron/audiomack — collecte planifiée Audiomack Haiti.
 *
 * IMPORTANT : la collecte n'AUTO-PUBLIE PLUS. Elle enregistre en brouillon.
 * La publication reste manuelle depuis l'administration (/admin/audiomack),
 * conformément au principe « rien n'est public tant que l'admin ne publie pas ».
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/audiomack/provider";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro: max 60s pour le scraping Audiomack

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

  const draft = await syncAudiomackEntriesToChartsDraft(supabase, result.entries, {
    sourceUpdatedAt: result.sourceUpdatedAt ?? null,
  });

  await recomputeAdminEdition(supabase, draft.editionId, {
    action: "collect",
    source: "audiomack",
  });

  await supabase.from("chart_entry_history").insert({
    chart_edition_id: draft.editionId,
    action: "collect",
    source: "audiomack",
    is_manual: false,
    note: `Collecte cron : ${draft.imported} entrées (brouillon).`,
  });

  return NextResponse.json({
    status: created ? "collected" : "no_change",
    provider: provider.name,
    entries: result.entries.length,
    editionId: draft.editionId,
    message:
      error ??
      (created
        ? "Nouveau brouillon collecté. Publication manuelle requise dans l'admin."
        : "Contenu identique au dernier snapshot."),
  });
}
