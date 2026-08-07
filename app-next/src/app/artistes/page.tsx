import { createClient } from "@/lib/supabase/server";
import { ArtistesGrid } from "./ArtistesGrid";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";
import { HaitiShapeButton } from "@/components/HaitiMap/HaitiShapeButton";
import { EtoilesEteintesLink } from "@/components/EtoilesEteintes/EtoilesEteintesLink";
import { withFallbackAvatars } from "@/lib/artists/avatar";
import { PRODUCER_ARTIST_TYPES, countProductionsByProducer } from "@/lib/producers/queries";
import { canonicalizeArtistRoles } from "@/lib/artists/roles";

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

const CATEGORY_TAG_BY_TYPE: Record<string, string> = {
  group: "groupe",
  producer: "beatmaker",
  beatmaker: "beatmaker",
  musician: "musicien",
  dj: "dj",
  singer: "chanteur",
  rapper: "rappeur",
};

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
    const roleTag = CATEGORY_TAG_BY_TYPE[typeFilter];
    if (roleTag) query = query.contains("tags", [roleTag]);
    query = query.in("haitian_status", VERIFIED_STATUSES);
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

/** Libellés affichés dans la sidebar : alignés sur le CHECK artist_type + la vue publique. */
const CATEGORY_META: Record<string, { label: string; title: string; accent: string; lead: (n: number) => string }> = {
  "": {
    label: "Tous les artistes",
    title: "La galaxie des",
    accent: "artistes",
    lead: (n) => `${n} artiste${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""} illuminent Planète HMI.`,
  },
  group: {
    label: "Groupes",
    title: "Les",
    accent: "groupes",
    lead: (n) => `${n} groupe${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
  producer: {
    label: "Producteurs / Beatmakers",
    title: "Les",
    accent: "producteurs",
    lead: (n) => `${n} producteur${n > 1 ? "s" : ""} et beatmaker${n > 1 ? "s" : ""} crédité${n > 1 ? "s" : ""}.`,
  },
  musician: {
    label: "Musiciens",
    title: "Les",
    accent: "musiciens",
    lead: (n) => `${n} musicien${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
  dj: {
    label: "DJ",
    title: "Les",
    accent: "DJ",
    lead: (n) => `${n} DJ vérifié${n > 1 ? "s" : ""}.`,
  },
  singer: {
    label: "Chanteurs",
    title: "Les",
    accent: "chanteurs",
    lead: (n) => `${n} chanteur${n > 1 ? "s" : ""} ou chanteuse${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
  rapper: {
    label: "Rappeurs",
    title: "Les",
    accent: "rappeurs",
    lead: (n) => `${n} rappeur${n > 1 ? "s" : ""} ou rappeuse${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}.`,
  },
};

interface CategoryWithCount {
  type: string;
  label: string;
  title: string;
  accent: string;
  lead: (n: number) => string;
  count: number;
}

/** Construit la liste des catégories avec le comptage réel par type en base. */
async function buildCategories(): Promise<CategoryWithCount[]> {
  const supabase = await createClient();

  // Un seul aller-retour : comptage par artist_type pour tous les artistes actifs + vérifiés.
  const { data: rows } = await supabase
    .from("artists")
    .select("tags")
    .eq("is_active", true)
    .in("haitian_status", VERIFIED_STATUSES);

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    for (const role of canonicalizeArtistRoles((row.tags as string[] | null) ?? [])) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
  }

  const categories: CategoryWithCount[] = [
    { ...CATEGORY_META[""], type: "", count: rows?.length ?? 0 },
  ];

  // Les options restent toujours visibles. Un filtre vide affiche simplement
  // un compteur à zéro au lieu de faire disparaître la navigation latérale.
  const typeOrder = ["group", "producer", "musician", "dj", "singer", "rapper"];
  for (const type of typeOrder) {
    const cnt = counts.get(CATEGORY_TAG_BY_TYPE[type]) ?? 0;
    const meta = CATEGORY_META[type];
    if (meta) categories.push({ ...meta, type, count: cnt });
  }

  return categories;
}

/** Compte les artistes en mémoire, pour la pastille de l'entrée « Étoiles éteintes ». */
async function countDeceasedArtists(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("artists")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_deceased", true);

  return count ?? 0;
}

export default async function ArtistesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const [artists, categories, deceasedCount] = await Promise.all([
    getVerifiedArtists(type),
    buildCategories(),
    countDeceasedArtists(),
  ]);
  const activeType = type === "beatmaker" ? "producer" : type ?? "";
  const category = categories.find((c) => c.type === activeType) ?? categories[0];
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
        <div className="wrap artistes-layout">
          {/* Sidebar : bouton carte + catégories */}
          <aside className="artistes-sidebar">
            {/* Bouton carte Haïti — silhouette générée depuis le GeoJSON GADM réel */}
            <HaitiShapeButton />

            {/* Catégories */}
            <nav
              className="artistes-sidebar__nav"
              aria-label="Catégories d'artistes"
            >
              {categories.map((cat) => {
                const isActive = cat.type === activeType;
                return (
                  <a
                    key={cat.type || "all"}
                    href={cat.type ? `/artistes?type=${cat.type}` : "/artistes"}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
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
                    <span>{cat.label}</span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        opacity: 0.6,
                        background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                        padding: "0.1rem 0.4rem",
                        borderRadius: 999,
                      }}
                    >
                      {cat.count}
                    </span>
                  </a>
                );
              })}
            </nav>

            {/* Hommage aux artistes disparus, sous les options de filtre */}
            <EtoilesEteintesLink count={deceasedCount} />
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
