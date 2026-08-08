/** Constantes pour le module de classement TikTok */

import type { ScoreCoefficients } from "./types";

// ---------------------------------------------------------------------------
// Hashtags et mots-clés de collecte (Requirements 2.2, 2.3)
// ---------------------------------------------------------------------------

/** Hashtags haïtiens utilisés pour la recherche de vidéos TikTok */
export const HAITIAN_HASHTAGS: string[] = [
  "haiti",
  "haitianmusic",
  "kompa",
  "raboday",
  "haitiantiktok",
  "musichaiti",
  "ayiti",
];

/** Mots-clés liés aux genres musicaux haïtiens pour la recherche par keyword */
export const HAITIAN_MUSIC_KEYWORDS: string[] = [
  "kompa",
  "raboday",
  "gouyad",
  "kanaval",
  "mizik ayisyen",
  "haitian music",
  "kompa love",
  "kompa direct",
  "twoubadou",
  "rara",
  "rabòday",
  "afro raboday",
];

// ---------------------------------------------------------------------------
// Score Engine (Requirement 3.2)
// ---------------------------------------------------------------------------

/** Coefficients de pondération par défaut pour le score composite */
export const DEFAULT_SCORE_COEFFICIENTS: ScoreCoefficients = {
  videoCount: 0.20,
  totalViews: 0.20,
  totalLikes: 0.15,
  totalComments: 0.10,
  totalShares: 0.15,
  growth7d: 0.10,
  creatorDiversity: 0.10,
};

// ---------------------------------------------------------------------------
// Chart Sources (Requirement 5.1, 5.4)
// ---------------------------------------------------------------------------

/** Clés des 3 sources de classement TikTok */
export const SOURCE_KEYS = {
  global: "tiktok_haiti_global",
  enMontee: "tiktok_haiti_en_montee",
  nouveautes: "tiktok_haiti_nouveautes",
} as const;

/** Fenêtre de nouveautés : un son est considéré "nouveau" pendant 14 jours */
export const NOUVEAUTES_WINDOW_DAYS = 14;

// ---------------------------------------------------------------------------
// API Client Configuration
// ---------------------------------------------------------------------------

/** URL de base de l'API TikTok Research */
export const TIKTOK_API_BASE_URL = "https://open.tiktokapis.com/v2";

/** Nombre maximum de tentatives pour une requête API en cas d'échec */
export const MAX_RETRIES = 3;

/** Délai de base pour le backoff exponentiel (en ms) — base 4 : 1s, 4s, 16s */
export const RETRY_BASE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// HMI Shorts
// ---------------------------------------------------------------------------

/** Nombre maximum de vidéos featured dans la section HMI Shorts */
export const MAX_FEATURED_SHORTS = 10;
