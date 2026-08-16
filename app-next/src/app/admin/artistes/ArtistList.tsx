"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ARTIST_TAGS } from "@/lib/artists/tags";
import { artistTypeFromRoles } from "@/lib/artists/roles";
import styles from "./artists.module.css";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

export interface ArtistAdminRecord {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  banner_url: string | null;
  bio: string | null;
  haitian_status: string;
  is_active: boolean;
  is_excluded: boolean;
  exclusion_reason: string | null;
  excluded_at: string | null;
  is_claimed: boolean;
  artist_type: string;
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
  | "hidden"
  | "excluded";

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
      { key: "excluded", label: "Artistes exclus" },
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

const ARTIST_TYPE_OPTIONS = [
  { value: "all", label: "Tous les profils" },
  { value: "artist", label: "Artistes solo" },
  { value: "group", label: "Groupes / orchestres" },
  { value: "singer", label: "Chanteurs / chanteuses" },
  { value: "rapper", label: "Rappeurs / rappeuses" },
  { value: "producer", label: "Producteurs" },
  { value: "beatmaker", label: "Beatmakers" },
  { value: "dj", label: "DJ" },
  { value: "musician", label: "Musiciens / musiciennes" },
] as const;

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
  if (filter === "excluded") return artist.is_excluded;
  if (artist.is_excluded) return false;
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

export function getPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const visiblePages = [...pages]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  visiblePages.forEach((candidate, index) => {
    if (index > 0 && candidate - visiblePages[index - 1] > 1) items.push("ellipsis");
    items.push(candidate);
  });

  return items;
}

export function ArtistList({
  artists,
  initialFilter = "all",
}: {
  artists: ArtistAdminRecord[];
  initialFilter?: FilterKey;
}) {
  const [artistRows, setArtistRows] = useState(artists);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>(initialFilter);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const next = new Map<FilterKey, number>();
    next.set("all", artistRows.filter((artist) => !artist.is_excluded).length);
    for (const group of FILTER_GROUPS) {
      for (const item of group.items) {
        next.set(item.key, artistRows.filter((artist) => matchesArtistFilter(artist, item.key)).length);
      }
    }
    return next;
  }, [artistRows]);

  const filtered = useMemo(() => artistRows.filter((artist) => {
    if (search) {
      const q = search.toLocaleLowerCase("fr");
      const qSlug = q
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const nameHit = artist.name.toLocaleLowerCase("fr").includes(q);
      const slugHit = qSlug.length > 0 && (artist.slug ?? "").toLowerCase().includes(qSlug);
      if (!nameHit && !slugHit) return false;
    }
    if (!matchesArtistFilter(artist, selectedFilter)) return false;
    if (statusFilter !== "all" && artist.haitian_status !== statusFilter) return false;
    if (activeFilter === "active" && !artist.is_active) return false;
    if (activeFilter === "inactive" && artist.is_active) return false;
    if (typeFilter !== "all" && artist.artist_type !== typeFilter) return false;
    if (genreFilter !== "all" && artist.primary_genre !== genreFilter) return false;
    return true;
  }), [activeFilter, artistRows, genreFilter, search, selectedFilter, statusFilter, typeFilter]);

  const genres = useMemo(
    () => [...new Set(artistRows.filter((artist) => !artist.is_excluded).map((artist) => artist.primary_genre?.trim()).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, "fr")),
    [artistRows],
  );

  const selectedLabel = selectedFilter === "all"
    ? "Tous les artistes"
    : FILTER_GROUPS.flatMap((group) => group.items).find((item) => item.key === selectedFilter)?.label;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstResult = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastResult = Math.min(currentPage * pageSize, filtered.length);
  const paginatedArtists = filtered.slice(firstResult ? firstResult - 1 : 0, lastResult);
  const paginationItems = getPaginationItems(currentPage, totalPages);

  function selectFilter(filter: FilterKey) {
    setSelectedFilter(filter);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    document.getElementById("artist-results-title")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  function updateLocalArtist(id: string, patch: Partial<ArtistAdminRecord>) {
    setArtistRows((current) => current.map((artist) => artist.id === id ? { ...artist, ...patch } : artist));
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Filtres de qualité des fiches artistes">
        <button
          type="button"
          className={`${styles.filterButton} ${selectedFilter === "all" ? styles.active : ""}`}
          onClick={() => selectFilter("all")}
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
                onClick={() => selectFilter(item.key)}
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
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              <span className={styles.visuallyHidden}>Type de profil</span>
              <select value={typeFilter} onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}>
                {ARTIST_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={styles.visuallyHidden}>Genre musical</span>
              <select value={genreFilter} onChange={(event) => {
                setGenreFilter(event.target.value);
                setPage(1);
              }}>
                <option value="all">Tous les genres</option>
                {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
            </label>
            <label>
              <span className={styles.visuallyHidden}>Statut d’identité</span>
              <select value={statusFilter} onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}>
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
              <select value={activeFilter} onChange={(event) => {
                setActiveFilter(event.target.value);
                setPage(1);
              }}>
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
            <div className={styles.resultControls}>
              <span>
                {firstResult}–{lastResult} sur {filtered.length} artiste{filtered.length > 1 ? "s" : ""}
              </span>
              <label className={styles.pageSize}>
                <span>Par page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className={`admin-card ${styles.listCard}`}>
          <div className="entry-list">
            {paginatedArtists.map((artist) => (
              <div
                key={artist.id}
                className={`entry ${styles.artistRow} ${artist.is_excluded ? "is-excluded" : ""}`}
              >
                <span
                  className={`${styles.visibility} ${artist.is_active && !artist.is_excluded ? styles.visible : styles.hidden}`}
                  aria-label={artist.is_active && !artist.is_excluded ? "Profil visible" : "Profil non public"}
                />
                <Link href={`/admin/artistes/${artist.id}`} className={styles.artistIdentity}>
                  <img
                    className="entry__cover"
                    src={artist.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                    alt=""
                  />
                  <div className="entry__meta">
                    <div className="entry__title">{artist.name}</div>
                    <div className={styles.metadata}>
                      {artist.is_excluded ? <span className={styles.excludedLabel}>Exclu globalement</span> : null}
                      <span>{STATUS_LABELS[artist.haitian_status] ?? artist.haitian_status}</span>
                      <span>{artist.is_claimed ? "Profil revendiqué" : "Non revendiqué"}</span>
                      <span>{ARTIST_TYPE_OPTIONS.find((option) => option.value === artist.artist_type)?.label ?? artist.artist_type}</span>
                      {artist.tags?.length ? <span>{artist.tags.join(", ")}</span> : null}
                      {artist.primary_genre ? <span>{artist.primary_genre}</span> : null}
                    </div>
                    {artist.is_excluded && artist.exclusion_reason ? (
                      <p className={styles.exclusionReason}>{artist.exclusion_reason}</p>
                    ) : null}
                  </div>
                </Link>
                <ArtistQuickActions artist={artist} onUpdated={updateLocalArtist} />
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <h3>Aucun artiste dans cette catégorie</h3>
                <p>Modifiez les filtres ou complétez les fiches déjà ouvertes.</p>
              </div>
            ) : null}
          </div>
          {filtered.length > 0 ? (
            <nav className={styles.pagination} aria-label="Pagination des artistes">
              <button
                type="button"
                className={styles.pageNav}
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                Précédent
              </button>
              <div className={styles.pageNumbers}>
                {paginationItems.map((item, index) => item === "ellipsis" ? (
                  <span className={styles.ellipsis} key={`ellipsis-${index}`} aria-hidden="true">…</span>
                ) : (
                  <button
                    type="button"
                    key={item}
                    className={`${styles.pageNumber} ${item === currentPage ? styles.currentPage : ""}`}
                    onClick={() => goToPage(item)}
                    aria-current={item === currentPage ? "page" : undefined}
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.pageNav}
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Suivant
              </button>
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ArtistQuickActions({
  artist,
  onUpdated,
}: {
  artist: ArtistAdminRecord;
  onUpdated: (id: string, patch: Partial<ArtistAdminRecord>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState<string[]>(artist.tags ?? []);
  const [notice, setNotice] = useState<string | null>(null);

  async function request(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error ?? "Modification impossible."));
      return payload as Record<string, unknown>;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Modification impossible.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function patchArtist(patch: Partial<ArtistAdminRecord>) {
    const payload = await request(`/api/admin/artistes/${artist.id}`, patch);
    if (!payload) return;
    onUpdated(artist.id, patch);
    setNotice("Enregistré");
  }

  async function toggleExclusion() {
    if (artist.is_excluded) {
      if (!window.confirm(`Réintégrer ${artist.name} dans les collectes et les compteurs ?`)) return;
      const payload = await request(`/api/admin/artistes/${artist.id}/exclusion`, {
        excluded: false,
        reason: "Réintégration décidée depuis la liste admin.",
      });
      if (!payload) return;
      const state = payload.artist as Partial<ArtistAdminRecord> | undefined;
      onUpdated(artist.id, {
        is_excluded: false,
        is_active: state?.is_active ?? true,
        exclusion_reason: null,
        excluded_at: null,
      });
      setNotice("Réintégré");
      return;
    }

    const reason = window.prompt(
      `Pourquoi exclure définitivement ${artist.name} de toutes les plateformes ?`,
      "Artiste non admissible",
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setNotice("Indiquez une raison d’exclusion.");
      return;
    }
    if (!window.confirm(`${artist.name} sera retiré de toutes les collectes et de tous les compteurs. Confirmer ?`)) return;
    const payload = await request(`/api/admin/artistes/${artist.id}/exclusion`, {
      excluded: true,
      reason,
    });
    if (!payload) return;
    onUpdated(artist.id, {
      is_excluded: true,
      is_active: false,
      exclusion_reason: reason.trim(),
      excluded_at: new Date().toISOString(),
    });
    setNotice("Exclu globalement");
  }

  function toggleRole(role: string) {
    setRoleDraft((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role]);
  }

  async function saveRoles() {
    const artistType = artistTypeFromRoles(roleDraft);
    const payload = await request(`/api/admin/artistes/${artist.id}`, {
      artist_type: artistType,
      tags: roleDraft,
    });
    if (!payload) return;
    onUpdated(artist.id, { artist_type: artistType, tags: roleDraft });
    setRolesOpen(false);
    setNotice("Rôles enregistrés");
  }

  return (
    <div className={styles.quickEdit}>
      <div className={styles.quickEditControls}>
        <label>
          <span>Identité</span>
          <select
            value={artist.haitian_status}
            disabled={busy || artist.is_excluded}
            onChange={(event) => void patchArtist({ haitian_status: event.target.value })}
          >
            <option value="verified_haitian">Haïtien vérifié</option>
            <option value="verified_haitian_diaspora">Diaspora vérifiée</option>
            <option value="verified_haitian_group">Groupe haïtien</option>
            <option value="pending_review">À vérifier</option>
            <option value="insufficient_evidence">Preuves insuffisantes</option>
            <option value="rejected">Non haïtien</option>
          </select>
        </label>
        <label className={styles.publicToggle}>
          <input
            type="checkbox"
            checked={artist.is_active && !artist.is_excluded}
            disabled={busy || artist.is_excluded}
            onChange={(event) => void patchArtist({ is_active: event.target.checked })}
          />
          <span>Afficher public</span>
        </label>
        <button className="btn btn--sm" type="button" disabled={busy || artist.is_excluded} onClick={() => setRolesOpen((open) => !open)}>
          Rôles
        </button>
        <button
          className={`btn btn--sm ${artist.is_excluded ? "btn--ok" : "btn--danger"}`}
          type="button"
          disabled={busy}
          onClick={() => void toggleExclusion()}
        >
          {artist.is_excluded ? "Réintégrer" : "Exclure définitivement"}
        </button>
        <Link className="btn btn--sm btn--ghost" href={`/admin/artistes/${artist.id}`}>Fiche complète</Link>
      </div>

      {rolesOpen ? (
        <div className={styles.roleEditor}>
          {ARTIST_TAGS.map((role) => (
            <label key={role.id}>
              <input type="checkbox" checked={roleDraft.includes(role.id)} onChange={() => toggleRole(role.id)} />
              <span>{role.label}</span>
            </label>
          ))}
          <button className="btn btn--sm btn--primary" type="button" disabled={busy} onClick={() => void saveRoles()}>
            Enregistrer les rôles
          </button>
        </div>
      ) : null}

      {notice ? <span className={notice === "Enregistré" || notice.includes("enregistrés") || notice === "Réintégré" ? styles.quickSuccess : styles.quickNotice}>{notice}</span> : null}
    </div>
  );
}
