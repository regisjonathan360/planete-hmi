import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "../AdminHeader";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { ContributionsManager } from "./ContributionsManager";

export const dynamic = "force-dynamic";

export default async function ContributionsAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/contributions");

  return (
    <>
      <AdminHeader email={user.email} active="contributions" />
      <main className="admin__main">
        <div className="contributions-admin-heading">
          <div>
            <p className="contributions-admin-heading__eyebrow">Soutien à la plateforme</p>
            <h1 className="admin__title">Contributions</h1>
            <p className="admin__subtitle">
              Vérifiez les confirmations manuelles, consultez les preuves privées et
              conservez une trace de chaque décision.
            </p>
          </div>
          <div className="admin-toolbar">
            <a className="btn btn--ghost" href="/support" target="_blank" rel="noreferrer">
              Page publique
            </a>
            <Link className="btn btn--primary" href="/api/admin/contributions/export">
              Exporter CSV
            </Link>
          </div>
        </div>
        <ContributionsManager />
      </main>
    </>
  );
}
