/**
 * GET/POST /api/cron/radio
 *
 * Rejoue automatiquement les collectes de classements configurées, puis
 * matérialise leurs previews audio autorisées en playlists radio jouables.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAllRadioSources } from "@/lib/radio/auto-sync";
import { collectPlaylistChart } from "@/lib/charts/playlist-collect";
import { PLAYLIST_CHART_SOURCES } from "@/lib/charts/playlist-sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorise." }, { status: 401 });

  const supabase = createAdminClient();
  const collectionResults: Array<{ sourceKey: string; ok: boolean; error?: string }> = [];

  // Les playlists Spotify publiques sont relues automatiquement. Le pipeline
  // conserve les classements en brouillon, tandis que la radio peut utiliser
  // les previews immédiatement sans publier une nouvelle page de classement.
  for (const source of PLAYLIST_CHART_SOURCES) {
    try {
      await collectPlaylistChart(supabase, source.sourceKey);
      collectionResults.push({ sourceKey: source.sourceKey, ok: true });
    } catch (error) {
      collectionResults.push({
        sourceKey: source.sourceKey,
        ok: false,
        error: error instanceof Error ? error.message : "Collecte impossible.",
      });
    }
  }

  const radio = await syncAllRadioSources(supabase);
  return NextResponse.json({ status: radio.status, collections: collectionResults, radio });
}
