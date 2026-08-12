/**
 * Requêtes Supabase pour le système de radio
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  RadioTrack,
  RadioPlaylist,
  RadioConfig,
  RadioStats,
  RadioPlayHistory,
  RadioPlaylistTrack,
} from "./types";

/**
 * Récupère la configuration globale de la radio
 */
export async function getRadioConfig(): Promise<RadioConfig | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("radio_config")
    .select("*")
    .single();

  if (error) {
    console.error("Error fetching radio config:", error);
    return null;
  }

  return data;
}

/**
 * Récupère la playlist active avec toutes ses pistes
 */
export async function getActivePlaylist(): Promise<{
  playlist: RadioPlaylist | null;
  tracks: RadioTrack[];
}> {
  const supabase = await createClient();
  const config = await getRadioConfig();

  if (!config?.active_playlist_id) {
    return { playlist: null, tracks: [] };
  }

  // Récupérer la playlist
  const { data: playlist, error: playlistError } = await supabase
    .from("radio_playlists")
    .select("*")
    .eq("id", config.active_playlist_id)
    .single();

  if (playlistError) {
    console.error("Error fetching active playlist:", playlistError);
    return { playlist: null, tracks: [] };
  }

  // Récupérer les pistes de la playlist
  const { data: playlistTracks, error: tracksError } = await supabase
    .from("radio_playlist_tracks")
    .select(`
      track_position,
      track:radio_tracks(*)
    `)
    .eq("playlist_id", config.active_playlist_id)
    .order("track_position", { ascending: true });

  if (tracksError) {
    console.error("Error fetching playlist tracks:", tracksError);
    return { playlist, tracks: [] };
  }

  const tracks = playlistTracks
    .map((pt: any) => pt.track)
    .filter((t: RadioTrack) => t?.is_active);

  return { playlist, tracks };
}

/**
 * Récupère les pistes d'un classement spécifique
 */
export async function getChartTracks(chartSourceKey: string): Promise<RadioTrack[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("radio_tracks")
    .select("*")
    .eq("source", "chart")
    .eq("source_id", chartSourceKey)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching chart tracks:", error);
    return [];
  }

  return data || [];
}

/**
 * Récupère toutes les playlists
 */
export async function getAllPlaylists(): Promise<RadioPlaylist[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("radio_playlists")
    .select(`
      *,
      track_count:radio_playlist_tracks(count)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching playlists:", error);
    return [];
  }

  return data || [];
}

/**
 * Récupère toutes les pistes radio
 */
export async function getAllRadioTracks(limit = 100): Promise<RadioTrack[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("radio_tracks")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching radio tracks:", error);
    return [];
  }

  return data || [];
}

/**
 * Récupère les statistiques actuelles de la radio
 */
export async function getRadioStats(): Promise<RadioStats | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("radio_stats")
    .select(`
      *,
      current_track:radio_tracks(*)
    `)
    .single();

  if (error) {
    console.error("Error fetching radio stats:", error);
    return null;
  }

  return data;
}

/**
 * Récupère l'historique de lecture
 */
export async function getPlayHistory(limit = 50): Promise<RadioPlayHistory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("radio_play_history")
    .select(`
      *,
      track:radio_tracks(*)
    `)
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching play history:", error);
    return [];
  }

  return data || [];
}

/**
 * Enregistre une lecture dans l'historique
 */
export async function recordPlayHistory(
  trackId: string,
  listenerCount = 0
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("radio_play_history").insert({
    track_id: trackId,
    listener_count: listenerCount,
    played_at: new Date().toISOString(),
    completed: false,
  });

  if (error) {
    console.error("Error recording play history:", error);
  }
}

/**
 * Met à jour le compteur de lecture d'une piste
 */
export async function incrementPlayCount(trackId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("increment_track_play_count", {
    track_id: trackId,
  });

  if (error) {
    console.error("Error incrementing play count:", error);
  }
}
