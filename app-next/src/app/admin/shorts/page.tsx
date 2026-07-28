import { redirect } from "next/navigation";
import { AdminHeader } from "../AdminHeader";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { HmiShortsManager } from "./HmiShortsManager";

export const dynamic = "force-dynamic";

export default async function HmiShortsAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/shorts");

  return (
    <>
      <AdminHeader email={user.email} active="shorts" />
      <main className="admin__main">
        <div className="shorts-admin-heading">
          <div>
            <p className="shorts-admin-heading__eyebrow">Programmation éditoriale</p>
            <h1 className="admin__title">HMI Shorts</h1>
            <p className="admin__subtitle">
              Ajoutez des vidéos verticales par URL, préparez leur présentation puis choisissez
              exactement celles qui apparaissent sur la page d&apos;accueil.
            </p>
          </div>
          <a className="btn btn--ghost" href="/#shorts" target="_blank" rel="noreferrer">
            Voir la section publique ↗
          </a>
        </div>
        <HmiShortsManager />
      </main>
    </>
  );
}
