/**
 * Collecte d'un classement alimenté par une playlist Spotify.
 *
 * Réutilise le pipeline commun (snapshot → brouillon éditable → renumérotation)
 * pour que ces classements se gèrent exactement comme Audiomack ou Deezer.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readSpotifyPlaylist } from "@/lib/spotify/playlist";
import { saveSnapshot } from "@/lib/audiomack/snapshot-service";
import { syncAudiomackEntriesToChartsDraft } from "@/lib/audiomack/chart-sync-draft";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";
import type { AudiomackNormalizedEntry } from "@/lib/audiomack/types";
import { findPlaylistChartSource, type PlaylistChartSource } from "./playlist-sources";

export interface PlaylistCollectProgress {
  phase: string;
  percent: number;
  message: string;
  [key: string]: unknown;
}

export interface PlaylistCollectReport {
  sourceKey: string;
  playlistName: string;
  playlistUrl: string;
  method: "web_api" | "embed";
  found: number;
  imported: number;
  excluded: number;
  snapshotCreated: boolean;
  warnings: string[];
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "inconnu"
  );
}

/** Playlist configurée en base, sinon celle fournie par défaut par le code. */
async function resolvePlaylistUrl(
  supabase: SupabaseClient,
  source: PlaylistChartSource,
): Promise<string> {
  const { data } = await supabase
    .from("chart_sources")
    .select("source_url")
    .eq("source_key", source.sourceKey)
    .maybeSingle();

  const configured = (data?.source_url as string | null)?.trim();
  return configured || source.defaultPlaylistUrl;
}

export async function collectPlaylistChart(
  supabase: SupabaseClient,
  sourceKey: string,
  options: {
    changedBy?: string | null;
    onProgress?: (progress: PlaylistCollectProgress) => void;
  } = {},
): Promise<PlaylistCollectReport> {
  const source = findPlaylistChartSource(sourceKey);
  if (!source) {
    throw new Error(`Classement « ${sourceKey} » inconnu ou non alimenté par une playlist.`);
  }

  const emit = (progress: PlaylistCollectProgress) => options.onProgress?.(progress);

  emit({ phase: "init", percent: 4, message: `Préparation de ${source.displayName}...` });

  const playlistUrl = await resolvePlaylistUrl(supabase, source);

  emit({ phase: "scraping", percent: 12, message: "Lecture de la playlist Spotify..." });
  const playlist = await readSpotifyPlaylist(playlistUrl, { limit: source.limit });
  const warnings = [...playlist.warnings];

  emit({
    phase: "scraped",
    percent: 45,
    message: `« ${playlist.playlistName} » — ${playlist.tracks.length} titre(s).`,
    found: playlist.tracks.length,
  });

  const entries: AudiomackNormalizedEntry[] = playlist.tracks.map((track, index) => {
    const artistText = track.artistNames.join(", ") || "Artiste inconnu";
    return {
      // La plateforme du classement, pas celle de la playlist : un classement
      // TikTok reste un classement TikTok même si la liste vient de Spotify.
      platform: source.platform,
      countryCode: "HT",
      rank: index + 1,
      platformTrackId: track.id,
      title: track.title,
      artistName: artistText,
      artworkUrl: track.artworkUrl,
      artistImageUrl: null,
      sourceTrackUrl: track.url,
      artistSlug: slugify(track.artistNames[0] ?? artistText),
      trackSlug: slugify(track.title),
      albumName: track.albumName,
      genre: null,
    };
  });

  emit({ phase: "inserting", percent: 55, message: "Enregistrement de l'instantané..." });
  const snapshot = await saveSnapshot(supabase, entries, {
    sourceUpdatedAt: new Date().toISOString(),
    identity: {
      platform: source.platform,
      chartName: source.displayName,
      sourceUrl: playlist.playlistUrl,
    },
  });
  if (!snapshot.created && snapshot.error) {
    // Contenu identique ou validation refusée : information, pas blocage.
    warnings.push(snapshot.error);
  }

  emit({ phase: "inserting", percent: 70, message: "Construction du brouillon éditable..." });
  const draft = await syncAudiomackEntriesToChartsDraft(supabase, entries, {
    sourceUpdatedAt: new Date().toISOString(),
    sourceKey: source.sourceKey,
  });

  emit({ phase: "inserting", percent: 88, message: "Renumérotation des positions..." });
  await recomputeAdminEdition(supabase, draft.editionId, {
    action: "collect",
    source: source.platform,
    changedBy: options.changedBy ?? null,
  });

  const report: PlaylistCollectReport = {
    sourceKey: source.sourceKey,
    playlistName: playlist.playlistName,
    playlistUrl: playlist.playlistUrl,
    method: playlist.method,
    found: playlist.tracks.length,
    imported: draft.imported,
    excluded: draft.excluded,
    snapshotCreated: snapshot.created,
    warnings,
  };

  emit({
    phase: "done",
    percent: 100,
    message:
      `Collecte terminée — ${draft.imported} titre(s) dans « ${source.displayName} »` +
      (draft.excluded ? `, ${draft.excluded} exclu(s) automatiquement. ` : ". ") +
      "Publiez pour rendre le classement visible.",
    ...report,
    warnings: warnings.length > 0 ? warnings : undefined,
  });

  return report;
}
