/**
 * Types de domaine partagés du module Classements.
 */

export type PlatformName =
  | "youtube"
  | "spotify"
  | "audiomack"
  | "apple_music"
  | "tiktok";

export type IngestionMode =
  | "OFFICIAL_API"
  | "OFFICIAL_EXPORT"
  | "VERIFIED_ADMIN_IMPORT"
  | "PARTNER_FEED"
  | "DISABLED";

export type HaitianStatus =
  | "verified_haitian"
  | "verified_haitian_diaspora"
  | "verified_haitian_group"
  | "pending_review"
  | "insufficient_evidence"
  | "rejected";

export type ArtistRole =
  | "primary"
  | "co_primary"
  | "featured"
  | "producer"
  | "remixer"
  | "composer";

export type EntryStatus = "new" | "up" | "down" | "stable" | "reentry" | "exit";

/** Statuts haïtiens considérés comme « vérifiés » pour l'éligibilité. */
export const STATUTS_HAITIENS_VERIFIES: HaitianStatus[] = [
  "verified_haitian",
  "verified_haitian_diaspora",
  "verified_haitian_group",
];

/** Rôles ouvrant droit à l'admissibilité principale (configurable, défaut restrictif). */
export const ROLES_ADMISSIBLES_PRINCIPAUX: ArtistRole[] = ["primary", "co_primary"];

export interface CreditArtiste {
  role: ArtistRole;
  haitianStatus: HaitianStatus;
}

export interface DonneesComparaisonPiste {
  isrc?: string | null;
  normalizedTitle: string;
  primaryArtistKey?: string | null;
  durationMs?: number | null;
  releaseDate?: string | null; // ISO date
  albumTitle?: string | null;
}
