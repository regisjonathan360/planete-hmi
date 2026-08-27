/**
 * POST /api/account/delete
 * RGPD : supprime le compte de l'utilisateur connecté.
 * Toutes les tables de données utilisateur référencent auth.users avec
 * ON DELETE CASCADE : la suppression du compte auth purge les données.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Un admin ne peut pas supprimer son propre compte depuis cette route
  // (la gestion des comptes admin se fait hors produit).
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (role) {
    return NextResponse.json(
      { error: "Un compte administrateur ne peut pas être supprimé ici." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "La suppression du compte a échoué. Réessaie plus tard." },
      { status: 500 }
    );
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
