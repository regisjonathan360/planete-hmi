"use client";

import Link from "next/link";
import styles from "./AuthCallToAction.module.css";

/**
 * Appel à l'action affiché aux visiteurs non authentifiés dans l'Arène.
 * Invite l'utilisateur à se connecter pour participer à la communauté.
 */
export function AuthCallToAction() {
  return (
    <div className={styles.container} role="status" aria-label="Connexion requise">
      <p className={styles.message}>
        Connectez-vous pour participer à la communauté
      </p>
      <Link href="/connexion" className={styles.cta}>
        Se connecter
      </Link>
    </div>
  );
}
