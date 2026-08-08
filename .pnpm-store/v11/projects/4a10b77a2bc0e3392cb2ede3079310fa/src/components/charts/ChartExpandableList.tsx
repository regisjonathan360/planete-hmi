"use client";

import { useState } from "react";
import { ChartEntryView } from "@/lib/charts/queries/types";
import { ChartTop20Table } from "./ChartTop20Table";

/**
 * Affiche une liste de classement avec un bouton "Voir plus" qui révèle
 * les entrées au-delà du nombre initial.
 */
export function ChartExpandableList({
  entries,
  initialCount = 20,
  step = 20,
}: {
  entries: ChartEntryView[];
  initialCount?: number;
  step?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const visibleEntries = entries.slice(0, visibleCount);
  const hasMore = visibleCount < entries.length;

  return (
    <>
      <ChartTop20Table entries={visibleEntries} />
      {hasMore && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            className="hmi__btn-voir-plus"
            onClick={() => setVisibleCount((c) => Math.min(c + step, entries.length))}
          >
            Voir plus ({entries.length - visibleCount} restant{entries.length - visibleCount > 1 ? "s" : ""})
          </button>
        </div>
      )}
    </>
  );
}
