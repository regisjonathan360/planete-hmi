import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function FavorisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/compte/favoris");

  // Pour l'instant, placeholder — les favoris seront implémentés en Phase 5
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap">
          <h1 className="legal-page__title">Mes favoris</h1>
          <p style={{ color: "rgba(244,239,228,0.6)" }}>
            Aucun artiste dans tes favoris pour le moment. Explore la{" "}
            <a href="/artistes" style={{ color: "var(--flame-orange, #ff6a00)" }}>galaxie des artistes</a>{" "}
            et ajoute tes préférés !
          </p>
        </div>
      </main>
    </>
  );
}
