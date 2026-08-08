/**
 * Classements alimentés par une playlist Spotify.
 *
 * Une playlist donne un ORDRE éditorial, pas des métriques d'écoute. Chaque
 * édition collectée reste un brouillon : rien n'apparaît en ligne avant qu'un
 * administrateur ne publie.
 */

export interface PlaylistChartSource {
  sourceKey: string;
  /** Plateforme du classement, pas celle de la playlist. */
  platform: "spotify" | "tiktok";
  displayName: string;
  chartContext: string;
  /** Playlist utilisée par défaut si `chart_sources.source_url` est vide. */
  defaultPlaylistUrl: string;
  /** Nombre maximum de titres retenus. */
  limit: number;
  /** Onglet admin où la source est administrée. */
  adminTab: "spotify" | "tiktok";
  description: string;
}

export const PLAYLIST_CHART_SOURCES: readonly PlaylistChartSource[] = [
  {
    sourceKey: "spotify_haiti_popular",
    platform: "spotify",
    displayName: "Spotify — Top 50 GlobHaitian",
    chartContext: "Top 50 GlobHaitian (playlist Spotify)",
    defaultPlaylistUrl: "https://open.spotify.com/playlist/1cXIKrbi0PwJkNQgrzOokU",
    limit: 50,
    adminTab: "spotify",
    description:
      "Classement Spotify construit depuis la playlist « Top 50 GlobHaitian ». " +
      "L'ordre de la playlist donne les positions de départ ; l'admin réordonne et publie.",
  },
  {
    sourceKey: "tiktok_haiti_viral_playlist",
    platform: "tiktok",
    displayName: "Top TikTok Haiti — Viral (playlist)",
    chartContext: "TikTok Viral Haiti (playlist Spotify)",
    defaultPlaylistUrl: "https://open.spotify.com/playlist/4SRJiaVoFWqcVLKvsvd5dH",
    limit: 50,
    adminTab: "tiktok",
    description:
      "Deuxième source du classement TikTok, indépendante de l'API Research : " +
      "les titres viraux relevés dans la playlist « TikTok Viral Haiti ».",
  },
] as const;

/** État en base d'une source playlist, tel qu'affiché en admin. */
export interface PlaylistSourceState {
  sourceKey: string;
  displayName: string;
  chartContext: string | null;
  playlistUrl: string | null;
  isEnabled: boolean;
  ingestionMode: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
}

export function findPlaylistChartSource(sourceKey: string): PlaylistChartSource | null {
  return PLAYLIST_CHART_SOURCES.find((source) => source.sourceKey === sourceKey) ?? null;
}

export function playlistChartSourcesForTab(
  tab: PlaylistChartSource["adminTab"],
): PlaylistChartSource[] {
  return PLAYLIST_CHART_SOURCES.filter((source) => source.adminTab === tab);
}
