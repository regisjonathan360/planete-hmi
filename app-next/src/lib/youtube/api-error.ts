/**
 * Sanitisation des erreurs pour les routes API YouTube K6.
 *
 * Aucun secret, token, clé API, URL signée ou détail SQL ne doit
 * apparaître dans les réponses publiques.
 */
import "server-only";

/** Codes publics stables renvoyés par les routes K6. */
export type YouTubeApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "validation_error"
  | "not_found"
  | "conflict"
  | "precondition_failed"
  | "internal_error"
  | "service_unavailable";

export interface SafeApiError {
  code: YouTubeApiErrorCode;
  message: string;
  status: number;
}

/**
 * Supprime les secrets, tokens, clés API, URLs signées et détails SQL
 * d'un message d'erreur avant de le renvoyer au client.
 */
export function sanitizeErrorMessage(raw: string): string {
  let safe = raw;
  // YouTube API keys (AIza...)
  safe = safe.replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED]");
  // Generic key/token query params
  safe = safe.replace(/([?&](?:key|api_key|apikey|access_token|token|secret)=)[^\s&"']+/gi, "$1[REDACTED]");
  // Bearer tokens
  safe = safe.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  // UUIDs that look like tokens (owner_token patterns)
  safe = safe.replace(/owner_token[=:\s]+[0-9a-f-]{36}/gi, "owner_token=[REDACTED]");
  // Supabase secret keys
  safe = safe.replace(/sb_secret_[A-Za-z0-9_-]+/g, "[REDACTED]");
  // PostgreSQL connection strings
  safe = safe.replace(/postgresql:\/\/[^\s"']+/gi, "[REDACTED_URL]");
  // Full URLs with potential secrets
  safe = safe.replace(/https?:\/\/[^\s"']*(?:key|token|secret|password)[^\s"']*/gi, "[REDACTED_URL]");
  // SQL error details (relation, column, constraint names are ok, but full queries are not)
  safe = safe.replace(/(?:INSERT|UPDATE|DELETE|SELECT)\s+(?:INTO|FROM|SET)\s+[^\s]+\s+.{0,200}/gi, "[SQL_REDACTED]");
  // Truncate
  if (safe.length > 200) safe = safe.slice(0, 200) + "…";
  return safe;
}

/**
 * Transforme une exception quelconque en erreur sûre pour le client.
 */
export function toSafeApiError(err: unknown): SafeApiError {
  // Known application errors with safe messages
  if (err instanceof Error) {
    const msg = err.message;

    // Lease errors
    if (msg.includes("Lease perdu") || msg.includes("lease_lost")) {
      return { code: "precondition_failed", message: "Opération interrompue : le verrou a été perdu.", status: 412 };
    }
    if (msg.includes("Annulation demandée")) {
      return { code: "precondition_failed", message: "Opération annulée.", status: 412 };
    }
    // Published edition
    if (msg.includes("publiée") || msg.includes("published")) {
      return { code: "conflict", message: "Impossible de modifier une édition publiée.", status: 409 };
    }
    // Quota
    if (msg.includes("quota") || msg.includes("Quota")) {
      return { code: "service_unavailable", message: "Quota YouTube épuisé.", status: 503 };
    }
  }

  // Fallback: generic internal error, never expose raw message
  return {
    code: "internal_error",
    message: "Une erreur interne est survenue.",
    status: 500,
  };
}

/**
 * Construit une réponse JSON d'erreur sûre.
 */
export function safeErrorResponse(code: YouTubeApiErrorCode, message: string, status: number) {
  return { error: { code, message }, status };
}
