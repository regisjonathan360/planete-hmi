import { createClient } from "@/lib/supabase/server";
import { DefiCard } from "@/components/arene/DefiCard";
import { AuthCallToAction } from "@/components/arene/AuthCallToAction";
import styles from "./page.module.css";

/**
 * DefisPage — Page des défis communautaires.
 * Server component qui :
 * - Récupère les défis actifs depuis Supabase
 * - Récupère la progression de l'utilisateur (si authentifié)
 * - Affiche un DefiCard pour chaque défi actif
 *
 * Requirements: 6.3, 6.4
 */
export default async function DefisPage() {
  const supabase = await createClient();

  // Get current user session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // Fetch active challenges
  const { data: challenges } = await supabase
    .from("challenges")
    .select("*")
    .eq("status", "active")
    .order("ends_at", { ascending: true });

  // Fetch user's progress if authenticated
  let progressMap: Record<string, number> = {};
  if (user && challenges && challenges.length > 0) {
    const challengeIds = challenges.map((c) => c.id);
    const { data: completions } = await supabase
      .from("challenge_completions")
      .select("challenge_id, progress")
      .eq("member_id", user.id)
      .in("challenge_id", challengeIds);

    if (completions) {
      progressMap = Object.fromEntries(
        completions.map((c) => [c.challenge_id, c.progress])
      );
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Défis communautaires</h1>

      {!isAuthenticated && <AuthCallToAction />}

      {challenges && challenges.length > 0 ? (
        <div className={styles.defisList}>
          {challenges.map((challenge) => (
            <DefiCard
              key={challenge.id}
              challenge={challenge}
              userProgress={progressMap[challenge.id] ?? 0}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      ) : (
        <p className={styles.emptyMessage}>
          Aucun défi actif pour le moment. Revenez bientôt !
        </p>
      )}
    </div>
  );
}
