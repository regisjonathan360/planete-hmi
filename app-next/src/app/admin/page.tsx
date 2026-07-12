import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "./AdminHeader";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const supabase = createAdminClient();

  // Stats rapides
  const [
    { count: totalArtists },
    { count: activeArtists },
    { count: pendingArtists },
    { count: pendingDoublons },
  ] = await Promise.all([
    supabase.from("artists").select("*", { count: "exact", head: true }),
    supabase.from("artists").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("artists").select("*", { count: "exact", head: true }).eq("haitian_status", "pending_review"),
    supabase.from("artist_merge_candidates").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <>
      <AdminHeader email={user.email} active="home" />
      <main className="admin__main">
        <h1 className="admin__title">Tableau de bord</h1>
        <p className="admin__subtitle">Vue d&apos;ensemble de Planète HMI.</p>

        {/* Stats globales */}
        <div className="admin-card">
          <h2 className="admin-card__title">Artistes</h2>
          <div className="admin-stats">
            <Link href="/admin/artistes" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value">{totalArtists ?? 0}</div>
              <div className="stat__label">Total artistes</div>
            </Link>
            <Link href="/admin/artistes?filter=active" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value" style={{ color: "var(--admin-ok)" }}>{activeArtists ?? 0}</div>
              <div className="stat__label">Actifs (visibles)</div>
            </Link>
            <Link href="/admin/artistes?filter=pending" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value" style={{ color: "var(--admin-warn)" }}>{pendingArtists ?? 0}</div>
              <div className="stat__label">À vérifier</div>
            </Link>
            <Link href="/admin/doublons" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value" style={{ color: pendingDoublons ? "var(--admin-danger)" : "var(--admin-muted)" }}>
                {pendingDoublons ?? 0}
              </div>
              <div className="stat__label">Doublons à traiter</div>
            </Link>
          </div>
        </div>

        {/* Plateformes */}
        <div className="admin-card">
          <h2 className="admin-card__title">Classements</h2>
          <div className="admin-stats">
            <Link href="/admin/audiomack" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value" style={{ color: "var(--admin-accent-2)" }}>Audiomack</div>
              <div className="stat__label">Top Songs Haiti</div>
            </Link>
            <Link href="/admin/deezer" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value" style={{ color: "var(--admin-accent)" }}>Deezer</div>
              <div className="stat__label">Top Haiti</div>
            </Link>
            <Link href="/admin/tiktok" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value">TikTok</div>
              <div className="stat__label">HMI Trends</div>
            </Link>
            <div className="stat" style={{ opacity: 0.4 }}>
              <div className="stat__value">Apple Music</div>
              <div className="stat__label">Bientôt</div>
            </div>
          </div>
        </div>

        {/* Accès rapides */}
        <div className="admin-card">
          <h2 className="admin-card__title">Accès rapides</h2>
          <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
            <Link href="/admin/artistes/nouveau" className="btn btn--primary" style={{ textDecoration: "none" }}>
              + Créer un artiste
            </Link>
            <Link href="/admin/artistes" className="btn" style={{ textDecoration: "none" }}>
              Gérer les artistes
            </Link>
            <Link href="/admin/doublons" className="btn" style={{ textDecoration: "none" }}>
              Doublons possibles
            </Link>
            <Link href="/charts" className="btn btn--ghost" style={{ textDecoration: "none" }} target="_blank">
              Voir le site public ↗
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
