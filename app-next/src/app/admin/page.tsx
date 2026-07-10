import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { AdminHeader } from "./AdminHeader";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  let user;
  let debugInfo = "";
  try {
    user = await getAdminUser();
    debugInfo = user ? `Connecté: ${user.email}` : "getAdminUser retourne null";
  } catch (e) {
    debugInfo = `Erreur: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Debug : voir les cookies reçus
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sbCookies = allCookies.filter(c => c.name.includes("supabase") || c.name.includes("sb-") || c.name.includes("sb_"));
  console.log("[ADMIN] Supabase cookies:", sbCookies.map(c => `${c.name}=${c.value.slice(0,20)}...`));
  console.log("[ADMIN] getAdminUser result:", user);

  if (!user) {
    return (
      <>
        <AdminHeader email={null} active="home" />
        <main className="admin__main">
          <h1 className="admin__title">Accès refusé</h1>
          <p className="admin__subtitle">{debugInfo}</p>
          <p style={{color: "var(--admin-muted)", fontSize: "0.8rem"}}>
            Cookies Supabase détectés : {sbCookies.length > 0 ? sbCookies.map(c => c.name).join(", ") : "aucun"}
          </p>
          <a href="/admin/login" className="btn btn--primary">Se connecter</a>
        </main>
      </>
    );
  }

  return (
    <>
      <AdminHeader email={user.email} active="home" />
      <main className="admin__main">
        <h1 className="admin__title">Tableau de bord</h1>
        <p className="admin__subtitle">
          Gérez les classements musicaux haïtiens par plateforme. Collecte, validation, édition
          manuelle et publication contrôlée.
        </p>

        <div className="admin-card">
          <h2 className="admin-card__title">Plateformes</h2>
          <div className="admin-stats">
            <Link href="/admin/audiomack" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value" style={{ color: "var(--admin-accent-2)" }}>
                Audiomack
              </div>
              <div className="stat__label">Weekly 100 Haiti — actif</div>
            </Link>
            <div className="stat" style={{ opacity: 0.5 }}>
              <div className="stat__value">YouTube</div>
              <div className="stat__label">Bientôt</div>
            </div>
            <div className="stat" style={{ opacity: 0.5 }}>
              <div className="stat__value">Apple Music</div>
              <div className="stat__label">Bientôt</div>
            </div>
            <div className="stat" style={{ opacity: 0.5 }}>
              <div className="stat__value">Spotify</div>
              <div className="stat__label">Bientôt</div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="admin-card__title">Comment ça marche</h2>
          <ol style={{ color: "var(--admin-muted)", lineHeight: 1.8, margin: 0, paddingLeft: "1.2rem" }}>
            <li>Collectez le classement depuis Audiomack.</li>
            <li>Validez les artistes haïtiens (à vérifier → validé / refusé / masqué).</li>
            <li>Éditez, réordonnez, masquez ou supprimez les entrées : les positions se recalculent.</li>
            <li>Publiez. Le site public affiche uniquement la dernière version publiée.</li>
          </ol>
        </div>
      </main>
    </>
  );
}
