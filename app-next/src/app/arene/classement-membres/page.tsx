import { createClient } from "@/lib/supabase/server";
import { NiveauBadge } from "@/components/arene/NiveauBadge";
import type { Niveau } from "@/lib/arene/levels";
import styles from "./page.module.css";

/**
 * ClassementPage — Classement des membres par Points Cosmiques.
 * Server component qui :
 * - Récupère le top 50 depuis la vue matérialisée leaderboard_cache
 *   (ou directement depuis community_profiles si la vue n'existe pas)
 * - Met en évidence la ligne de l'utilisateur courant
 *
 * Requirements: 7.3, 13.4
 */

interface LeaderboardEntry {
  rank: number;
  member_id: string;
  pseudo: string;
  avatar_url: string | null;
  niveau: Niveau;
  points_cosmiques: number;
}

export default async function ClassementPage() {
  const supabase = await createClient();

  // Get current user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Try fetching from the leaderboard API/cache view first
  let leaderboard: LeaderboardEntry[] = [];

  // Try materialized view
  const { data: cacheData, error: cacheError } = await supabase
    .from("leaderboard_cache")
    .select("*")
    .order("rank", { ascending: true })
    .limit(50);

  if (!cacheError && cacheData && cacheData.length > 0) {
    leaderboard = cacheData as LeaderboardEntry[];
  } else {
    // Fallback: direct query on community_profiles
    const { data: profiles } = await supabase
      .from("community_profiles")
      .select("member_id, pseudo, avatar_url, niveau, points_cosmiques")
      .order("points_cosmiques", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);

    if (profiles) {
      leaderboard = profiles.map((p, index) => ({
        rank: index + 1,
        member_id: p.member_id,
        pseudo: p.pseudo,
        avatar_url: p.avatar_url,
        niveau: p.niveau as Niveau,
        points_cosmiques: p.points_cosmiques,
      }));
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Classement des membres</h1>
      <p className={styles.subtitle}>
        Top 50 — classé par Points Cosmiques
      </p>

      {leaderboard.length === 0 ? (
        <p className={styles.emptyMessage}>
          Aucun membre classé pour le moment.
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label="Classement des membres">
            <thead>
              <tr className={styles.tableHeadRow}>
                <th className={styles.thRank} scope="col">#</th>
                <th className={styles.thMember} scope="col">Membre</th>
                <th className={styles.thNiveau} scope="col">Niveau</th>
                <th className={styles.thPoints} scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => {
                const isCurrentUser = user?.id === entry.member_id;
                return (
                  <tr
                    key={entry.member_id}
                    className={`${styles.row}${isCurrentUser ? ` ${styles.rowHighlighted}` : ""}`}
                    aria-current={isCurrentUser ? "true" : undefined}
                  >
                    <td className={styles.cellRank}>
                      <span className={`${styles.rank}${entry.rank <= 3 ? ` ${styles.rankTop}` : ""}`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className={styles.cellMember}>
                      <div className={styles.memberInfo}>
                        <div className={styles.avatar}>
                          {entry.avatar_url ? (
                            <img
                              src={entry.avatar_url}
                              alt=""
                              className={styles.avatarImg}
                              loading="lazy"
                            />
                          ) : (
                            <span className={styles.avatarPlaceholder} aria-hidden="true">
                              {entry.pseudo.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className={styles.pseudo}>{entry.pseudo}</span>
                      </div>
                    </td>
                    <td className={styles.cellNiveau}>
                      <NiveauBadge niveau={entry.niveau} size="sm" />
                    </td>
                    <td className={styles.cellPoints}>
                      {entry.points_cosmiques.toLocaleString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
