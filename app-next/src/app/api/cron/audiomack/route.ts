/**
 * POST /api/cron/audiomack — tâche planifiée de collecte.
 * Sécurisée par CRON_SECRET. Exécutée quotidiennement à 7h America/Port-au-Prince.
 * En cas d'erreur, conserve le dernier classement valide.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/audiomack/provider";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Vérifier le secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const provider = getProvider();
  const supabase = createAdminClient();

  // Fetch via le provider actif
  const result = await provider.fetchChart();
  if (!result.ok || !result.entries.length) {
    // Enregistrer l'échec sans supprimer le dernier snapshot valide
    await supabase.from("chart_snapshots").insert({
      platform: "audiomack",
      country_code: "HT",
      chart_name: "Weekly 100: Haiti",
      source_url: "https://audiomack.com/geo-charts/playlist/haiti",
      status: "error",
      error_message: result.error ?? "Aucune donnée reçue.",
    });
    return NextResponse.json({
      status: "error",
      provider: provider.name,
      message: result.error ?? "Collecte échouée. Dernier classement conservé.",
    });
  }

  // Sauvegarder
  const { created, error } = await saveSnapshot(supabase, result.entries);
  return NextResponse.json({
    status: created ? "success" : "no_change",
    provider: provider.name,
    entries: result.entries.length,
    message: error ?? (created ? "Nouveau snapshot enregistré." : "Contenu identique."),
  });
}
