import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { AdminHeader } from "../../AdminHeader";
import { ArtistCreateForm } from "./ArtistCreateForm";

export const dynamic = "force-dynamic";

export default async function AdminCreateArtistPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/artistes/nouveau");

  return (
    <>
      <AdminHeader email={user.email} active="artistes" />
      <main className="admin__main">
        <h1 className="admin__title">Créer un artiste</h1>
        <p className="admin__subtitle">Nouveau profil artiste dans le répertoire Planète HMI.</p>
        <ArtistCreateForm />
      </main>
    </>
  );
}
