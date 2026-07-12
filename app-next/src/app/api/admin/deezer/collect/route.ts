/**
 * POST /api/admin/deezer/collect
 * Collecte manuelle Deezer Haiti depuis l'admin.
 * L'API Deezer est publique — pas de blocage IP, pas besoin de Playwright.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";
import { getAdminChartData } from "@/lib/charts/admin/queries";
import type { AudiomackNormalizedEntry } from "@/lib/audiomack/types";

export const dynamic = "force-dynamic";

const PLAYLIST_ID = "15034575123";
const SOURCE_KEY = "deezer_haiti_top100";

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Fetch Deezer API (publique, pas de clé)
  let tracks: { id: number; title: string; artist: { name: string; picture_medium?: string }; album?: { title?: string; cover_medium?: string }; link?: string }[];
  try {
    const res = await fetch(`https://api.deezer.com/playlist/${PLAYLIST_ID}/tracks?limit=100`, {
      cache: "no-store",
    });
    const data = await res.json();
    tracks = data.data ?? [];
    if (!tracks.length) {
      return NextResponse.json({ status: "error", error: "Playlist Deezer vide." }, { status: 200 });
    }
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : "Erreur réseau Deezer." },
      { status: 200 }
    );
  }

  // Normaliser
  const entries: AudiomackNormalizedEntry[] = tracks.slice(0, 100).map((track, index) => ({
    platform: "deezer",
    countryCode: "HT",
    rank: index + 1,
    platformTrackId: String(track.id),
    title: track.title,
    artistName: track.artist.name,
    artworkUrl: track.album?.cover_medium ?? null,
    artistImageUrl: track.artist.picture_medium ?? null,
    sourceTrackUrl: track.link ?? null,
    artistSlug: slugify(track.artist.name),
    trackSlug: slugify(track.title),
    albumName: track.album?.title ?? null,
    genre: null,
  }));

  const supabase = createAdminClient();
  const { created } = await saveSnapshot(supabase, entries, { sourceUpdatedAt: new Date().toISOString() });

  let draft;
  try {
    draft = await syncAudiomackEntriesToChartsDraft(supabase, entries, {
      sourceUpdatedAt: new Date().toISOString(),
      sourceKey: SOURCE_KEY,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : "Brouillon échoué." },
      { status: 200 }
    );
  }

  await recomputeAdminEdition(supabase, draft.editionId, {
    action: "collect",
    source: "deezer",
    changedBy: auth.user.id,
  });

  const data = await getAdminChartData(supabase, SOURCE_KEY);

  return NextResponse.json({
    status: "collected",
    snapshotCreated: created,
    message: `Collecte Deezer réussie : ${draft.imported} musiques, ${data.summary.distinctArtists} artistes.`,
  });
}
