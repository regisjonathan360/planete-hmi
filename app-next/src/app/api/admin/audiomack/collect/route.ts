/**
 * POST /api/admin/audiomack/collect
 *
 * Route admin sécurisée pour lancer manuellement la collecte Audiomack
 * Weekly 100: Haiti. Les résultats sont enregistrés en BROUILLON (draft),
 * pas publiés automatiquement.
 *
 * Sécurité : nécessite un header Authorization Bearer avec ADMIN_SECRET.
 */
import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/audiomack/provider";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // --- Authentification admin ---
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET non configuré sur le serveur." },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json(
      { error: "Non autorisé. Header Authorization manquant ou invalide." },
      { status: 401 }
    );
  }

  // --- Vérification des clés Audiomack ---
  const provider = getProvider();

  // --- Collecte ---
  let result;
  try {
    result = await provider.fetchChart();
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        provider: provider.name,
        error: err instanceof Error ? err.message : "Erreur inconnue lors de la collecte Audiomack.",
      },
      { status: 502 }
    );
  }

  if (!result.ok || !result.entries.length) {
    const supabase = createAdminClient();
    // Enregistrer l'échec dans les snapshots pour traçabilité
    await supabase.from("chart_snapshots").insert({
      platform: "audiomack",
      country_code: "HT",
      chart_name: "Weekly 100: Haiti",
      source_url: "https://audiomack.com/geo-charts/playlist/haiti",
      source_updated_at: result.sourceUpdatedAt ?? null,
      status: "error",
      error_message: result.error ?? "Aucune donnée reçue.",
    });

    return NextResponse.json(
      {
        status: "error",
        provider: provider.name,
        entries: 0,
        error: result.error ?? "Audiomack n'a retourné aucune donnée.",
      },
      { status: 200 }
    );
  }

  // --- Sauvegarde snapshot ---
  const supabase = createAdminClient();
  const { created, error: snapshotError } = await saveSnapshot(supabase, result.entries, {
    sourceUpdatedAt: result.sourceUpdatedAt ?? null,
  });

  // --- Enregistrement en BROUILLON (draft) ---
  let draftResult;
  try {
    draftResult = await syncAudiomackEntriesToChartsDraft(supabase, result.entries, {
      sourceUpdatedAt: result.sourceUpdatedAt ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "partial_error",
        provider: provider.name,
        snapshotCreated: created,
        entries: result.entries.length,
        error: err instanceof Error ? err.message : "Erreur lors de l'enregistrement en brouillon.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    status: "draft_saved",
    provider: provider.name,
    snapshotCreated: created,
    snapshotNote: snapshotError ?? (created ? "Nouveau snapshot enregistré." : "Contenu identique au précédent."),
    entries: result.entries.length,
    editionId: draftResult.editionId,
    imported: draftResult.imported,
    message: `Collecte réussie. ${draftResult.imported} entrées enregistrées en brouillon. Validation requise dans l'admin.`,
  });
}
