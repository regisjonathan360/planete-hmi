import { createClient } from "@/lib/supabase/server";
import { ArtistesGrid } from "./ArtistesGrid";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";
import { HaitiShapeButton } from "@/components/HaitiMap/HaitiShapeButton";
import { withFallbackAvatars } from "@/lib/artists/avatar";
import { PRODUCER_ARTIST_TYPES, countProductionsByProducer } from "@/lib/producers/queries";

export const dynamic = "force-dynamic";

export interface PublicArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  tags: string[];
  genres: string[];
  bestPosition: number | null;
  /** Nombre de titres produits, renseigné seulement pour la vue producteurs. */
  productionCount?: number;
}

const VERIFIED_STATUSES = [
  "verified_haitian",
  "verified_haitian_diaspora",
  "verified_haitian_group",
];

async function getVerifiedArtists(typeFilter?: string): Promise<PublicArtist[]> {
  const supabase = await createClient();

  // La vue « Producteurs / Beatmakers » réunit les deux types et accepte les
  // fiches créées automatiquement pendant les collectes (encore non vérifiées).
  const isProducerView = typeFilter === "producer" || typeFilter === "beatmaker";

  let query = supabase
    .from("artists")
    .select("id, name, slug, image_url, tags, artist_type")
    .eq("is_active", true);

  if (isProducerView) {
    query = query.in("artist_type", PRODUCER_ARTIST_TYPES as unknown as string[]);
  } else if (typeFilter) {
    query = query.eq("artist_type", typeFilter).in("haitian_status", VERIFIED_STATUSES);
  } else {
    // Grille générale : uniquement des artistes vérifiés, sans les profils
    // générés automatiquement (qui restent sur la page producteurs).
    query = query.in("haitian_status", VERIFIED_STATUSES).eq("is_auto_generated", false);
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

  const productionCounts = isProducerView
    ? await countProductionsByProducer(supabase, artistIds)
    : null;

  const mapped: PublicArtist[] = artists.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    slug: a.slug as string,
    imageUrl: (a.image_url as string) ?? null,
    tags: (a.tags as string[]) ?? [],
    genres: [...(genresByArtist.get(a.id as string) ?? [])],
    bestPosition: bestPositionByArtist.get(a.id as string) ?? null,
    ...(productionCounts
      ? { productionCount: productionCounts.get(a.id as string) ?? 0 }
      : {}),
  }));

  // Photo manquante : on reprend celle d'une plateforme rattachée à la fiche.
  const withAvatars = await withFallbackAvatars(supabase, mapped);

  if (isProducerView) {
    // Les producteurs les plus crédités remontent en tête.
    return [...withAvatars].sort(
      (a, b) => (b.productionCount ?? 0) - (a.productionCount ?? 0) || a.name.localeCompare(b.name),
    );
  }

  return withAvatars;
}

interface Category {
  label: string;
  type: string;
  title: string;
  accent: string;
  lead: (count: number) => string;
}

const CATEGORIES: Category[] = [
  {
    label: "Tous les artistes",
    type: "",
    title: "La galaxie des",
    accent: "artistes",
    lead: (n) =>
      `${n} artiste${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""} illuminent Planète HMI.`,
  },
  {
    label: "Groupes",
    type: "group",
    title: "Les",
    accent: "groupes",
    lead: (n) => `${n} groupe${n > 1 ? "s" : ""} et orchestre${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
  {
    label: "Producteurs / Beatmakers",
    type: "producer",
    title: "Les",
    accent: "producteurs",
    lead: (n) =>
      `${n} producteur${n > 1 ? "s" : ""} et beatmaker${n > 1 ? "s" : ""} crédité${n > 1 ? "s" : ""} sur les titres du catalogue.`,
  },
  {
    label: "Musiciens",
    type: "musician",
    title: "Les",
    accent: "musiciens",
    lead: (n) => `${n} musicien${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
  {
    label: "DJ",
    type: "dj",
    title: "Les",
    accent: "DJ",
    lead: (n) => `${n} DJ vérifié${n > 1 ? "s" : ""}.`,
  },
  {
    label: "Chanteurs",
    type: "singer",
    title: "Les",
    accent: "chanteurs",
    lead: (n) => `${n} chanteur${n > 1 ? "s" : ""} ou chanteuse${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
  {
    label: "Rappeurs",
    type: "rapper",
    title: "Les",
    accent: "rappeurs",
    lead: (n) => `${n} rappeur${n > 1 ? "s" : ""} ou rappeuse${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
];

export default async function ArtistesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const artists = await getVerifiedArtists(type);
  const activeType = type === "beatmaker" ? "producer" : type ?? "";
  const category = CATEGORIES.find((c) => c.type === activeType) ?? CATEGORIES[0];
  const isProducerView = activeType === "producer";

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
            <nav
              style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}
              aria-label="Catégories d'artistes"
            >
              {CATEGORIES.map((cat) => {
                const isActive = cat.type === activeType;
                return (
                  <a
                    key={cat.type || "all"}
                    href={cat.type ? `/artistes?type=${cat.type}` : "/artistes"}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      display: "block",
                      padding: "0.55rem 0.8rem",
                      borderRadius: 8,
                      fontSize: "0.82rem",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#f4efe4" : "#9a9ac0",
                      textDecoration: "none",
                      background: isActive ? "rgba(124,92,255,0.22)" : "rgba(20,20,42,0.5)",
                      border: `1px solid ${isActive ? "rgba(124,92,255,0.6)" : "transparent"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    {cat.label}
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Contenu principal */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="breadcrumb">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire (réinitialise les animations) */}
              <a href="/">Accueil</a> /{" "}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire */}
              <a href="/artistes">Artistes</a>
              {category.type ? ` / ${category.label}` : ""}
            </p>
            <h1 className="page-title">
              {category.title} <span className="fx-o">{category.accent}</span>
            </h1>
            <p className="page-lead">{category.lead(artists.length)}</p>
            {isProducerView && (
              <p
                style={{
                  color: "#9a9ac0",
                  fontSize: "0.8rem",
                  margin: "-0.4rem 0 1rem",
                  maxWidth: 620,
                }}
              >
                Les crédits proviennent des mentions « Prod. by » publiées sur les plateformes.
                Les fiches non encore vérifiées par l&apos;équipe restent visibles uniquement ici.
              </p>
            )}
            <ArtistesGrid artists={artists} showProductionCount={isProducerView} />
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
