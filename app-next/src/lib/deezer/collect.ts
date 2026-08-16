import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";
import type { AudiomackNormalizedEntry } from "@/lib/audiomack/types";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";

const DEFAULT_PLAYLIST_ID = "15034575123";

export async function collectDeezerChart(supabase: SupabaseClient) {
  const playlistId = process.env.DEEZER_HAITI_PLAYLIST_ID?.trim() || DEFAULT_PLAYLIST_ID;
  const response = await fetch(
    `https://api.deezer.com/playlist/${encodeURIComponent(playlistId)}/tracks?limit=100`,
    { cache: "no-store", signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw new Error(`Deezer a répondu HTTP ${response.status}.`);

  const payload = (await response.json()) as {
    data?: Array<{
      id: number;
      title: string;
      preview?: string | null;
      link?: string;
      artist?: { name?: string; picture_medium?: string };
      album?: { title?: string; cover_medium?: string };
    }>;
  };
  const tracks = payload.data ?? [];
  if (!tracks.length) throw new Error("La playlist Deezer ne contient aucun titre.");

  const entries: AudiomackNormalizedEntry[] = tracks.map((track, index) => ({
    platform: "deezer",
    countryCode: "HT",
    rank: index + 1,
    platformTrackId: String(track.id),
    title: track.title,
    artistName: track.artist?.name ?? "Artiste inconnu",
    artworkUrl: track.album?.cover_medium ?? null,
    artistImageUrl: track.artist?.picture_medium ?? null,
    sourceTrackUrl: track.link ?? `https://www.deezer.com/track/${track.id}`,
    previewUrl: track.preview ?? null,
    artistSlug: null,
    trackSlug: null,
    albumName: track.album?.title ?? null,
    genre: null,
  }));

  const collectedAt = new Date().toISOString();
  const snapshot = await saveSnapshot(supabase, entries, {
    sourceUpdatedAt: collectedAt,
    identity: {
      platform: "deezer",
      chartName: "Top 100 Haiti",
      sourceUrl: `https://www.deezer.com/playlist/${playlistId}`,
    },
  });
  const draft = await syncAudiomackEntriesToChartsDraft(supabase, entries, {
    sourceUpdatedAt: collectedAt,
    sourceKey: "deezer_haiti_top100",
  });
  await recomputeAdminEdition(supabase, draft.editionId, {
    action: "collect",
    source: "deezer",
  });

  return {
    playlistId,
    entries: entries.length,
    imported: draft.imported,
    excluded: draft.excluded,
    snapshotCreated: snapshot.created,
    editionId: draft.editionId,
  };
}
