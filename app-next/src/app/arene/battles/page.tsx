import { createClient } from "@/lib/supabase/server";
import { BattleCard } from "@/components/arene/BattleCard";
import { AuthCallToAction } from "@/components/arene/AuthCallToAction";
import { BattleHistory } from "./BattleHistory";
import styles from "./page.module.css";

/**
 * BattlesPage — Page des battles communautaires.
 * Server component qui :
 * - Récupère les battles actives depuis Supabase
 * - Détermine le vote de l'utilisateur courant (si authentifié)
 * - Affiche un BattleCard pour chaque battle active
 * - Affiche un BattleHistory (battles terminées paginées, 20/page)
 * - Montre un AuthCallToAction si non authentifié
 *
 * Requirements: 5.2, 5.8, 5.9
 */
export default async function BattlesPage() {
  const supabase = await createClient();

  // Get current user session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // Fetch active battles
  const { data: activeBattles } = await supabase
    .from("battles")
    .select("*")
    .eq("status", "active")
    .order("starts_at", { ascending: false });

  // Fetch user's votes for active battles (if authenticated)
  let userVotesMap: Record<string, "side_a" | "side_b"> = {};
  if (user && activeBattles && activeBattles.length > 0) {
    const battleIds = activeBattles.map((b) => b.id);
    const { data: votes } = await supabase
      .from("battle_votes")
      .select("battle_id, side")
      .eq("member_id", user.id)
      .in("battle_id", battleIds);

    if (votes) {
      userVotesMap = Object.fromEntries(
        votes.map((v) => [v.battle_id, v.side as "side_a" | "side_b"])
      );
    }
  }

  // Fetch first page of ended battles for history
  const { data: endedBattles, count: endedCount } = await supabase
    .from("battles")
    .select("*", { count: "exact" })
    .eq("status", "ended")
    .order("ends_at", { ascending: false })
    .range(0, 19);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Battles</h1>

      {/* Auth call to action for unauthenticated users */}
      {!isAuthenticated && <AuthCallToAction />}

      {/* Active battles */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Battles en cours</h2>
        {activeBattles && activeBattles.length > 0 ? (
          <div className={styles.battlesList}>
            {activeBattles.map((battle) => (
              <BattleCard
                key={battle.id}
                battle={battle}
                userVote={userVotesMap[battle.id] ?? null}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        ) : (
          <p className={styles.emptyMessage}>
            Aucune battle en cours pour le moment.
          </p>
        )}
      </section>

      {/* Battle history (ended battles) */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Historique des battles</h2>
        <BattleHistory
          initialBattles={endedBattles ?? []}
          totalCount={endedCount ?? 0}
        />
      </section>
    </div>
  );
}
