import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";

export const dynamic = "force-dynamic";

export default async function AppleMusicAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/apple-music");

  const supabase = createAdminClient();
  const [{ count: includedArtists }, { count: excludedArtists }] = await Promise.all([
    supabase.from("artists").select("*", { count: "exact", head: true }).eq("is_excluded", false),
    supabase.from("artists").select("*", { count: "exact", head: true }).eq("is_excluded", true),
  ]);

  return (
    <>
      <AdminHeader email={user.email} active="apple-music" />
      <main className="admin__main">
        <h1 className="admin__title">Apple Music</h1>
        <p className="admin__subtitle">
          Le registre global d’exclusion est déjà actif pour Apple Music. Toute future collecte ignorera automatiquement les artistes exclus.
        </p>

        <div className="admin-card">
          <h2 className="admin-card__title">Protection des collectes</h2>
          <div className="admin-stats">
            <div className="stat">
              <div className="stat__value">{includedArtists ?? 0}</div>
              <div className="stat__label">Artistes admissibles</div>
            </div>
            <Link href="/admin/artistes?filter=excluded" className="stat" style={{ color: "inherit", textDecoration: "none" }}>
              <div className="stat__value" style={{ color: "var(--admin-danger)" }}>{excludedArtists ?? 0}</div>
              <div className="stat__label">Artistes exclus</div>
            </Link>
          </div>
          <div className="banner" style={{ marginTop: "1rem" }}>
            La collecte Apple Music n’est pas encore activée. Le filtre persistant est néanmoins appliqué en base et ne dépend pas de l’interface de collecte.
          </div>
        </div>
      </main>
    </>
  );
}
