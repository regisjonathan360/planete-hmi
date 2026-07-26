"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./artists.module.css";

export interface ArtistAdminRecord {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  banner_url: string | null;
  bio: string | null;
  haitian_status: string;
  is_active: boolean;
  is_claimed: boolean;
  tags: string[] | null;
  primary_genre: string | null;
  city: string | null;
  birth_place: string | null;
  birth_date: string | null;
  url_youtube: string | null;
  url_youtube_music: string | null;
  url_deezer: string | null;
  url_spotify: string | null;
  url_audiomack: string | null;
  url_apple_music: string | null;
  url_soundcloud: string | null;
  url_tidal: string | null;
  url_tiktok: string | null;
  url_instagram: string | null;
  url_facebook: string | null;
  url_twitter: string | null;
  url_threads: string | null;
  url_website: string | null;
  created_at: string;
  updated_at: string;
}

type FilterKey =
  | "all"
  | "claimed"
  | "unclaimed"
  | "incomplete"
  | "complete"
  | "missing_youtube"
  | "missing_deezer"
  | "missing_spotify"
  | "missing_audiomack"
  | "missing_apple_music"
  | "missing_soundcloud"
  | "missing_tidal"
  | "missing_tiktok"
  | "missing_instagram"
  | "missing_facebook"
  | "missing_x"
  | "missing_threads"
  | "missing_website"
  | "missing_birth_date"
  | "missing_birth_place"
  | "missing_photo"
  | "missing_banner"
  | "missing_roles"
  | "missing_bio"
  | "missing_genre"
  | "pending_review"
  | "hidden";

interface FilterItem {
  key: FilterKey;
  label: string;
}

interface FilterGroup {
  title: string;
  items: FilterItem[];
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    title: "Comptes artistes",
    items: [
      { key: "claimed", label: "Profils revendiqués" },
      { key: "unclaimed", label: "Profils non revendiqués" },
    ],
  },
  {
    title: "Qualité des fiches",
    items: [
      { key: "incomplete", label: "Informations manquantes" },
      { key: "complete", label: "Fiches essentielles complètes" },
      { key: "missing_bio", label: "Biographie manquante" },
      { key: "missing_genre", label: "Genre musical manquant" },
      { key: "missing_birth_date", label: "Date de naissance manquante" },
      { key: "missing_birth_place", label: "Lieu de naissance manquant" },
      { key: "missing_photo", label: "Photo de profil manquante" },
      { key: "missing_banner", label: "Bannière manquante" },
      { key: "missing_roles", label: "Rôle artistique manquant" },
    ],
  },
  {
    title: "Plateformes musicales",
    items: [
      { key: "missing_youtube", label: "Lien YouTube manquant" },
      { key: "missing_deezer", label: "Lien Deezer manquant" },
      { key: "missing_spotify", label: "Lien Spotify manquant" },
      { key: "missing_audiomack", label: "Lien Audiomack manquant" },
      { key: "missing_apple_music", label: "Lien Apple Music manquant" },
      { key: "missing_soundcloud", label: "Lien SoundCloud manquant" },
      { key: "missing_tidal", label: "Lien TIDAL manquant" },
    ],
  },
  {
    title: "Réseaux sociaux",
    items: [
      { key: "missing_tiktok", label: "Lien TikTok manquant" },
      { key: "missing_instagram", label: "Lien Instagram manquant" },
      { key: "missing_facebook", label: "Lien Facebook manquant" },
      { key: "missing_x", label: "Lien X manquant" },
      { key: "missing_threads", label: "Lien Threads manquant" },
      { key: "missing_website", label: "Site officiel manquant" },
    ],
  },
  {
    title: "Gestion",
    items: [
      { key: "pending_review", label: "Identité à vérifier" },
      { key: "hidden", label: "Profils masqués" },
    ],
  },
];

const STATUS_LABELS: Record<string, string> = {
  verified_haitian: "Vérifié",
  verified_haitian_diaspora: "Diaspora",
  verified_haitian_group: "Groupe",
  pending_review: "À vérifier",
  rejected: "Refusé",
};

function isMissing(value: string | null | undefined): boolean {
  return !value?.trim();
}

function hasEssentialMissingInfo(artist: ArtistAdminRecord): boolean {
  return (
    isMissing(artist.bio) ||
    isMissing(artist.primary_genre) ||
    isMissing(artist.birth_date) ||
    isMissing(artist.birth_place) ||
    isMissing(artist.image_url) ||
    !artist.tags?.length
  );
}

export function matchesArtistFilter(artist: ArtistAdminRecord, filter: FilterKey): boolean {
  switch (filter) {
    case "all": return true;
    case "claimed": return artist.is_claimed;
    case "unclaimed": return !artist.is_claimed;
    case "incomplete": return hasEssentialMissingInfo(artist);
    case "complete": return !hasEssentialMissingInfo(artist);
    case "missing_youtube": return isMissing(artist.url_youtube) && isMissing(artist.url_youtube_music);
    case "missing_deezer": return isMissing(artist.url_deezer);
    case "missing_spotify": return isMissing(artist.url_spotify);
    case "missing_audiomack": return isMissing(artist.url_audiomack);
    case "missing_apple_music": return isMissing(artist.url_apple_music);
    case "missing_soundcloud": return isMissing(artist.url_soundcloud);
    case "missing_tidal": return isMissing(artist.url_tidal);
    case "missing_tiktok": return isMissing(artist.url_tiktok);
    case "missing_instagram": return isMissing(artist.url_instagram);
    case "missing_facebook": return isMissing(artist.url_facebook);
    case "missing_x": return isMissing(artist.url_twitter);
    case "missing_threads": return isMissing(artist.url_threads);
    case "missing_website": return isMissing(artist.url_website);
    case "missing_birth_date": return isMissing(artist.birth_date);
    case "missing_birth_place": return isMissing(artist.birth_place);
    case "missing_photo": return isMissing(artist.image_url);
    case "missing_banner": return isMissing(artist.banner_url);
    case "missing_roles": return !artist.tags?.length;
    case "missing_bio": return isMissing(artist.bio);
    case "missing_genre": return isMissing(artist.primary_genre);
    case "pending_review": return artist.haitian_status === "pending_review";
    case "hidden": return !artist.is_active;
  }
}

export function ArtistList({ artists }: { artists: ArtistAdminRecord[] }) {
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const counts = useMemo(() => {
    const next = new Map<FilterKey, number>();
    next.set("all", artists.length);
    for (const group of FILTER_GROUPS) {
      for (const item of group.items) {
        next.set(item.key, artists.filter((artist) => matchesArtistFilter(artist, item.key)).length);
      }
    }
    return next;
  }, [artists]);

  const filtered = useMemo(() => artists.filter((artist) => {
    if (search && !artist.name.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))) return false;
    if (!matchesArtistFilter(artist, selectedFilter)) return false;
    if (statusFilter !== "all" && artist.haitian_status !== statusFilter) return false;
    if (activeFilter === "active" && !artist.is_active) return false;
    if (activeFilter === "inactive" && artist.is_active) return false;
    return true;
  }), [activeFilter, artists, search, selectedFilter, statusFilter]);

  const selectedLabel = selectedFilter === "all"
    ? "Tous les artistes"
    : FILTER_GROUPS.flatMap((group) => group.items).find((item) => item.key === selectedFilter)?.label;

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Filtres de qualité des fiches artistes">
        <button
          type="button"
          className={`${styles.filterButton} ${selectedFilter === "all" ? styles.active : ""}`}
          onClick={() => setSelectedFilter("all")}
          aria-pressed={selectedFilter === "all"}
        >
          <span>Tous les artistes</span>
          <span className={styles.count}>{counts.get("all") ?? 0}</span>
        </button>

        {FILTER_GROUPS.map((group) => (
          <section className={styles.filterGroup} key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`${styles.filterButton} ${selectedFilter === item.key ? styles.active : ""}`}
                onClick={() => setSelectedFilter(item.key)}
                aria-pressed={selectedFilter === item.key}
              >
                <span>{item.label}</span>
                <span className={styles.count}>{counts.get(item.key) ?? 0}</span>
              </button>
            ))}
          </section>
        ))}
      </aside>

      <section className={styles.content} aria-labelledby="artist-results-title">
        <div className={`admin-card ${styles.toolbarCard}`}>
          <div className={styles.toolbar}>
            <label className={styles.searchLabel}>
              <span>Rechercher un artiste</span>
              <input
                type="search"
                placeholder="Nom de l’artiste"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              <span className={styles.visuallyHidden}>Statut d’identité</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Tous les statuts</option>
                <option value="verified_haitian">Vérifié haïtien</option>
                <option value="verified_haitian_diaspora">Diaspora</option>
                <option value="verified_haitian_group">Groupe</option>
                <option value="pending_review">À vérifier</option>
                <option value="rejected">Refusé</option>
              </select>
            </label>
            <label>
              <span className={styles.visuallyHidden}>Visibilité</span>
              <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                <option value="all">Actifs et masqués</option>
                <option value="active">Actifs uniquement</option>
                <option value="inactive">Masqués uniquement</option>
              </select>
            </label>
            <Link href="/admin/artistes/nouveau" className="btn btn--primary">
              Créer un artiste
            </Link>
          </div>
          <div className={styles.resultSummary}>
            <h2 id="artist-results-title">{selectedLabel}</h2>
            <span>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
          </div>
        </div>

        <div className={`admin-card ${styles.listCard}`}>
          <div className="entry-list">
            {filtered.slice(0, 100).map((artist) => (
              <Link
                key={artist.id}
                href={`/admin/artistes/${artist.id}`}
                className={`entry ${styles.artistRow}`}
              >
                <span
                  className={`${styles.visibility} ${artist.is_active ? styles.visible : styles.hidden}`}
                  aria-label={artist.is_active ? "Profil visible" : "Profil masqué"}
                />
                <img
                  className="entry__cover"
                  src={artist.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                  alt=""
                />
                <div className="entry__meta">
                  <div className="entry__title">{artist.name}</div>
                  <div className={styles.metadata}>
                    <span>{STATUS_LABELS[artist.haitian_status] ?? artist.haitian_status}</span>
                    <span>{artist.is_claimed ? "Profil revendiqué" : "Non revendiqué"}</span>
                    {artist.tags?.length ? <span>{artist.tags.join(", ")}</span> : null}
                    {artist.primary_genre ? <span>{artist.primary_genre}</span> : null}
                  </div>
                </div>
                <div className={styles.slug}>/{artist.slug}</div>
              </Link>
            ))}
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <h3>Aucun artiste dans cette catégorie</h3>
                <p>Modifiez les filtres ou complétez les fiches déjà ouvertes.</p>
              </div>
            ) : null}
            {filtered.length > 100 ? (
              <p className={styles.limitMessage}>
                {filtered.length - 100} autres artistes. Affinez la recherche pour les afficher.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
