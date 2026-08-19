/**
 * Types TypeScript pour le système de radio de Planète HMI
 */

/**
 * Normalise le `track_count` renvoyé par PostgREST.
 *
 * Un agrégat embarqué (`radio_playlist_tracks(count)`) est toujours enveloppé
 * dans un tableau : `[{ "count": 3 }]` (ou `[]` si aucune piste). Sans cela,
 * React plante sur « Objects are not valid as a React child ». Module sans
 * dépendance serveur : utilisable côté client comme côté serveur.
 */
export function normalizePlaylistTrackCount(trackCount: unknown): number {
  if (Array.isArray(trackCount)) {
    const first = trackCount[0] as { count?: number } | undefined;
    return typeof first?.count === "number" ? first.count : 0;
  }
  return typeof trackCount === "number" ? trackCount : 0;
}

export interface RadioTrack {
  id: string;
  title: string;
  artist_name: string;
  artist_id?: string;
  audio_url: string;
  cover_image_url?: string;
  duration_seconds: number;
  genre?: string;
  source: 'manual' | 'chart' | 'youtube' | 'audiomack' | 'spotify' | 'deezer' | 'soundcloud';
  source_id?: string;
  is_active: boolean;
  play_count: number;
  created_at: string;
  updated_at: string;
}

export interface RadioPlaylist {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  shuffle_enabled: boolean;
  repeat_enabled: boolean;
  created_at: string;
  updated_at: string;
  tracks?: RadioTrack[];
  track_count?: number;
}

export interface RadioPlaylistTrack {
  id: string;
  playlist_id: string;
  track_id: string;
  track_position: number;
  added_at: string;
  track?: RadioTrack;
}

export interface RadioConfig {
  id: string;
  active_playlist_id?: string;
  auto_switch_to_chart: boolean;
  chart_source_key?: string;
  preload_count: number;
  crossfade_duration_ms: number;
  is_live: boolean;
  auto_sync_enabled?: boolean;
  auto_source_key?: string;
  last_auto_sync_at?: string | null;
  last_auto_sync_status?: string | null;
  last_auto_sync_error?: string | null;
  updated_at: string;
  updated_by?: string;
}

export interface RadioPlayHistory {
  id: string;
  track_id: string;
  played_at: string;
  listener_count: number;
  completed: boolean;
  track?: RadioTrack;
}

export interface RadioStats {
  id: string;
  current_track_id?: string;
  listener_count: number;
  started_at?: string;
  updated_at: string;
  current_track?: RadioTrack;
}

export interface RadioPlayerState {
  isPlaying: boolean;
  currentTrack?: RadioTrack;
  nextTrack?: RadioTrack;
  playlist: RadioTrack[];
  currentIndex: number;
  /** Genre en cours de diffusion. Absent = programmation complète. */
  selectedGenre?: string;
  volume: number;
  isMuted: boolean;
  preloadedTracks: Set<string>;
  isLoading: boolean;
  error?: string;
}

export interface RadioAdminState {
  playlists: RadioPlaylist[];
  tracks: RadioTrack[];
  config?: RadioConfig;
  stats?: RadioStats;
  history: RadioPlayHistory[];
  isLoading: boolean;
  error?: string;
}

// Types pour les réponses API
export interface RadioPlaylistResponse {
  playlist: RadioPlaylist;
  tracks: RadioTrack[];
}

export interface RadioConfigResponse {
  config: RadioConfig;
  active_playlist?: RadioPlaylist;
}

export interface ChartTracksResponse {
  chart_key: string;
  chart_name: string;
  tracks: RadioTrack[];
}
