/**
 * POST /api/admin/charts/collect-local
 * Endpoint pour recevoir les entrées scrapées depuis une machine locale.
 * Authentifié par CRON_SECRET ou ADMIN_SECRET (Bearer token).
 *
 * Utilisé quand Audiomack bloque les IPs datacenter (Vercel).
 * Le script local (scripts/collect-local.mjs) scrape la page depuis
 * une IP résidentielle et envoie les entrées ici.
 *
 * Body: { entries: AudiomackNormalizedEntry[], sourceUpdatedAt?: string }
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";
import { getAdminChartData } from "@/lib/charts/admin/queries";
import { enrichArtistImages } from "@/lib/audiomack/enrich-artist-images";
import type { AudiomackNormalizedEntry } from "@/lib/audiomack/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;
  if (cronSecret && token === cronSecret) return true;
  if (adminSecret && token === adminSecret) return true;
  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let entries: AudiomackNormalizedEntry[];
  let sourceUpdatedAt: string | null = null;
  let sourceKey = "audiomack_haiti_weekly100";

  try {
    const body = await request.json();
    if (!Array.isArray(body?.entries) || body.entries.length === 0) {
      return NextResponse.json({ status: "error", error: "Aucune entrée fournie." }, { status: 400 });
    }
    entries = body.entries;
    sourceUpdatedAt = body.sourceUpdatedAt ?? null;
    if (body.sourceKey) sourceKey = String(body.sourceKey);
  } catch {
    return NextResponse.json({ status: "error", error: "Body JSON invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Snapshot (déduplication)
  const { created } = await saveSnapshot(supabase, entries, { sourceUpdatedAt });

  // Brouillon éditable
  let draft;
  try {
    draft = await syncAudiomackEntriesToChartsDraft(supabase, entries, { sourceUpdatedAt, sourceKey });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      error: err instanceof Error ? err.message : "Enregistrement brouillon échoué.",
    }, { status: 200 });
  }

  await recomputeAdminEdition(supabase, draft.editionId, {
    action: "collect",
    source: "audiomack",
  });

  // Enrichir photos artistes
  const enrichResult = await enrichArtistImages(supabase, draft.editionId);

  await supabase.from("chart_entry_history").insert({
    chart_edition_id: draft.editionId,
    action: "collect",
    source: "audiomack",
    is_manual: true,
    note: `Collecte locale : ${draft.imported} entrées. ${enrichResult.enriched} photos.`,
  });

  const data = await getAdminChartData(supabase, sourceKey);

  return NextResponse.json({
    status: "collected",
    snapshotCreated: created,
    collectedAt: new Date().toISOString(),
    summary: {
      musiques: data.summary.totalEntries,
      albums: data.summary.distinctAlbums,
      artistes: data.summary.distinctArtists,
      aValider: data.summary.pendingArtists,
      photosArtistes: enrichResult.enriched,
    },
    message: `Collecte locale réussie : ${draft.imported} musiques importées.`,
  });
}
