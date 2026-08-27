/**
 * Garde d'accès administrateur pour Server Components et Route Handlers.
 * Vérifie la session Supabase ET le rôle `admin` dans user_roles.
 * Si l'admin a des facteurs MFA vérifiés, exige le niveau AAL2.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string | null;
}

/**
 * True si le niveau d'assurance est suffisant :
 * - aucun facteur MFA enrollé → AAL1 suffit ;
 * - au moins un facteur vérifié → AAL2 requis (défi TOTP passé).
 */
async function mfaSatisfied(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!data) return true;
    if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") return false;
    return true;
  } catch {
    // En cas d'échec de la vérification, ne pas bloquer la connexion.
    return true;
  }
}

/** Retourne l'utilisateur admin courant, ou null si non authentifié / non admin. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Utiliser le même client (session utilisateur) pour lire user_roles.
  // La policy "users read own role" autorise la lecture de sa propre ligne.
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) return null;

  if (!(await mfaSatisfied(supabase))) return null;

  return { id: user.id, email: user.email ?? null };
}

/** Variante lançant une erreur 401/403 pour les Route Handlers. */
export async function requireAdmin(): Promise<
  { ok: true; user: AdminUser } | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401, error: "Non authentifié." };

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) return { ok: false, status: 403, error: "Accès réservé aux administrateurs." };

  if (!(await mfaSatisfied(supabase))) {
    return { ok: false, status: 403, error: "Vérification MFA requise." };
  }

  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

/**
 * Variante qui lève une erreur HTTP si l'utilisateur n'est pas admin,
 * et retourne l'utilisateur admin sinon (pour les Route Handlers).
 */
export async function ensureAdmin(): Promise<AdminUser> {
  const result = await requireAdmin();
  if (!result.ok) {
    throw new Error(result.error, { cause: result.status });
  }
  return result.user;
}
