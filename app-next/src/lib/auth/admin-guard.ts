/**
 * Garde d'accès administrateur pour Server Components et Route Handlers.
 * Vérifie la session Supabase ET le rôle `admin` dans user_roles.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string | null;
}

/** Retourne l'utilisateur admin courant, ou null si non authentifié / non admin. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) return null;

  // Utiliser le même client (session utilisateur) pour lire user_roles.
  // La policy "users read own role" autorise la lecture de sa propre ligne.
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) return null;
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
