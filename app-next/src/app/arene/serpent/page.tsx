import type { Metadata } from "next";
import { SnakeGameLoader } from "@/components/arena/SnakeGameLoader";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "HMI Snake — Arène Planète HMI",
};

/**
 * SerpentPage — Jeu « Koulèv » de l'Arène.
 * Arcade Phaser 2D inspirée du genre Snake, optimisée pour le clavier, la
 * souris et le joystick mobile.
 */
export default function SerpentPage() {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.pageTitle}>HMI Snake</h1>
          <p className={styles.pageLead}>
            HMI Snake : mange les logos musicaux et les flammes, grandis,
            accélère et dépose des déjections toxiques pour faire rétrécir tes
            adversaires. Pilote à la souris, au clavier ou au joystick mobile.
          </p>
        </div>
      </div>

      <SnakeGameLoader />
    </div>
  );
}
