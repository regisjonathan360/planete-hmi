/**
 * Validation des chemins de redirection (`?next=`).
 * Empêche les open redirects : seul un chemin relatif interne est accepté.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string
): string {
  if (!value) return fallback;
  // Uniquement des chemins relatifs internes : commencent par "/" unique,
  // jamais "//" (protocole-relative vers un autre domaine) ni "\".
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
