/** Types du module d'administration des classements. */
import type { HaitianStatus, PlatformName } from "../types";

/** Statut de validation exposé dans l'UI admin. */
export type AdminValidationStatus = "a_verifier" | "valide" | "refuse" | "masque";

/** Une entrée du classement, telle que gérée dans l'admin (copie de travail). */
export interface AdminChartEntry {
  entryId: string;
  trackId: string | null;
  platformTrackId: string | null;
  sourcePosition: number;
  filteredPosition: number | null;
  adminPosition: number | null;
  isHidden: boolean;
  isExcluded: boolean;
  exclusionReason: string | null;
  // Valeurs affichées (override admin si présent, sinon donnée source).
  title: string;
  artist: string;
  artworkUrl: string | null;
  audiomackUrl: string | null;
  albumName: string | null;
  genre: string | null;
  // Overrides bruts (pour l'édition).
  displayTitle: string | null;
  displayArtist: string | null;
  displayArtworkUrl: string | null;
  displayUrl: string | null;
  // Éligibilité haïtienne du crédit principal.
  primaryArtistId: string | null;
  primaryArtistName: string | null;
  primaryArtistImageUrl: string | null;
  haitianStatus: HaitianStatus | null;
  artistIsActive: boolean;
  isEligible: boolean;
}

export interface AdminArtistToValidate {
  artistId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  haitianStatus: HaitianStatus;
  isActive: boolean;
  confidenceScore: number | null;
  trackCount: number;
  tags: string[];
}

export interface AdminDerivedArtist {
  name: string;
  bestPosition: number;
  trackCount: number;
  eligible: boolean;
}

export interface AdminDerivedAlbum {
  name: string;
  artist: string;
  bestPosition: number;
  trackCount: number;
  artworkUrl: string | null;
}

export interface AdminEdition {
  editionId: string;
  sourceId: string;
  sourceKey: string;
  platform: PlatformName;
  displayName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  collectedAt: string | null;
  publishedAt: string | null;
  lastPublishedAt: string | null;
  sourceUpdatedAt: string | null;
  hasUnpublishedChanges: boolean;
  isStale: boolean;
}

export interface AdminChartData {
  edition: AdminEdition | null;
  entries: AdminChartEntry[];
  artistsToValidate: AdminArtistToValidate[];
  derivedArtists: AdminDerivedArtist[];
  derivedAlbums: AdminDerivedAlbum[];
  summary: {
    totalEntries: number;
    visibleEntries: number;
    hiddenEntries: number;
    excludedEntries: number;
    eligibleEntries: number;
    distinctArtists: number;
    distinctAlbums: number;
    pendingArtists: number;
  };
  isPublished: boolean;
}

/** Correspondance statut UI ↔ statut Postgres (haitian_status + is_active). */
export const STATUT_UI_VERS_DB: Record<
  AdminValidationStatus,
  { haitianStatus?: HaitianStatus; isActive?: boolean }
> = {
  a_verifier: { haitianStatus: "pending_review", isActive: true },
  valide: { haitianStatus: "verified_haitian", isActive: true },
  refuse: { haitianStatus: "rejected", isActive: true },
  masque: { isActive: false },
};

const STATUTS_HAITIENS_VERIFIES: HaitianStatus[] = [
  "verified_haitian",
  "verified_haitian_diaspora",
  "verified_haitian_group",
];

export function estStatutVerifie(status: HaitianStatus | null | undefined): boolean {
  return !!status && STATUTS_HAITIENS_VERIFIES.includes(status);
}
