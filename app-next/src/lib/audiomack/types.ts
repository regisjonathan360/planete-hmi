/** Types pour l'intégration Audiomack Weekly 100: Haiti */

export interface AudiomackNormalizedEntry {
  platform: "audiomack";
  countryCode: "HT";
  rank: number;
  platformTrackId: string | null;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  artistImageUrl: string | null;
  sourceTrackUrl: string;
  artistSlug: string | null;
  trackSlug: string | null;
  albumName: string | null;
  genre: string | null;
}

export interface AudiomackSnapshotEntry extends AudiomackNormalizedEntry {
  previousRank: number | null;
  rankChange: number | null;
  isNew: boolean;
  weeksOnChart: number;
  peakRank: number;
}

export interface AudiomackChartResponse {
  platform: "audiomack";
  countryCode: "HT";
  chartName: "Weekly 100: Haiti";
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  collectedAt: string;
  isStale: boolean;
  entries: AudiomackSnapshotEntry[];
}

/** Résultat brut de l'API Audiomack (playlist) */
export interface AudiomackRawTrack {
  id?: string | number;
  title?: string;
  artist?: string;
  image?: string | null;
  image_base?: string | null;
  url?: string;
  url_slug?: string;
  artist_url_slug?: string;
  album?: string;
  genre?: string;
  links?: {
    self?: string;
    [key: string]: unknown;
  };
  uploader?: {
    url_slug?: string;
    image?: string | null;
    image_base?: string | null;
    thumbnail?: string | null;
    [key: string]: unknown;
  };
  images?: {
    original?: {
      filename?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AudiomackRawPlaylist {
  results?: AudiomackRawTrack[];
  tracks?: AudiomackRawTrack[];
  [key: string]: unknown;
}
