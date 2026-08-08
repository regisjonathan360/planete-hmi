/**
 * Feature flags — Fonctionnalités activables/désactivables.
 *
 * ARTIST_ACCOUNTS : Quand désactivé (false), l'espace artiste, la revendication
 * et toute modification de profil par les artistes sont bloqués publiquement.
 * Seul l'administrateur peut gérer les artistes.
 *
 * Pour réactiver : mettre NEXT_PUBLIC_ARTIST_ACCOUNTS_ENABLED=true dans les env vars.
 */

export const FEATURES = {
  /** Comptes artistes (revendication, espace artiste, modification profil). Désactivé par défaut. */
  ARTIST_ACCOUNTS: process.env.NEXT_PUBLIC_ARTIST_ACCOUNTS_ENABLED === "true",
} as const;
