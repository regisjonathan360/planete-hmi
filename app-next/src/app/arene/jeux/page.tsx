import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Jeux — Arène Planète HMI",
};

/**
 * JeuxPage — Grille des mini-jeux de l'Arène.
 * Chaque jeu est une carte qui ouvre sa page de jeu.
 * Pour ajouter un jeu : ajouter une entrée au tableau JEUX.
 */
interface Jeu {
  id: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  badge: string;
  meta: string;
}

const JEUX: Jeu[] = [
  {
    id: "solitaire",
    title: "Solitaire",
    tagline: "Le classique Windows 95",
    description:
      "Repose les cartes sur les fondations par couleur, de l'as au roi. Dans l'Arène, les cartes sont illustrées par les artistes : visages des artistes de la planète en pleine carte.",
    href: "/arene/solitaire",
badge: "Disponible",
    meta: "Cartes · Réflexion · Artistes",
  },
];

export default function JeuxPage() {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.pageTitle}>Jeux</h1>
        <p className={styles.pageLead}>
          Des mini-jeux pour défier la communauté. D&apos;autres jeux arrivent bientôt.
        </p>
      </div>

      <div className={styles.jeuxGrid}>
        {JEUX.map((jeu) => (
          <Link
            key={jeu.id}
            href={jeu.href}
            className={styles.jeuCard}
            aria-label={`Jouer à ${jeu.title}`}
          >
            <div className={styles.jeuCard__art} aria-hidden="true">
              <span className={styles.jeuCard__badge}>{jeu.badge}</span>
              <span className={styles.jeuCard__artTitle}>{jeu.title}</span>
              <span className={styles.jeuCard__artTagline}>{jeu.tagline}</span>
            </div>

            <div className={styles.jeuCard__body}>
              <h2 className={styles.jeuCard__title}>{jeu.title}</h2>
              <p className={styles.jeuCard__desc}>{jeu.description}</p>
              <div className={styles.jeuCard__footer}>
                <span className={styles.jeuCard__meta}>{jeu.meta}</span>
                <span className={styles.jeuCard__play}>Jouer →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}