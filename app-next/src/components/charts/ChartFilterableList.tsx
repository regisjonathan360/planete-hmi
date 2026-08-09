"use client";

import { useState, useMemo } from "react";
import { ChartEntryView } from "@/lib/charts/queries/types";
import { ChartTop20Table } from "./ChartTop20Table";

interface Props {
  entries: ChartEntryView[];
  platform: string;
  initialCount?: number;
}

export function ChartFilterableList({ entries, platform, initialCount = 20 }: Props) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Reset visible count when search changes.
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

    return result;
  }, [entries, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

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
          placeholder={platform === "youtube" ? "Rechercher une vidéo ou une chaîne…" : "Rechercher une chanson ou un artiste…"}
          aria-label="Rechercher dans le classement"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisibleCount(initialCount); }}
        />
      </div>

      {/* Liste */}
      <ChartTop20Table entries={visible} platform={platform} />

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
        {filtered.length} {platform === "youtube" ? "vidéo(s)" : "chanson(s)"} cette semaine.
      </p>
    </>
  );
}
