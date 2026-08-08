import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function FavorisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/compte/favoris");

  const [{ data }, { data: eventRows }] = await Promise.all([
    supabase
      .from("user_favorites")
      .select("artist_id, artists(id, name, slug, image_url, tags)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_events")
      .select("event_id, saved_at, events(id, source_url, source_title, source_image_url, source_date, source_location, display_title, display_image_url, event_date)")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false }),
  ]);

  const favorites = (data ?? []).map((f: unknown) => {
    const row = f as { artists: { id: string; name: string; slug: string; image_url: string | null; tags: string[] } | null };
    return row.artists;
  }).filter(Boolean);
  const savedEvents = (eventRows ?? []).map((row: unknown) => {
    const event = (row as { events: Record<string, unknown> | Record<string, unknown>[] | null }).events;
    return Array.isArray(event) ? event[0] ?? null : event;
  }).filter(Boolean) as Record<string, unknown>[];
  const email = user.email ?? null;

  return (
    <>
      <SiteHeader initialUser={{ email, initial: (email ?? "U").charAt(0).toUpperCase() }} />
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

          <h2 style={{ marginTop: "2.5rem" }}>Événements enregistrés</h2>
          {savedEvents.length === 0 ? (
            <p style={{ color: "rgba(244,239,228,0.6)" }}>
              Aucun événement enregistré. Consulte la{" "}
              <Link href="/evenements" style={{ color: "var(--flame-orange, #ff6a00)" }}>page des événements</Link>
              {" "}et utilise le ruban pour les retrouver ici.
            </p>
          ) : (
            <div className="saved-events-grid">
              {savedEvents.map((event) => (
                <a
                  key={String(event.id)}
                  href={String(event.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="saved-event-card"
                >
                  {(event.display_image_url || event.source_image_url) ? (
                    <Image
                      unoptimized
                      src={String(event.display_image_url || event.source_image_url)}
                      alt=""
                      width={84}
                      height={84}
                    />
                  ) : null}
                  <div>
                    <strong>{String(event.display_title || event.source_title)}</strong>
                    {event.source_date ? <span>{String(event.source_date)}</span> : null}
                    {event.source_location ? <span>{String(event.source_location)}</span> : null}
                  </div>
                </a>
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
