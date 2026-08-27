/**
 * Journalisation applicative des événements d'authentification.
 * Insertion côté client (session utilisateur, RLS : lignes propres uniquement)
 * ou côté serveur. Best-effort : une erreur d'audit ne bloque jamais le parcours.
 */
export const AUTH_EVENTS = {
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  LOGOUT: "logout",
  SIGNUP: "signup",
  MAGIC_LINK_SENT: "magic_link_sent",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  PASSWORD_UPDATED: "password_updated",
  EMAIL_CHANGE_REQUESTED: "email_change_requested",
  ACCOUNT_DELETED: "account_deleted",
  MFA_ENROLLED: "mfa_enrolled",
  MFA_UNENROLLED: "mfa_unenrolled",
  MFA_CHALLENGE_OK: "mfa_challenge_ok",
} as const;

export type AuthEvent = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS];

import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAuthEvent(
  supabase: SupabaseClient,
  userId: string | undefined,
  event: AuthEvent
): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await supabase.from("auth_audit").insert({ user_id: userId, event });
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[audit] insertion impossible:", error);
    }
  } catch {
    // Best-effort uniquement.
  }
}
