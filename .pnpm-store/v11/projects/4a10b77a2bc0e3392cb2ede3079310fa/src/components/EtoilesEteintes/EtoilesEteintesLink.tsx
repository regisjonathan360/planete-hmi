import Link from "next/link";
import { AngelWingsDecor, angelWingsHostClass } from "./AngelWings";
import styles from "./etoiles-eteintes-link.module.css";

export const ETOILES_ETEINTES_HREF = "/artistes/etoiles-eteintes";

interface EtoilesEteintesLinkProps {
  /** Nombre d'artistes en mémoire, affiché en pastille. */
  count?: number;
  /** Marque l'entrée comme active (page courante). */
  active?: boolean;
}

/**
 * Entrée de la colonne de gauche menant à l'hommage aux artistes disparus.
 * Deux ailes d'ange sortent de derrière le libellé et battent en continu ;
 * elles se replient au survol. L'auréole flotte au-dessus.
 */
export function EtoilesEteintesLink({ count, active = false }: EtoilesEteintesLinkProps) {
  return (
    <Link
      href={ETOILES_ETEINTES_HREF}
      className={`${styles.link} ${angelWingsHostClass}`}
      aria-current={active ? "page" : undefined}
      aria-label={
        count != null
          ? `Étoiles éteintes — hommage à ${count} artiste${count > 1 ? "s" : ""} disparu${count > 1 ? "s" : ""}`
          : "Étoiles éteintes — hommage aux artistes disparus"
      }
      data-active={active ? "" : undefined}
    >
      <AngelWingsDecor idPrefix="sidebar-wing" />

      <span className={styles.body}>
        <span className={styles.title}>
          <span>Étoiles</span>
          <span>Éteintes</span>
        </span>
        <span className={styles.sub}>
          Hommage aux artistes disparus
          {count != null && count > 0 && <span className={styles.count}>{count}</span>}
        </span>
      </span>
    </Link>
  );
}
