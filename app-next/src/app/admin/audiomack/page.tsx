import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminChartData } from "@/lib/charts/admin/queries";
import { AdminHeader } from "../AdminHeader";
import { AudiomackManager } from "./AudiomackManager";

export const dynamic = "force-dynamic";

const SOURCE_KEY = "audiomack_haiti_weekly100";

export default async function AudiomackAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/audiomack");

  const supabase = createAdminClient();
  let data;
  let loadError: string | null = null;
  try {
    data = await getAdminChartData(supabase, SOURCE_KEY);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Erreur de chargement.";
  }

  return (
    <>
      <AdminHeader email={user.email} active="audiomack" />
      <main className="admin__main">
        <h1 className="admin__title">Audiomack — Weekly 100 Haiti</h1>
        <p className="admin__subtitle">
          Contrôle complet du classement : collecte, validation haïtienne, édition manuelle,
          recalcul automatique et publication.
        </p>

        {loadError ? (
          <div className="banner">Impossible de charger les données : {loadError}</div>
        ) : (
          <AudiomackManager sourceKey={SOURCE_KEY} initialData={data!} />
        )}
      </main>
    </>
  );
}
