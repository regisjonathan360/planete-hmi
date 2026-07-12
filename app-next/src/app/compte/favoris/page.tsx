import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FavorisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/compte/favoris");

  const { data } = await supabase
    .from("user_favorites")
    .select("artist_id, artists(id, name, slug, image_url, tags)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favorites = (data ?? []).map((f: unknown) => {
    const row = f as { artists: { id: string; name: string; slug: string; image_url: string | null; tags: string[] } | null };
    return row.artists;
  }).filter(Boolean);

  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap">
          <h1 className="legal-page__title">Mes artistes favoris</h1>

          {favorites.length === 0 ? (
            <p style={{ color: "rgba(244,239,228,0.6)" }}>
              Aucun artiste dans tes favoris. Explore la{" "}
              <Link href="/artistes" style={{ color: "var(--flame-orange, #ff6a00)" }}>galaxie des artistes</Link>{" "}
              et clique ♡ pour en ajouter !
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
              {favorites.map((a) => a && (
                <Link
                  key={a.id}
                  href={`/artistes/${a.slug}`}
                  style={{ textDecoration: "none", color: "inherit", textAlign: "center" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                    alt={a.name}
                    width={100} height={100}
                    style={{ borderRadius: "50%", objectFit: "cover", margin: "0 auto 0.5rem", display: "block", background: "#15131f" }}
                  />
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{a.name}</span>
                </Link>
              ))}
            </div>
          )}

          <p style={{ marginTop: "2rem" }}>
            <Link href="/compte" style={{ color: "var(--flame-orange, #ff6a00)" }}>← Retour à mon espace</Link>
          </p>
        </div>
      </main>
    </>
  );
}
