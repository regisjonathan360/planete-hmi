"use client";

/**
 * BattleHistory — Historique paginé des battles terminées.
 * Client component avec pagination côté client (charge 20 par page).
 *
 * Requirements: 5.8
 */

import { useCallback, useState } from "react";
import { VoteProgressBar } from "@/components/arene/VoteProgressBar";
import styles from "./page.module.css";

interface EndedBattle {
  id: string;
  title: string;
  description?: string;
  side_a_label: string;
  side_b_label: string;
  votes_a: number;
  votes_b: number;
  ends_at: string;
  winner?: string | null;
}

interface BattleHistoryProps {
  initialBattles: EndedBattle[];
  totalCount: number;
}

const PAGE_SIZE = 20;

export function BattleHistory({ initialBattles, totalCount }: BattleHistoryProps) {
  const [battles, setBattles] = useState<EndedBattle[]>(initialBattles);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const loadPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: "ended",
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/arene/battles?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBattles(data.battles ?? []);
        setPage(pageNum);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  if (battles.length === 0 && totalCount === 0) {
    return (
      <p className={styles.emptyMessage}>
        Aucune battle terminée pour le moment.
      </p>
    );
  }

  const getWinnerLabel = (battle: EndedBattle): string => {
    if (battle.winner === "tie") return "Égalité";
    if (battle.winner === "side_a") return `Vainqueur : ${battle.side_a_label}`;
    if (battle.winner === "side_b") return `Vainqueur : ${battle.side_b_label}`;
    // Determine from votes if winner field not set
    if (battle.votes_a > battle.votes_b) return `Vainqueur : ${battle.side_a_label}`;
    if (battle.votes_b > battle.votes_a) return `Vainqueur : ${battle.side_b_label}`;
    return "Égalité";
  };

  const isTie = (battle: EndedBattle): boolean => {
    if (battle.winner === "tie") return true;
    if (!battle.winner) return battle.votes_a === battle.votes_b;
    return false;
  };

  return (
    <div className={styles.battlesList} aria-label="Historique des battles" role="list">
      {loading && (
        <p className={styles.emptyMessage} role="status">
          Chargement…
        </p>
      )}

      {!loading &&
        battles.map((battle) => (
          <article key={battle.id} role="listitem" aria-label={`Battle terminée : ${battle.title}`}>
            <div style={{ padding: "1rem", borderRadius: "12px", border: "1px solid rgba(244, 239, 228, 0.08)", background: "rgba(244, 239, 228, 0.02)" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--cream, #f4efe4)", margin: "0 0 0.25rem" }}>
                {battle.title}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--cream-dim, #b9b2a4)", margin: "0 0 0.5rem" }}>
                {battle.side_a_label} vs {battle.side_b_label}
              </p>
              <VoteProgressBar votesA={battle.votes_a} votesB={battle.votes_b} animated={false} />
              <span className={`${styles.winnerBadge}${isTie(battle) ? ` ${styles.winnerTie}` : ""}`}>
                {getWinnerLabel(battle)}
              </span>
            </div>
          </article>
        ))}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Pagination de l'historique des battles">
          <button
            type="button"
            className={styles.paginationBtn}
            onClick={() => loadPage(page - 1)}
            disabled={page <= 1 || loading}
            aria-label="Page précédente"
          >
            ← Précédent
          </button>
          <span className={styles.paginationInfo}>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.paginationBtn}
            onClick={() => loadPage(page + 1)}
            disabled={page >= totalPages || loading}
            aria-label="Page suivante"
          >
            Suivant →
          </button>
        </nav>
      )}
    </div>
  );
}
