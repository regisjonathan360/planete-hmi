import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/compte");

  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap">
          <h1 className="legal-page__title">Mon espace</h1>

          <section style={{ marginBottom: "2rem" }}>
            <h2>Profil</h2>
            <p><strong>Email :</strong> {user.email}</p>
            <p><strong>Membre depuis :</strong> {new Date(user.created_at).toLocaleDateString("fr-FR")}</p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2>Mes favoris</h2>
            <p>
              <Link href="/compte/favoris" style={{ color: "var(--flame-orange, #ff6a00)" }}>
                Voir mes artistes favoris →
              </Link>
            </p>
          </section>

          <section>
            <h2>Actions</h2>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" style={{
                background: "transparent", border: "1px solid rgba(255,92,124,0.5)",
                color: "#ff5c7c", padding: "0.5rem 1rem", borderRadius: "8px",
                cursor: "pointer", fontSize: "0.88rem",
              }}>
                Se déconnecter
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
