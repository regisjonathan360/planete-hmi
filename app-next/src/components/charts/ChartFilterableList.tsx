"use client";

import { useState, useMemo } from "react";
import { ChartEntryView } from "@/lib/charts/queries/types";
import { ChartTop20Table } from "./ChartTop20Table";

const GENRE_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "konpa", label: "Konpa" },
  { id: "raboday", label: "Raboday" },
  { id: "hip-hop-rap", label: "Hip-Hop/Rap" },
  { id: "afrosounds", label: "Afrosounds" },
  { id: "dancehall", label: "Dancehall" },
  { id: "pop", label: "Pop" },
  { id: "r-b", label: "R&B" },
  { id: "latin", label: "Latin" },
  { id: "caribbean", label: "Caribbean" },
  { id: "gospel", label: "Gospel" },
  { id: "electronic", label: "Electronic" },
  { id: "rock", label: "Rock" },
  { id: "jazz-blues", label: "Jazz/Blues" },
];

interface Props {
  entries: ChartEntryView[];
  platform: string;
  initialCount?: number;
}

export function ChartFilterableList({ entries, platform, initialCount = 20 }: Props) {
  const [genre, setGenre] = useState("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Reset visible count when filters change.
  const filtered = useMemo(() => {
    let result = entries;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.track_title.toLowerCase().includes(q) ||
          (e.artists_text ?? "").toLowerCase().includes(q)
      );
    }

    // Genre filter — pour l'instant pas de champ genre dans ChartEntryView,
    // donc on ne filtre pas par genre. Les filtres servent de repère visuel
    // pour quand l'admin aura attribué les genres et qu'ils seront publiés.

    return result;
  }, [entries, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Show genre tabs only for audiomack
  const showGenres = platform === "audiomack";

  return (
    <>
      {/* Barre de recherche */}
      <div className="chart-search">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2"/>
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          type="search"
          placeholder="Rechercher une chanson ou un artiste…"
          aria-label="Rechercher dans le classement"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisibleCount(initialCount); }}
        />
      </div>

      {/* Filtres genre */}
      {showGenres && (
        <nav className="genre-tabs" aria-label="Filtrer par genre">
          {GENRE_FILTERS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={genre === g.id ? "genre-tabs__item is-active" : "genre-tabs__item"}
              onClick={() => { setGenre(g.id); setVisibleCount(initialCount); }}
            >
              {g.label}
            </button>
          ))}
        </nav>
      )}

      {/* Liste */}
      <ChartTop20Table entries={visible} />

      {hasMore && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            className="hmi__btn-voir-plus"
            onClick={() => setVisibleCount((c) => Math.min(c + 20, filtered.length))}
          >
            Voir plus ({filtered.length - visibleCount} restant{filtered.length - visibleCount > 1 ? "s" : ""})
          </button>
        </div>
      )}

      <p className="row__ctx" style={{ marginTop: "0.75rem" }}>
        {filtered.length} chanson(s) {genre !== "all" ? `(${genre})` : ""} cette semaine.
      </p>
    </>
  );
}
