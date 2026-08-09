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
    supabase.from("artists").select("*", { count: "exact", head: true }).eq("is_excluded", false),
    supabase.from("artists").select("*", { count: "exact", head: true }).eq("is_excluded", false).eq("is_active", true),
    supabase.from("artists").select("*", { count: "exact", head: true }).eq("is_excluded", false).eq("haitian_status", "pending_review"),
    supabase.from("artist_merge_candidates").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  // Anniversaires dans les 30 prochains jours
  const { data: artistsWithBirthdate } = await supabase
    .from("artists")
    .select("id, name, slug, birth_date, image_url, is_deceased")
    .eq("is_active", true)
    .not("birth_date", "is", null);

  const today = new Date();
  const upcomingBirthdays = (artistsWithBirthdate ?? [])
    .map((a) => {
      const bd = new Date(a.birth_date as string);
      let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
      const days = Math.floor((next.getTime() - today.getTime()) / 86400000);
      return { ...a, daysUntil: days };
    })
    .filter((a) => a.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 10);

  // Artistes sans date de naissance
  const { count: noBirthdateCount } = await supabase
    .from("artists")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .is("birth_date", null);

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
            <Link href="/admin/apple-music" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value">Apple Music</div>
              <div className="stat__label">Exclusions actives</div>
            </Link>
            <Link href="/admin/tiktok" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value">TikTok</div>
              <div className="stat__label">HMI Trends</div>
            </Link>
            <Link href="/admin/youtube" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat__value" style={{ color: "var(--admin-danger)" }}>YouTube</div>
              <div className="stat__label">Top 20 HMI</div>
            </Link>
          </div>
        </div>

        {/* Anniversaires */}
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 className="admin-card__title" style={{ margin: 0 }}>🎂 Anniversaires à venir (30 jours)</h2>
            {noBirthdateCount ? (
              <Link href="/admin/artistes?filter=missing_birth_date" className="btn btn--sm btn--warn" style={{ textDecoration: "none", fontSize: "0.75rem" }}>
                ⚠ {noBirthdateCount} artistes sans date de naissance
              </Link>
            ) : null}
          </div>
          {upcomingBirthdays.length === 0 ? (
            <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem" }}>
              Aucun anniversaire dans les 30 prochains jours.{" "}
              <Link href="/admin/artistes" style={{ color: "var(--admin-accent)" }}>
                Ajouter des dates de naissance →
              </Link>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {upcomingBirthdays.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/artistes/${a.id}`}
                  style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0.6rem", borderRadius: "8px", background: "var(--admin-panel-2)", textDecoration: "none", color: "inherit" }}
                >
                  {a.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{a.name}</span>
                    {a.is_deceased && <span className="badge badge--muted" style={{ marginLeft: "0.4rem", fontSize: "0.65rem" }}>†</span>}
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.75rem",
                    color: a.daysUntil === 0 ? "var(--admin-ok)" : a.daysUntil <= 7 ? "var(--admin-warn)" : "var(--admin-muted)"
                  }}>
                    {a.daysUntil === 0 ? "🎉 Aujourd'hui !" : `Dans ${a.daysUntil} j`}
                  </span>
                </Link>
              ))}
            </div>
          )}
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
            <Link href="/admin/youtube" className="btn" style={{ textDecoration: "none" }}>
              Administrer YouTube
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
