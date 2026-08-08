import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminChartData } from "@/lib/charts/admin/queries";
import { AdminHeader } from "../AdminHeader";
import { DeezerManager } from "./DeezerManager";

export const dynamic = "force-dynamic";

const SOURCE_KEY = "deezer_haiti_top100";

export default async function DeezerAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/deezer");

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
      <AdminHeader email={user.email} active="deezer" />
      <main className="admin__main">
        <h1 className="admin__title">Deezer — Top Haiti</h1>
        <p className="admin__subtitle">
          Classement basé sur la playlist communautaire Deezer &quot;Top 100 Haiti&quot;.
          Collecte automatique chaque mercredi + collecte manuelle.
        </p>

        {loadError ? (
          <div className="banner">Impossible de charger les données : {loadError}</div>
        ) : data?.edition ? (
          <DeezerManager sourceKey={SOURCE_KEY} initialData={data} />
        ) : (
          <div className="admin-card">
            <p style={{ color: "var(--admin-muted)" }}>
              Aucune édition Deezer. La collecte automatique (mercredi) créera la première,
              ou lancez une collecte manuelle ci-dessous.
            </p>
            <DeezerManager sourceKey={SOURCE_KEY} initialData={data!} />
          </div>
        )}
      </main>
    </>
  );
}
