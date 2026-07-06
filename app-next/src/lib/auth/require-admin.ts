import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * À appeler en tête des pages/actions admin (Server Components / Server Actions).
 * Redirige si l'utilisateur n'est pas connecté ou n'est pas administrateur.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) redirect("/admin/login?denied=1");

  return { user, supabase };
}
