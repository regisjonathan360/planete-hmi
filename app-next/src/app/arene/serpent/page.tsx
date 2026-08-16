import type { Metadata } from "next";
import { SnakeGameLoader } from "@/components/arena/SnakeGameLoader";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "HMI Snake — Arène Planète HMI",
};

/**
 * SerpentPage — Jeu « Koulèv » de l'Arène.
 * Arcade en 3D inspirée du genre Snake (arène planétaire, glisser pour jouer,
 * grandir en mangeant les gemmes). Se joue en plein écran, optimisée mobile.
 */
export default function SerpentPage() {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.pageTitle}>HMI Snake</h1>
          <p className={styles.pageLead}>
            HMI Snake : dévore les gemmes et deviens le serpent le plus long de
            la planète. Pilote à la souris (desktop) ou
            au joystick (mobile) et repère la nourriture grâce au minimap. Le
            jeu s&apos;ouvre en plein écran.
          </p>
        </div>
      </div>

      <SnakeGameLoader />
    </div>
  );
}
