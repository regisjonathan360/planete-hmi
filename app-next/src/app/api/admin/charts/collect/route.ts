/**
 * POST /api/admin/charts/collect
 * Étape 2 de la collecte : reçoit les entrées déjà scrapées (du client)
 * et les enregistre en BROUILLON dans Supabase.
 *
 * Body: { sourceKey?: string, entries: [...], sourceUpdatedAt?: string }
 *
 * Si `entries` n'est pas fourni, fait le scraping inline (fallback).
 * Séparé en 2 étapes pour rester sous le Proxied Request Timeout de 30s
 * sur Vercel Hobby.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/audiomack/provider";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";
import { getAdminChartData } from "@/lib/charts/admin/queries";
import { enrichArtistImages } from "@/lib/audiomack/enrich-artist-images";
import type { AudiomackNormalizedEntry } from "@/lib/audiomack/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let sourceKey = "audiomack_haiti_weekly100";
  let entries: AudiomackNormalizedEntry[] | null = null;
  let sourceUpdatedAt: string | null = null;

  try {
    const body = await request.json();
    if (body?.sourceKey) sourceKey = String(body.sourceKey);
    if (Array.isArray(body?.entries) && body.entries.length > 0) {
      entries = body.entries;
      sourceUpdatedAt = body.sourceUpdatedAt ?? null;
    }
  } catch {
    // corps vide accepté — fallback scraping inline
  }

  const supabase = createAdminClient();

  // Fallback : si le client n'a pas envoyé les entrées, scraper inline
  if (!entries) {
    const provider = getProvider();
    let result;
    try {
      result = await provider.fetchChart();
    } catch (err) {
      return NextResponse.json(
        {
          status: "error",
          provider: provider.name,
          error: err instanceof Error ? err.message : "Erreur inconnue lors de la collecte.",
        },
        { status: 502 }
      );
    }

    if (!result.ok || !result.entries.length) {
      return NextResponse.json(
        {
          status: "error",
          provider: provider.name,
          error: result.error ?? "Aucune donnée reçue de la plateforme.",
        },
        { status: 200 }
      );
    }
    entries = result.entries;
    sourceUpdatedAt = result.sourceUpdatedAt ?? null;
  }

  // Snapshot (déduplication) + brouillon éditable.
  const { created } = await saveSnapshot(supabase, entries, {
    sourceUpdatedAt,
  });

  let draft;
  try {
    draft = await syncAudiomackEntriesToChartsDraft(supabase, entries, {
      sourceUpdatedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "Enregistrement du brouillon échoué.",
      },
      { status: 200 }
    );
  }

  await recomputeAdminEdition(supabase, draft.editionId, {
    action: "collect",
    changedBy: auth.user.id,
  });

  // Enrichir les photos de profil des artistes (fetch og:image depuis Audiomack).
  const enrichResult = await enrichArtistImages(supabase, draft.editionId);

  await supabase.from("chart_entry_history").insert({
    chart_edition_id: draft.editionId,
    action: "collect",
    source: "audiomack",
    is_manual: true,
    note: `Collecte manuelle : ${draft.imported} entrées importées. ${enrichResult.enriched}/${enrichResult.total} photos artistes récupérées.`,
    changed_by: auth.user.id,
  });

  // Résumé
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
    message: `Collecte réussie : ${draft.imported} musiques, ${data.summary.distinctAlbums} albums, ${data.summary.distinctArtists} artistes. ${enrichResult.enriched} photos récupérées.`,
  });
}
