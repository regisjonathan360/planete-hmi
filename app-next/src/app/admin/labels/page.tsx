import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { AdminHeader } from "../AdminHeader";

export const dynamic = "force-dynamic";

export default async function AdminLabelsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/labels");

  return (
    <>
      <AdminHeader email={user.email} active="labels" />
      <main className="admin__main">
        <h1 className="admin__title">Labels & collectifs</h1>
        <p className="admin__subtitle">
          La gestion structurée des labels, catalogues et artistes signés arrive bientôt.
        </p>
        <section className="admin-card" style={{ maxWidth: 760, padding: "1.5rem" }}>
          <span className="status-badge status-badge--pending">Bientôt disponible</span>
          <h2 style={{ marginTop: "1rem" }}>Préparation du répertoire des labels</h2>
          <p style={{ color: "var(--admin-muted)", lineHeight: 1.65 }}>
            En attendant, le champ « Label / Collectif » reste disponible dans chaque fiche artiste.
            La future section permettra de relier plusieurs artistes à une organisation vérifiée.
          </p>
        </section>
      </main>
    </>
  );
}
