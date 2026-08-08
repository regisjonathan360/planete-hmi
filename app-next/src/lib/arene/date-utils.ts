/**
 * Utilitaires de formatage de dates pour l'Arène communautaire.
 * Affiche les dates de manière relative en français (il y a X min/h/j)
 * ou en format absolu DD/MM/YYYY pour les dates anciennes (≥7 jours).
 */

/**
 * Formate un timestamp ISO 8601 en date relative française.
 *
 * Règles :
 * - < 60 min : "il y a X min"
 * - < 24 h   : "il y a X h"
 * - < 7 j    : "il y a X j"
 * - ≥ 7 j    : "DD/MM/YYYY"
 *
 * Cas limites :
 * - Timestamp dans le futur ou < 1 min : "il y a 1 min" (minimum)
 *
 * @param timestamp - Chaîne ISO 8601 (ex: "2024-01-15T10:30:00Z")
 * @returns La date formatée en français
 */
export function formatRelativeDate(timestamp: string): string {
  const now = Date.now();
  const date = new Date(timestamp);
  const diffMs = now - date.getTime();

  // Future ou moins d'une minute → minimum "il y a 1 min"
  if (diffMs < 60_000) {
    return "il y a 1 min";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 60) {
    return `il y a ${diffMinutes} min`;
  }

  if (diffHours < 24) {
    return `il y a ${diffHours} h`;
  }

  if (diffDays < 7) {
    return `il y a ${diffDays} j`;
  }

  // ≥ 7 jours : format DD/MM/YYYY
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}
