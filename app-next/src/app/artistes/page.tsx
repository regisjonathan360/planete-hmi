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
            {/* Bouton carte Haïti — contour extrait du GeoJSON réel (GADM) */}
            <Link href="/carte" style={{ display: "block", textAlign: "center", marginBottom: "1.2rem", padding: "0.7rem", borderRadius: 12, background: "rgba(20,20,42,0.6)", border: "1px solid rgba(124,92,255,0.3)", textDecoration: "none", color: "#f4efe4", transition: "all 0.2s" }}>
              <svg viewBox="0 0 200 160" width="90" height="72" style={{ display: "block", margin: "0 auto 0.4rem" }} aria-hidden="true">
                <defs>
                  <linearGradient id="haiti-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a3a8f">
                      <animate attributeName="stop-color" values="#1a3a8f;#c62828;#1a3a8f" dur="4s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="50%" stopColor="#c62828">
                      <animate attributeName="stop-color" values="#c62828;#1a3a8f;#c62828" dur="4s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="100%" stopColor="#1a3a8f">
                      <animate attributeName="stop-color" values="#1a3a8f;#c62828;#1a3a8f" dur="4s" repeatCount="indefinite" />
                    </stop>
                  </linearGradient>
                </defs>
                <path
                  d="M41.1,159.6 L39.7,157.0 L38.7,154.6 L37.1,151.5 L35.1,149.5 L33.3,147.7 L30.0,145.5 L27.5,143.2 L23.8,141.3 L21.4,139.6 L17.8,137.7 L9.6,139.0 L5.9,137.3 L2.5,134.8 L3.4,133.9 L6.9,133.8 L10.9,133.5 L14.3,132.2 L18.0,131.7 L21.6,131.3 L28.3,130.3 L35.1,132.8 L39.0,133.5 L40.2,130.8 L44.4,130.1 L50.4,128.9 L56.2,130.9 L58.8,128.8 L63.0,129.5 L65.3,131.6 L64.6,134.6 L69.8,135.2 L75.4,134.9 L80.3,133.2 L82.4,133.3 L84.8,133.9 L90.4,133.6 L94.9,133.7 L97.4,135.5 L98.4,136.7 L100.0,138.5 L100.1,140.0 L101.0,141.6 L101.9,143.2 L102.5,144.2 L102.7,145.5 L102.6,147.3 L96.7,147.1 L91.8,145.5 L88.7,145.2 L84.8,145.0 L80.8,144.5 L79.1,144.4 L77.8,143.5 L77.9,141.7 L76.5,140.8 L76.0,140.8 L75.2,141.4 L75.5,141.8 L75.3,141.9 L73.5,141.7 L72.2,141.1 L70.3,142.3 L69.0,142.2 L67.6,143.5 L65.6,142.0 L63.5,141.9 L64.0,144.8 L62.3,143.7 L60.7,145.1 L61.0,143.0 L60.6,142.2 L59.3,144.4 L57.1,145.0 L58.6,142.7 L56.5,144.4 L54.5,144.0 L53.0,146.0 L49.8,147.7 L44.7,152.6 L47.0,155.9 L47.6,156.9 L48.8,157.8 L48.7,158.5 L47.6,159.9 L43.0,159.8Z"
                  fill="url(#haiti-grad)"
                  stroke="rgba(200,200,255,0.6)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
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
