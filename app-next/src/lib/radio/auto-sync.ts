import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlayableAudioUrl, resolveAudioUrl } from "./audio";

/**
 * Sources alimentées automatiquement. Une source de classement peut contenir
 * des pages Spotify/Audiomack/YouTube, mais seules les previews officielles
 * ou les URLs audio directes entrent dans la radio.
 */
export const AUTO_RADIO_SOURCE_KEYS = [
  "deezer_haiti_top100",
  "spotify_haiti_popular",
  "tiktok_haiti_viral_playlist",
  "audiomack_haiti_weekly100",
] as const;

const EDITION_STATUSES = ["published", "ready", "validated", "imported", "draft"] as const;

interface SyncResult {
  sourceKey: string;
  sourceName: string;
  editionId: string | null;
  playlistId: string | null;
  found: number;
  playable: number;
  skipped: number;
  error?: string;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getArtist(track: any): { id?: string; name: string } {
  const credits = Array.isArray(track.track_artists) ? track.track_artists : [];
  const credit = credits.find((item: any) => item.role === "primary") ?? credits[0];
  const artist = firstRelation(credit?.artists);
  return {
    id: artist?.id ?? credit?.artist_id ?? undefined,
    name: artist?.name ?? "Artiste inconnu",
  };
}

async function getSource(supabase: SupabaseClient, sourceKey: string) {
  const { data, error } = await supabase
    .from("chart_sources")
    .select("id, display_name, platform")
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (error) throw new Error("Source " + sourceKey + ": " + error.message);
  return data;
}

async function getLatestEdition(supabase: SupabaseClient, sourceId: string) {
  const { data, error } = await supabase
    .from("chart_editions")
    .select("id, edition_key, status, collected_at")
    .eq("chart_source_id", sourceId)
    .in("status", [...EDITION_STATUSES])
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Édition radio: " + error.message);
  return data;
}

async function ensurePlaylist(
  supabase: SupabaseClient,
  sourceName: string,
): Promise<string> {
  const name = "Auto radio — " + sourceName;
  const { data: existing, error: findError } = await supabase
    .from("radio_playlists")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (findError) throw new Error("Playlist radio: " + findError.message);
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("radio_playlists")
    .insert({
      name,
      description: "Mise à jour automatique depuis le classement et ses previews audio autorisées.",
      is_active: true,
      shuffle_enabled: false,
      repeat_enabled: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Création playlist radio: " + (error?.message ?? "aucune donnée"));
  return data.id;
}

export async function syncRadioSource(
  supabase: SupabaseClient,
  sourceKey: string,
): Promise<SyncResult> {
  const source = await getSource(supabase, sourceKey);
  if (!source) {
    return {
      sourceKey,
      sourceName: sourceKey,
      editionId: null,
      playlistId: null,
      found: 0,
      playable: 0,
      skipped: 0,
      error: "Source non configurée.",
    };
  }

  const edition = await getLatestEdition(supabase, source.id);
  if (!edition) {
    return {
      sourceKey,
      sourceName: source.display_name,
      editionId: null,
      playlistId: null,
      found: 0,
      playable: 0,
      skipped: 0,
      error: "Aucune édition collectée.",
    };
  }

  const { data: entries, error: entriesError } = await supabase
    .from("chart_entries")
    .select("track_id, source_position, filtered_position, tracks(id, title, duration_ms, default_artwork_url, track_artists(artist_id, role, artists(id, name)), platform_tracks(platform, external_id, external_url, preview_url, audio_url))")
    .eq("chart_edition_id", edition.id)
    .order("filtered_position", { ascending: true, nullsFirst: false })
    .order("source_position", { ascending: true });

  if (entriesError) throw new Error("Entrées " + sourceKey + ": " + entriesError.message);

  const rows = (entries ?? [])
    .map((entry: any, index: number) => {
      const track = firstRelation(entry.tracks);
      if (!track?.id) return null;
      const audioUrl = resolveAudioUrl("", track.platform_tracks ?? []);
      const artist = getArtist(track);
      return {
        track,
        audioUrl,
        artist,
        position: entry.filtered_position ?? entry.source_position ?? index + 1,
      };
    })
    .filter(Boolean) as Array<{
      track: any;
      audioUrl: string;
      artist: { id?: string; name: string };
      position: number;
    }>;

  const playableRows = rows.filter((row) => isPlayableAudioUrl(row.audioUrl));
  const playlistId = await ensurePlaylist(supabase, source.display_name);

  if (rows.length) {
    const radioTracks = rows.map((row) => ({
      id: row.track.id,
      title: row.track.title,
      artist_name: row.artist.name,
      artist_id: row.artist.id ?? null,
      audio_url: row.audioUrl,
      cover_image_url: row.track.default_artwork_url ?? null,
      duration_seconds: Math.floor((row.track.duration_ms ?? 0) / 1000),
      source: "chart",
      source_id: edition.id,
      is_active: Boolean(row.audioUrl),
    }));
    const { error: upsertError } = await supabase
      .from("radio_tracks")
      .upsert(radioTracks, { onConflict: "id" });
    if (upsertError) throw new Error("Pistes radio " + sourceKey + ": " + upsertError.message);
  }

  await supabase.from("radio_playlist_tracks").delete().eq("playlist_id", playlistId);
  if (playableRows.length) {
    const { error: linksError } = await supabase
      .from("radio_playlist_tracks")
      .insert(
        playableRows.map((row) => ({
          playlist_id: playlistId,
          track_id: row.track.id,
          track_position: row.position,
        })),
      );
    if (linksError) throw new Error("Liens playlist " + sourceKey + ": " + linksError.message);
  }

  return {
    sourceKey,
    sourceName: source.display_name,
    editionId: edition.id,
    playlistId,
    found: rows.length,
    playable: playableRows.length,
    skipped: rows.length - playableRows.length,
  };
}

export async function syncAllRadioSources(
  supabase: SupabaseClient,
  sourceKeys: readonly string[] = AUTO_RADIO_SOURCE_KEYS,
) {
  const { data: config, error: configError } = await supabase
    .from("radio_config")
    .select("id, auto_sync_enabled, auto_source_key")
    .limit(1)
    .maybeSingle();
  if (configError) throw new Error("Configuration radio automatique: " + configError.message);
  if (config && config.auto_sync_enabled === false) {
    return { status: "disabled" as const, preferred: null, results: [] as SyncResult[] };
  }

  const preferredKey = config?.auto_source_key;
  const orderedKeys = [
    ...(preferredKey && sourceKeys.includes(preferredKey) ? [preferredKey] : []),
    ...sourceKeys.filter((key) => key !== preferredKey),
  ];
  const results: SyncResult[] = [];
  for (const sourceKey of orderedKeys) {
    try {
      results.push(await syncRadioSource(supabase, sourceKey));
    } catch (error) {
      results.push({
        sourceKey,
        sourceName: sourceKey,
        editionId: null,
        playlistId: null,
        found: 0,
        playable: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : "Synchronisation impossible.",
      });
    }
  }

  const preferred =
    results.find((result) => result.sourceKey === preferredKey && result.playable > 0) ??
    results.find((result) => result.playable > 0) ??
    null;

  if (config?.id) {
    await supabase
      .from("radio_config")
      .update({
        active_playlist_id: preferred?.playlistId ?? null,
        auto_switch_to_chart: Boolean(preferred),
        chart_source_key: preferred?.sourceKey ?? null,
        is_live: Boolean(preferred),
        last_auto_sync_at: new Date().toISOString(),
        last_auto_sync_status: preferred ? "ok" : "no_playable_source",
        last_auto_sync_error: preferred ? null : "Aucune preview ou URL audio directe disponible.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);
  }

  return {
    status: preferred ? ("ok" as const) : ("no_playable_source" as const),
    preferred,
    results,
  };
}
