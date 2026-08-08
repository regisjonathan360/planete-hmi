"use client";

/**
 * Mur d'activité — flux chronologique des interactions récentes de la communauté.
 *
 * - Affiche les activités groupées avec dates relatives
 * - S'abonne à Supabase Realtime pour les nouvelles entrées (animation d'insertion)
 * - Bouton « Voir plus » pour charger 30 éléments supplémentaires
 * - Mode sidebar (desktop, sticky) ou pleine largeur (mobile/standalone)
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.2
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "./RealtimeProvider";
import { NiveauBadge } from "./NiveauBadge";
import { formatRelativeDate } from "@/lib/arene/date-utils";
import type { Niveau } from "@/lib/arene/levels";
import styles from "./MurActivite.module.css";

// --- Types ---

export interface MurActiviteProps {
  /** Mode d'affichage : sidebar (desktop) ou pleine largeur */
  mode?: "sidebar" | "fullwidth";
}

interface DisplayItem {
  id: string;
  type: string;
  actorPseudo: string;
  actorNiveau: Niveau;
  targetLabel: string;
  targetUrl?: string;
  createdAt: string;
  formattedDate: string;
  groupCount: number;
  isNew?: boolean;
}

// --- Activity type labels ---

const TYPE_LABELS: Record<string, string> = {
  reaction: "a réagi à",
  comment: "a commenté",
  vote: "a voté dans",
  badge_earned: "a obtenu le badge",
  new_member: "a rejoint la communauté",
  new_chart: "Nouveau classement :",
  challenge_complete: "a complété le défi",
};

const TYPE_LABELS_GROUPED: Record<string, string> = {
  reaction: "membres ont réagi à",
  comment: "membres ont commenté",
  vote: "membres ont voté dans",
};

/** Page size for API calls (Requirement 9.3: 30 items) */
const PAGE_SIZE = 30;

// --- Component ---

export function MurActivite({ mode = "sidebar" }: MurActiviteProps) {
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const newItemIds = useRef<Set<string>>(new Set());

  const { subscribe, connectionStatus } = useRealtime();

  // --- Initial fetch ---
  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      try {
        const res = await fetch(`/api/arene/activity?page=1&pageSize=${PAGE_SIZE}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const displayItems = mapToDisplayItems(data.items ?? []);
        setItems(displayItems);
        setHasMore((data.pagination?.totalPages ?? 1) > 1);
      } catch {
        // silently fail — show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitial();
    return () => { cancelled = true; };
  }, []);

  // --- Realtime subscription for new activity ---
  useEffect(() => {
    const unsub = subscribe(
      "activity_feed_mur",
      "INSERT",
      (payload: unknown) => {
        const record = payload as { new?: Record<string, unknown> };
        if (!record.new) return;

        // Fetch the latest item from API to get full joined data
        fetchLatestItem();
      }
    );

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  // --- Fetch latest and prepend ---
  const fetchLatestItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/arene/activity?page=1&pageSize=1`);
      if (!res.ok) return;
      const data = await res.json();
      const newItems: DisplayItem[] = mapToDisplayItems(data.items ?? []);

      if (newItems.length > 0) {
        const newItem = { ...newItems[0], isNew: true };
        newItemIds.current.add(newItem.id);

        setItems((prev) => {
          // Avoid duplicates
          const exists = prev.some((p) => p.id === newItem.id);
          if (exists) return prev;
          return [newItem, ...prev];
        });

        // Remove "new" flag after animation completes
        setTimeout(() => {
          newItemIds.current.delete(newItem.id);
          setItems((prev) =>
            prev.map((item) =>
              item.id === newItem.id ? { ...item, isNew: false } : item
            )
          );
        }, 350);
      }
    } catch {
      // silently fail
    }
  }, []);

  // --- "Voir plus" handler ---
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const nextPage = page + 1;
    try {
      const res = await fetch(
        `/api/arene/activity?page=${nextPage}&pageSize=${PAGE_SIZE}`
      );
      if (!res.ok) return;
      const data = await res.json();

      const moreItems = mapToDisplayItems(data.items ?? []);
      setItems((prev) => [...prev, ...moreItems]);
      setPage(nextPage);
      setHasMore(nextPage < (data.pagination?.totalPages ?? 1));
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

  // --- Render ---

  const containerClass = [
    styles.murActivite,
    mode === "fullwidth" ? styles.fullwidth : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={containerClass} aria-label="Activité récente de la communauté">
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Activité récente</h2>
        {connectionStatus !== "connected" && (
          <span
            className={styles.connectionBadge}
            data-status={connectionStatus}
            role="status"
            aria-live="polite"
          >
            {connectionStatus === "reconnecting" ? "Reconnexion…" : "Hors ligne"}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <p className={styles.empty} role="status" aria-live="polite">
          Chargement…
        </p>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <p className={styles.empty}>Aucune activité pour le moment.</p>
      )}

      {/* Activity list */}
      {!loading && items.length > 0 && (
        <div className={styles.list} role="feed" aria-label="Flux d'activité">
          {items.map((item) => (
            <article
              key={item.id}
              className={`${styles.item}${item.isNew ? ` ${styles.itemNew}` : ""}`}
              aria-label={buildAriaLabel(item)}
            >
              <div className={styles.itemHeader}>
                {item.groupCount > 1 ? (
                  <span className={styles.groupCount}>
                    {item.groupCount}{" "}
                    {TYPE_LABELS_GROUPED[item.type] ?? "membres"}
                  </span>
                ) : (
                  <>
                    <span className={styles.actorPseudo}>
                      {item.actorPseudo}
                    </span>
                    <NiveauBadge niveau={item.actorNiveau} size="sm" />
                  </>
                )}
              </div>

              <div className={styles.itemBody}>
                {item.groupCount <= 1 && (
                  <span>{TYPE_LABELS[item.type] ?? "a interagi avec"} </span>
                )}
                {item.targetUrl ? (
                  <a href={item.targetUrl} className={styles.targetLink}>
                    {item.targetLabel}
                  </a>
                ) : (
                  <span>{item.targetLabel}</span>
                )}
              </div>

              <time className={styles.itemDate} dateTime={item.createdAt}>
                {item.formattedDate}
              </time>
            </article>
          ))}
        </div>
      )}

      {/* Voir plus button */}
      {!loading && hasMore && (
        <button
          type="button"
          className={styles.voirPlus}
          onClick={handleLoadMore}
          disabled={loadingMore}
          aria-label="Charger plus d'activités"
        >
          {loadingMore ? "Chargement…" : "Voir plus"}
        </button>
      )}
    </aside>
  );
}

// --- Helpers ---

function mapToDisplayItems(
  grouped: Array<{
    id: string;
    type: string;
    actorPseudo: string;
    actorNiveau: string;
    targetLabel: string;
    targetUrl?: string;
    createdAt: string;
    formattedDate?: string;
    groupCount?: number;
  }>
): DisplayItem[] {
  return grouped.map((item) => ({
    id: item.id,
    type: item.type,
    actorPseudo: item.actorPseudo,
    actorNiveau: (item.actorNiveau || "etoile") as Niveau,
    targetLabel: item.targetLabel,
    targetUrl: item.targetUrl,
    createdAt: item.createdAt,
    formattedDate: item.formattedDate ?? formatRelativeDate(item.createdAt),
    groupCount: item.groupCount ?? 1,
    isNew: false,
  }));
}

function buildAriaLabel(item: DisplayItem): string {
  if (item.groupCount > 1) {
    return `${item.groupCount} membres ont interagi avec ${item.targetLabel}, ${item.formattedDate}`;
  }
  return `${item.actorPseudo}, ${TYPE_LABELS[item.type] ?? "a interagi avec"} ${item.targetLabel}, ${item.formattedDate}`;
}
