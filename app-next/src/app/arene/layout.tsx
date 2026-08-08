import type { Metadata } from "next";
import { Orbitron, Exo_2 } from "next/font/google";
import { AreneTabNav } from "@/components/arene/AreneTabNav";
import { MurActivite } from "@/components/arene/MurActivite";
import { RealtimeProvider } from "@/components/arene/RealtimeProvider";
import styles from "./layout.module.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-arene-display",
  weight: ["400", "700", "900"],
});

const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-arene-body",
});

export const metadata: Metadata = {
  title: "Arène — Planète HMI",
};

/**
 * Layout de l'Arène communautaire.
 *
 * - Les couches cosmiques (StageLightsBackground + ShootingStars) sont rendues
 *   par le root layout et respectent automatiquement prefers-reduced-motion.
 * - Un scrim supplémentaire assure la lisibilité sur ce fond.
 * - AreneTabNav fournit la navigation par onglets (battles, défis, discussions, classement).
 * - Le MurActivite est affiché en sidebar sur desktop (≥768px), masqué sur mobile.
 * - Le contenu interactif est enveloppé dans RealtimeProvider pour les mises à jour temps réel.
 */
export default function AreneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.arene} ${orbitron.variable} ${exo2.variable}`}>
      {/* Scrim de lisibilité propre à l'Arène */}
      <div className={styles.areneScrim} aria-hidden="true" />

      <div className={styles.areneContent}>
        {/* Header avec titre et bouton retour */}
        <header className={styles.areneHeader}>
          <a href="/" className={styles.areneBackBtn} aria-label="Retour à l'accueil">
            ←
          </a>
          <div>
            <h1 className={styles.areneTitle}>Arène</h1>
            <p className={styles.areneSubtitle}>Interagis avec la communauté</p>
          </div>
        </header>

        {/* Navigation par onglets */}
        <AreneTabNav />

        {/* Corps : contenu principal + sidebar */}
        <RealtimeProvider>
          <div className={styles.areneBody}>
            <main className={styles.areneMain}>{children}</main>

            {/* Sidebar desktop — mur d'activité */}
            <div className={styles.areneSidebar}>
              <MurActivite />
            </div>
          </div>
        </RealtimeProvider>
      </div>
    </div>
  );
}
