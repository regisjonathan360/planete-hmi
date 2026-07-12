import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { ArtistList } from "./ArtistList";

export const dynamic = "force-dynamic";

export default async function AdminArtistesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/artistes");

  const supabase = createAdminClient();
  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, slug, image_url, haitian_status, is_active, tags, primary_genre, city, created_at, updated_at")
    .order("name");

  return (
    <>
      <AdminHeader email={user.email} active="artistes" />
      <main className="admin__main">
        <h1 className="admin__title">Gestion des artistes</h1>
        <p className="admin__subtitle">
          {(artists ?? []).length} artistes en base. Créer, modifier, masquer ou fusionner.
        </p>
        <ArtistList artists={artists ?? []} />
      </main>
    </>
  );
}
