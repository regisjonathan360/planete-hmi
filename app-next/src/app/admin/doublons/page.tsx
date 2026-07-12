import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { DoublonsList } from "./DoublonsList";

export const dynamic = "force-dynamic";

export default async function AdminDoublonsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/doublons");

  const supabase = createAdminClient();

  // Charger les candidats à la fusion en attente
  const { data: candidates } = await supabase
    .from("artist_merge_candidates")
    .select(`
      id, confidence, reason, status, created_at,
      artist_a:artist_a_id(id, name, slug, image_url, haitian_status, tags),
      artist_b:artist_b_id(id, name, slug, image_url, haitian_status, tags)
    `)
    .eq("status", "pending")
    .order("confidence", { ascending: false })
    .limit(50);

  return (
    <>
      <AdminHeader email={user.email} active="doublons" />
      <main className="admin__main">
        <h1 className="admin__title">Doublons possibles</h1>
        <p className="admin__subtitle">
          Artistes qui pourraient être la même personne. Comparez et décidez : fusionner ou garder séparés.
        </p>
        <DoublonsList candidates={candidates ?? []} />
      </main>
    </>
  );
}
