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
            {/* Bouton carte Haïti — silhouette fidèle au contour réel */}
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
                {/* Contour fidèle d'Haïti tracé à partir de l'image de référence */}
                <path
                  d="M 95,5 C 100,4 108,5 115,4 C 118,4 120,5 120,5 L 118,7
                     M 75,15 C 82,12 92,10 100,10 C 110,10 118,12 125,14 C 133,16 140,18 148,18 C 155,17 162,15 168,16 C 175,18 180,22 183,28 C 186,34 187,40 186,47 C 185,54 182,60 180,67 C 178,73 176,78 175,84 C 174,90 174,96 175,102 C 176,108 178,114 177,120 C 175,126 172,131 168,135 C 163,139 158,142 152,144 C 146,146 140,146 134,145 C 128,144 123,141 118,138 C 114,136 110,133 106,131 C 102,129 98,128 94,128 C 89,128 84,130 80,132 C 75,135 70,138 65,140 C 59,142 53,143 47,143 C 41,142 35,140 30,137 C 25,134 21,130 18,125 C 15,121 13,116 12,111 C 11,106 12,101 14,97 C 16,93 19,90 22,87 C 25,84 28,82 32,80 C 35,79 38,78 42,78 C 45,78 48,79 52,80 C 55,81 58,82 61,82 C 64,82 67,81 69,79 C 72,77 74,74 75,71 C 76,68 76,65 75,62 C 74,58 72,55 70,52 C 68,49 65,47 62,45 C 59,43 56,42 52,41 C 48,41 44,41 40,42 C 36,43 32,45 28,46 C 24,47 20,48 16,48 C 13,47 10,46 8,44 C 6,42 5,39 5,36 C 5,33 6,30 8,28 C 10,26 13,24 16,23 C 20,21 24,20 28,19 C 33,18 38,17 43,16 C 48,15 54,14 59,14 C 64,14 69,15 75,15 Z
                     M 55,55 C 60,53 66,52 72,53 C 76,54 78,56 78,58 C 77,60 75,62 72,62 C 68,63 64,62 60,61 C 57,60 55,58 55,55 Z"
                  fill="url(#haiti-grad)"
                  stroke="rgba(200,200,255,0.5)"
                  strokeWidth="1.5"
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
