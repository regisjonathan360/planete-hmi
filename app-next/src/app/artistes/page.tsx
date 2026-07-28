import { createClient } from "@/lib/supabase/server";
import { ArtistesGrid } from "./ArtistesGrid";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";
import { HaitiShapeButton } from "@/components/HaitiMap/HaitiShapeButton";

export const dynamic = "force-dynamic";

export interface PublicArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  tags: string[];
  genres: string[];
  bestPosition: number | null;
}

async function getVerifiedArtists(typeFilter?: string): Promise<PublicArtist[]> {
  const supabase = await createClient();

  let query = supabase
    .from("artists")
    .select("id, name, slug, image_url, tags, artist_type")
    .in("haitian_status", [
      "verified_haitian",
      "verified_haitian_diaspora",
      "verified_haitian_group",
    ])
    .eq("is_active", true);

  if (typeFilter) {
    query = query.eq("artist_type", typeFilter);
  }

  const { data: artists } = await query.order("name");

  if (!artists?.length) return [];

  // Genres dérivés + meilleure position au classement
  const artistIds = artists.map((a) => a.id as string);
  const { data: credits } = await supabase
    .from("track_artists")
    .select("artist_id, track_id")
    .in("artist_id", artistIds)
    .in("role", ["primary", "co_primary"]);

  const trackIds = [...new Set((credits ?? []).map((c) => c.track_id as string))];
  const genresByArtist = new Map<string, Set<string>>();
  const bestPositionByArtist = new Map<string, number>();

  if (trackIds.length) {
    const { data: entries } = await supabase
      .from("chart_entries")
      .select("track_id, genre, filtered_position")
      .in("track_id", trackIds);

    const genreByTrack = new Map<string, string>();
    const bestPosByTrack = new Map<string, number>();

    for (const e of entries ?? []) {
      if (e.genre) genreByTrack.set(e.track_id as string, e.genre as string);
      const pos = e.filtered_position as number | null;
      if (pos != null) {
        const current = bestPosByTrack.get(e.track_id as string);
        bestPosByTrack.set(e.track_id as string, current != null ? Math.min(current, pos) : pos);
      }
    }

    for (const c of credits ?? []) {
      const genre = genreByTrack.get(c.track_id as string);
      if (genre) {
        if (!genresByArtist.has(c.artist_id as string)) {
          genresByArtist.set(c.artist_id as string, new Set());
        }
        genresByArtist.get(c.artist_id as string)!.add(genre);
      }

      const trackPos = bestPosByTrack.get(c.track_id as string);
      if (trackPos != null) {
        const current = bestPositionByArtist.get(c.artist_id as string);
        bestPositionByArtist.set(
          c.artist_id as string,
          current != null ? Math.min(current, trackPos) : trackPos
        );
      }
    }
  }

  return artists.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    slug: a.slug as string,
    imageUrl: (a.image_url as string) ?? null,
    tags: (a.tags as string[]) ?? [],
    genres: [...(genresByArtist.get(a.id as string) ?? [])],
    bestPosition: bestPositionByArtist.get(a.id as string) ?? null,
  }));
}

export default async function ArtistesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const artists = await getVerifiedArtists(type);

  return (
    <>
      {/* Fond cosmos custom artiste */}
      <div className="grain" aria-hidden="true" />
      <div className="cosmos cosmos--artistes" aria-hidden="true">
        <div className="cosmos__layer cosmos__stars-distant" data-depth="0.06" />
        <div className="cosmos__layer cosmos__stars-near" data-depth="0.14" />
        <div className="cosmos__glow" />
      </div>

      <a className="skip-link" href="#contenu">Aller au contenu principal</a>

      {/* Topbar identique à la DA */}
      <SiteHeader />

      <main id="contenu">
        <div className="wrap" style={{ paddingTop: "2rem", display: "flex", gap: "2rem", alignItems: "flex-start" }}>
          {/* Sidebar : bouton carte + catégories */}
          <aside style={{ position: "sticky", top: "5rem", flexShrink: 0, width: 200 }} className="artistes-sidebar">
            {/* Bouton carte Haïti — silhouette générée depuis le GeoJSON GADM réel */}
            <HaitiShapeButton />

            {/* Catégories */}
            <nav style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {[
                { label: "Tous les artistes", type: "" },
                { label: "Groupes", type: "group" },
                { label: "Producteurs / Beatmakers", type: "producer" },
                { label: "Musiciens", type: "musician" },
                { label: "DJ", type: "dj" },
                { label: "Chanteurs", type: "singer" },
                { label: "Rappeurs", type: "rapper" },
              ].map((cat) => (
                <a
                  key={cat.type}
                  href={cat.type ? `/artistes?type=${cat.type}` : "/artistes"}
                  style={{
                    display: "block",
                    padding: "0.55rem 0.8rem",
                    borderRadius: 8,
                    fontSize: "0.82rem",
                    color: "#9a9ac0",
                    textDecoration: "none",
                    background: "rgba(20,20,42,0.5)",
                    border: "1px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  {cat.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Contenu principal */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire */}
            <p className="breadcrumb"><a href="/">Accueil</a> / Artistes</p>
            <h1 className="page-title">La galaxie des <span className="fx-o">artistes</span></h1>
            <p className="page-lead">
              {artists.length} artiste{artists.length > 1 ? "s" : ""} vérifié{artists.length > 1 ? "s" : ""} illuminent Planète HMI.
            </p>
            <ArtistesGrid artists={artists} />
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-bottom">
            <p className="footer-legal-links">
              <Link href="/privacy">Confidentialité</Link>
              <span aria-hidden="true">/</span>
              <Link href="/terms">Conditions</Link>
            </p>
            <p>Planète HMI © 2026 — Tous droits réservés</p>
          </div>
        </div>
      </footer>
    </>
  );
}
