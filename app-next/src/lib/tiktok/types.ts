/** Types pour le module de classement TikTok */

// ---------------------------------------------------------------------------
// Validation Status
// ---------------------------------------------------------------------------

/** Statut de validation d'un son TikTok dans la file d'attente admin */
export type ValidationStatus = "a_verifier" | "valide" | "refuse";

// ---------------------------------------------------------------------------
// Data Models (alignés avec les tables Supabase)
// ---------------------------------------------------------------------------

/** Vidéo TikTok collectée — correspond à la table tiktok_videos */
export interface TikTokVideo {
  id: string;
  video_id: string;
  music_id: string;
  username: string;
  create_time: string;
  region_code: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  hashtag_names: string[];
  video_description: string | null;
  collected_at: string;
  updated_at: string;
}

/** Son TikTok agrégé — correspond à la table tiktok_sounds */
export interface TikTokSound {
  id: string;
  music_id: string;
  sound_title: string;
  sound_author: string | null;
  total_videos: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  unique_creators: number;
  score: number;
  growth_7d: number;
  previous_total_videos: number | null;
  previous_snapshot_at: string | null;
  validation_status: ValidationStatus;
  first_seen_at: string;
  last_updated_at: string;
  artist_id: string | null;
}

/** Vidéo mise en avant pour la section HMI Shorts — correspond à tiktok_featured_shorts */
export interface TikTokFeaturedShort {
  id: string;
  video_id: string;
  music_id: string;
  display_order: number;
  selected_at: string;
  selected_by: string | null;
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

/** Configuration du client API TikTok Research */
export interface TikTokApiClientConfig {
  clientKey: string;
  clientSecret: string;
  baseUrl: string;
}

/** Paramètres de requête pour la recherche de vidéos TikTok */
export interface TikTokVideoQueryParams {
  region_code?: string;
  hashtag_names?: string[];
  keyword?: string;
  start_date: string; // format YYYYMMDD
  end_date: string;   // format YYYYMMDD
  max_count?: number; // max 100
  cursor?: number;
}

/** Réponse de l'API TikTok pour une requête de vidéos */
export interface TikTokVideoResponse {
  videos: TikTokVideo[];
  cursor: number;
  has_more: boolean;
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/** Résultat d'une exécution de collecte */
export interface CollectionResult {
  ok: boolean;
  videosCollected: number;
  videosUpdated: number;
  newSounds: number;
  errors: string[];
  syncRunId: string;
}

// ---------------------------------------------------------------------------
// Score Engine
// ---------------------------------------------------------------------------

/** Coefficients de pondération pour le calcul du score composite */
export interface ScoreCoefficients {
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  growth7d: number;
  creatorDiversity: number;
}

/** Résultat d'un recalcul de scores */
export interface ScoreEngineResult {
  soundsScored: number;
  editionId: string;
}

// ---------------------------------------------------------------------------
// Chart Builder
// ---------------------------------------------------------------------------

/** Configuration du chart builder */
export interface ChartBuilderConfig {
  sourceKeys: {
    global: string;
    enMontee: string;
    nouveautes: string;
  };
  nouveautesWindowDays: number;
}
