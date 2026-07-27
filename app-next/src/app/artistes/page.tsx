import { createClient } from "@/lib/supabase/server";
import { ArtistesGrid } from "./ArtistesGrid";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";

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
            {/* Bouton carte Haïti — silhouette géographique réelle */}
            <Link href="/carte" style={{ display: "block", textAlign: "center", marginBottom: "1.2rem", padding: "0.6rem", borderRadius: 12, background: "rgba(124,92,255,0.08)", border: "1px solid rgba(124,92,255,0.3)", textDecoration: "none", color: "#f4efe4", transition: "all 0.2s" }}>
              <svg viewBox="-74.5 -20.1 3.5 2.3" width="80" height="55" style={{ display: "block", margin: "0 auto 0.4rem" }} aria-hidden="true">
                <path
                  d="M-74.48,18.09 L-74.42,18.22 L-74.27,18.28 L-74.13,18.34 L-73.97,18.43 L-73.79,18.54 L-73.63,18.59 L-73.47,18.62 L-73.39,18.66 L-73.33,18.73 L-73.28,18.79 L-73.21,18.84 L-73.12,18.86 L-72.98,18.84 L-72.87,18.81 L-72.79,18.79 L-72.69,18.81 L-72.60,18.83 L-72.48,18.84 L-72.35,18.82 L-72.24,18.80 L-72.13,18.76 L-72.05,18.72 L-71.99,18.68 L-71.87,18.62 L-71.80,18.62 L-71.73,18.66 L-71.69,18.70 L-71.65,18.75 L-71.64,18.80 L-71.62,18.84 L-71.63,18.91 L-71.68,18.96 L-71.72,19.00 L-71.78,19.04 L-71.84,19.07 L-71.90,19.12 L-71.95,19.16 L-72.00,19.21 L-72.05,19.26 L-72.08,19.30 L-72.10,19.37 L-72.12,19.44 L-72.13,19.50 L-72.18,19.55 L-72.26,19.60 L-72.34,19.63 L-72.43,19.67 L-72.55,19.70 L-72.62,19.73 L-72.72,19.78 L-72.78,19.83 L-72.83,19.87 L-72.90,19.91 L-72.98,19.94 L-73.05,19.95 L-73.14,19.95 L-73.24,19.93 L-73.34,19.90 L-73.42,19.87 L-73.48,19.83 L-73.56,19.77 L-73.62,19.72 L-73.68,19.67 L-73.72,19.64 L-73.76,19.57 L-73.78,19.51 L-73.77,19.44 L-73.73,19.38 L-73.68,19.33 L-73.62,19.29 L-73.55,19.25 L-73.46,19.21 L-73.38,19.17 L-73.32,19.13 L-73.28,19.09 L-73.22,19.04 L-73.16,18.99 L-73.12,18.95 L-73.09,18.90 L-73.08,18.84 L-73.10,18.78 L-73.14,18.71 L-73.21,18.65 L-73.30,18.61 L-73.39,18.58 L-73.49,18.54 L-73.61,18.49 L-73.73,18.44 L-73.86,18.37 L-73.96,18.32 L-74.06,18.26 L-74.18,18.20 L-74.28,18.15 L-74.38,18.10 L-74.48,18.09 Z"
                  fill="rgba(124,92,255,0.25)"
                  stroke="rgba(124,92,255,0.8)"
                  strokeWidth="0.02"
                  transform="scale(1,-1)"
                />
              </svg>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Explorer la carte</span>
            </Link>

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
