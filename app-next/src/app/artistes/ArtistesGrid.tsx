"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useMemo, useCallback, useEffect } from "react";
import { ARTIST_TAGS, getTagMeta } from "@/lib/artists/tags";
import { artistAvatarSrc } from "@/lib/artists/avatar";
import { FavoriteButton } from "@/components/FavoriteButton";
import SphereImageGrid from "@/components/ui/img-sphere";
import type { PublicArtist } from "./page";

type ViewMode = "sphere" | "grid";

/** Genres disponibles pour le filtre (dérivés des chart_entries). */
const GENRE_FILTERS = [
  { id: "all", label: "Tous les genres", icon: "🎵" },
  { id: "konpa", label: "Konpa", icon: "🪘" },
  { id: "raboday", label: "Raboday", icon: "🔥" },
  { id: "hip-hop-rap", label: "Hip-Hop/Rap", icon: "🎙️" },
  { id: "afrosounds", label: "Afrosounds", icon: "🌍" },
  { id: "dancehall", label: "Dancehall", icon: "💃" },
  { id: "pop", label: "Pop", icon: "✨" },
  { id: "r-b", label: "R&B", icon: "💜" },
  { id: "latin", label: "Latin", icon: "🎺" },
  { id: "caribbean", label: "Caribbean", icon: "🏝️" },
  { id: "gospel", label: "Gospel", icon: "🙏" },
  { id: "electronic", label: "Electronic", icon: "⚡" },
  { id: "rock", label: "Rock", icon: "🎸" },
  { id: "jazz-blues", label: "Jazz/Blues", icon: "🎷" },
];

type SortMode = "name" | "ranking";
type FilterTag = string;

export function ArtistesGrid({
  artists,
  showProductionCount = false,
}: {
  artists: PublicArtist[];
  /** Affiche le nombre de titres produits (vue Producteurs / Beatmakers). */
  showProductionCount?: boolean;
}) {
  const [roleFilter, setRoleFilter] = useState<FilterTag>("all");
  const [genreFilter, setGenreFilter] = useState<FilterTag>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "m" | "f" | "g" | "o">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("sphere");
  const [sphereSize, setSphereSize] = useState(500);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setSphereSize(w < 640 ? w - 32 : w < 1024 ? 520 : 620);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const filtered = useMemo(() => {
    let result = artists;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      // Le slug (normalisé : minuscules, sans accents, tirets) doit aussi
      // permettre de retrouver l'artiste — ex. « michael-brun ».
      const qSlug = q
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (qSlug.length > 0 && a.slug.toLowerCase().includes(qSlug))
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((a) => a.tags.includes(roleFilter));
    }

    if (genreFilter !== "all") {
      result = result.filter((a) => a.genres.includes(genreFilter));
    }

    if (genderFilter !== "all") {
      result = result.filter((a) => a.gender === genderFilter);
    }

    // Tri
    if (sort === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    } else {
      // Par classement : meilleure position d'abord, artistes sans position à la fin
      result = [...result].sort((a, b) => {
        if (a.bestPosition == null && b.bestPosition == null) return 0;
        if (a.bestPosition == null) return 1;
        if (b.bestPosition == null) return -1;
        return a.bestPosition - b.bestPosition;
      });
    }

    return result;
  }, [artists, search, roleFilter, genreFilter, genderFilter, sort]);

  const sphereImages = useMemo(
    () =>
      filtered.map((a) => ({
        id: a.id,
        src: artistAvatarSrc(a.imageUrl),
        alt: a.name,
        title: a.name,
        description: a.tags.length > 0 ? a.tags.join(", ") : undefined,
      })),
    [filtered]
  );

  const handleSphereClick = useCallback(
    (img: { id: string; title?: string }) => {
      const artist = filtered.find((a) => a.id === img.id);
      if (artist) window.location.href = `/artistes/${artist.slug}`;
    },
    [filtered]
  );

  return (
    <>
      {/* Barre de recherche + tri */}
      <div className="artistes-toolbar">
        <div className="artistes-search">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            placeholder="Rechercher un artiste…"
            aria-label="Rechercher un artiste"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="artistes-sort"
          aria-label="Trier par"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
          <option value="name">Nom (A→Z)</option>
          <option value="ranking">Classement</option>
        </select>
        <button
          type="button"
          className="artistes-view-toggle"
          aria-label={viewMode === "sphere" ? "Passer à la grille" : "Passer à la sphère"}
          onClick={() => setViewMode(viewMode === "sphere" ? "grid" : "sphere")}
          title={viewMode === "sphere" ? "Vue grille" : "Vue sphère"}
        >
          {viewMode === "sphere" ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <ellipse cx="12" cy="12" rx="10" ry="4" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
          )}
        </button>
      </div>

      {/* Filtre par rôle */}
      <nav className="artistes-filters" aria-label="Filtrer par rôle">
        <button
          type="button"
          className={roleFilter === "all" ? "filter-btn is-active" : "filter-btn"}
          onClick={() => setRoleFilter("all")}
        >
          Tous les rôles
        </button>
        {ARTIST_TAGS.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={roleFilter === tag.id ? "filter-btn is-active" : "filter-btn"}
            onClick={() => setRoleFilter(tag.id)}
            style={{
              "--tag-color": tag.color,
              "--tag-bg": tag.bgColor,
            } as React.CSSProperties}
          >
            {tag.icon} {tag.label}
          </button>
        ))}
      </nav>

      {/* Filtre par genre (2e rangée) */}
      <nav className="artistes-filters" aria-label="Filtrer par genre">
        {GENRE_FILTERS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={genreFilter === g.id ? "filter-btn is-active" : "filter-btn"}
            onClick={() => setGenreFilter(g.id)}
          >
            {g.icon} {g.label}
          </button>
        ))}
      </nav>

      {/* Filtre par sexe / Type de profil (3e rangée) */}
      <nav className="artistes-filters" aria-label="Filtrer par sexe ou type de profil">
        {[
          { id: "all", label: "Tous les profils" },
          { id: "m", label: "♂ Masculin" },
          { id: "f", label: "♀ Féminin" },
          { id: "g", label: "👥 Groupes" },
          { id: "o", label: "⚧ Autres" },
        ].map((gender) => (
          <button
            key={gender.id}
            type="button"
            className={genderFilter === gender.id ? "filter-btn is-active" : "filter-btn"}
            onClick={() => setGenderFilter(gender.id as typeof genderFilter)}
          >
            {gender.label}
          </button>
        ))}
      </nav>

      {/* Vue sphère (par défaut) */}
      {viewMode === "sphere" && (
        <section className="section section--tight artistes-sphere-section" aria-label="Sphère d'artistes">
          {filtered.length === 0 && (
            <p className="artistes-empty">Aucun artiste trouvé pour ces critères.</p>
          )}
          {filtered.length > 0 && (
            <SphereImageGrid
              images={sphereImages}
              containerSize={sphereSize}
              sphereRadius={sphereSize * 0.38}
              dragSensitivity={0.6}
              momentumDecay={0.95}
              maxRotationSpeed={5}
              baseImageScale={0.14}
              perspective={1000}
              autoRotate={true}
              autoRotateSpeed={0.15}
              onImageClick={handleSphereClick}
            />
          )}
        </section>
      )}

      {/* Vue grille classique */}
      {viewMode === "grid" && (
      <section className="section section--tight" aria-label="Liste des artistes">
        <div className="artistes-grid">
          {filtered.length === 0 && (
            <p className="artistes-empty">Aucun artiste trouvé pour ces critères.</p>
          )}
          {filtered.map((artist) => (
            <a key={artist.id} href={`/artistes/${artist.slug}`} className="artist-card" style={{ textDecoration: "none" }}>
              <FavoriteButton artistId={artist.id} />
              <img
                className="artist-card__img"
                src={artistAvatarSrc(artist.imageUrl)}
                alt={artist.name}
                loading="lazy"
                width={120}
                height={120}
              />
              <div className="artist-card__info">
                <h3 className="artist-card__name">{artist.name}</h3>
                {showProductionCount && (
                  <p className="artist-card__meta">
                    {artist.productionCount ?? 0} titre
                    {(artist.productionCount ?? 0) > 1 ? "s" : ""} produit
                    {(artist.productionCount ?? 0) > 1 ? "s" : ""}
                  </p>
                )}
                {artist.tags.length > 0 && (
                  <div className="artist-card__tags">
                    {artist.tags.map((t) => {
                      const meta = getTagMeta(t);
                      if (!meta) return null;
                      return (
                        <span
                          key={t}
                          className="artist-tag"
                          style={{ color: meta.color, background: meta.bgColor }}
                        >
                          {meta.icon} {meta.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                {artist.genres.length > 0 && (
                  <div className="artist-card__tags">
                    {artist.genres.map((g) => (
                      <span key={g} className="artist-tag artist-tag--genre">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>
      )}
    </>
  );
}
