/**
 * POST /api/admin/audiomack/collect
 *
 * Route admin (session) pour lancer manuellement la collecte Audiomack.
 *
 * Corps acceptés :
 *   { "sourceKey": "audiomack_haiti_top_songs_gospel" }  → genre unique
 *   { "genres": "all" }                                  → tous les genres
 *   { } (ou {"sourceKey":"audiomack_haiti_weekly100"})   → chart principale
 *
 * Sources de données (par ordre) :
 *   1. API officielle Audiomack (chart/weekly ?country=HT) — 100 titres,
 *      filtrage genre fiable. `country=HT` est impératif : `country=haiti`
 *      est ignoré par l'API et renvoie le classement MONDIAL.
 *   2. Page officielle audiomack.com/top/songs (repli SSR).
 *
 * Les résultats sont enregistrés en BROUILLON (draft), jamais publiés.
 */
import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAudiomackChart } from "@/lib/audiomack/provider";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";
import {
  AUDIOMACK_HAITI_CHART_SOURCES,
} from "@/lib/charts/audiomack-sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CollectResult {
  sourceKey: string;
  genreId: string | "all";
  ok: boolean;
  entries: number;
  imported?: number;
  excluded?: number;
  message?: string;
  error?: string;
}

/** Collecte une source Audiomack (chart principale ou genre) et enregistre snapshot + brouillon. */
async function collectSource(supabase: ReturnType<typeof createAdminClient>, sourceKey: string): Promise<CollectResult> {
  const source = AUDIOMACK_HAITI_CHART_SOURCES.find((s) => s.sourceKey === sourceKey);
  if (!source) {
    return { sourceKey, genreId: "all", ok: false, entries: 0, error: `Source « ${sourceKey} » inconnue.` };
  }

  const base: CollectResult = { sourceKey, genreId: source.genreId, ok: false, entries: 0 };
  const isWeekly = source.genreId === "all";
  const result = await fetchAudiomackChart({
    genreId: isWeekly ? null : source.genreId,
    sourceUrl: source.sourceUrl,
  });

  if (!result.ok) {
    return { ...base, error: result.error ?? "Échec de la collecte." };
  }
  if (!result.entries.length) {
    return {
      ...base,
      ok: true,
      message: result.error ?? "Aucune entrée renvoyée par Audiomack pour cette source.",
    };
  }

  // Snapshot de traçabilité, isolé par source (évite les doublons croisés).
  const { created, error: snapshotError } = await saveSnapshot(supabase, result.entries, {
    sourceUpdatedAt: result.sourceUpdatedAt ?? null,
    identity: {
      platform: "audiomack",
      chartName: isWeekly ? "Weekly 100: Haiti" : source.chartContext,
      sourceUrl: isWeekly ? "https://audiomack.com/geo-charts/playlist/haiti" : source.sourceUrl,
    },
  });

  // Brouillon pour validation admin (sourceKey précis pour ne pas écraser une autre source).
  const draft = await syncAudiomackEntriesToChartsDraft(supabase, result.entries, {
    sourceUpdatedAt: result.sourceUpdatedAt ?? null,
    sourceKey,
  });

  return {
    ...base,
    ok: true,
    entries: draft.imported,
    excluded: draft.excluded,
    message: `${draft.imported} entrée(s) en brouillon${draft.excluded ? `, ${draft.excluded} exclue(s)` : ""}${created ? "" : ` (${snapshotError ?? "contenu identique"})`}.`,
  };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { sourceKey?: string; genres?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Corps absent : on traite la chart principale.
  }

  const supabase = createAdminClient();
  const genresRequested = body.genres === "all";
  const targetKeys = genresRequested
    ? AUDIOMACK_HAITI_CHART_SOURCES.filter((s) => s.genreId !== "all").map((s) => s.sourceKey)
    : [body.sourceKey ?? "audiomack_haiti_weekly100"];

  const results: CollectResult[] = [];
  const collectSafe = async (sourceKey: string): Promise<CollectResult> => {
    try {
      return await collectSource(supabase, sourceKey);
    } catch (err) {
      return {
        sourceKey,
        genreId: "all",
        ok: false,
        entries: 0,
        error: err instanceof Error ? err.message : "Erreur inattendue.",
      };
    }
  };

  // Lots de 4 pour rester sous les limites de durée/fuite de la route.
  for (let i = 0; i < targetKeys.length; i += 4) {
    const batch = targetKeys.slice(i, i + 4);
    results.push(...(await Promise.all(batch.map((key) => collectSafe(key)))));
  }

  const failed = results.filter((r) => r.error);
  if (genresRequested) {
    // Collecte groupée : on remonte tout, même partiel, pour affichage admin.
    return NextResponse.json({
      status: failed.length === results.length ? "error" : "partial",
      provider: "audiomack",
      collected: results,
      message: `${results.length - failed.length}/${results.length} source(s) collectée(s)`,
      error: failed.length ? failed[0].error : undefined,
    });
  }

  const single = results[0];
  if (single.error) {
    return NextResponse.json({ status: "error", provider: "audiomack", error: single.error }, { status: 200 });
  }
  return NextResponse.json({
    status: "draft_saved",
    provider: "audiomack",
    sourceKey: single.sourceKey,
    entries: single.entries,
    message: single.message,
  });
}