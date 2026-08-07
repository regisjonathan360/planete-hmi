import {
  COVERTS,
  PRIMARIES,
  SCAPULAR,
  SECONDARIES,
  WING_VIEWBOX,
  type Feather,
} from "./angel-wing-geometry";
import styles from "./angel-wings.module.css";

/**
 * Classe à poser sur l'élément survolable (lien, en-tête…) : c'est elle qui
 * déclenche le pliage des ailes au `:hover` / `:focus-visible`.
 */
export const angelWingsHostClass = styles.host;

interface AngelWingProps {
  /** Préfixe unique : évite les collisions d'`id` de dégradés entre instances. */
  idPrefix: string;
}

function FeatherRow({ row, name }: { row: Feather[]; name: string }) {
  return (
    // Deux niveaux : l'extérieur gère le pliage (transition), l'intérieur
    // l'ondulation du battement (animation). Ils ne se marchent pas dessus.
    <g data-wing-row={name}>
      <g data-wing-ripple="">
        {row.map((feather, i) => (
          <path key={i} d={feather.d} className={styles.plume} />
        ))}
        {row.map((feather, i) => (
          <path key={`s${i}`} d={feather.shaft} className={styles.shaft} />
        ))}
      </g>
    </g>
  );
}

/** Une aile, pointée vers la gauche. Le côté droit est un miroir CSS. */
function AngelWing({ idPrefix }: AngelWingProps) {
  const plumeGrad = `${idPrefix}-plume`;

  return (
    <svg
      viewBox={WING_VIEWBOX}
      className={styles.svg}
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={plumeGrad} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#f4efe4" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <g style={{ fill: `url(#${plumeGrad})` }}>
        <FeatherRow row={PRIMARIES} name="primaries" />
        <FeatherRow row={SECONDARIES} name="secondaries" />
        <FeatherRow row={COVERTS} name="coverts" />
        <g data-wing-row="scapular">
          <g data-wing-ripple="">
            <path d={SCAPULAR} className={styles.plume} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Auréole (« couronne d'ange ») posée au-dessus du titre. */
function AngelHalo() {
  return (
    <span className={styles.halo}>
      <svg viewBox="0 0 100 34" role="presentation" focusable="false" aria-hidden="true">
        <ellipse cx="50" cy="17" rx="36" ry="10" className={styles.haloGlow} />
        <ellipse cx="50" cy="17" rx="36" ry="10" className={styles.haloRing} />
        <ellipse cx="50" cy="17" rx="30" ry="6.5" className={styles.haloInner} />
      </svg>
    </span>
  );
}

interface AngelWingsDecorProps {
  /** Préfixe unique par instance présente dans la page. */
  idPrefix: string;
  /** Affiche l'auréole au-dessus. */
  halo?: boolean;
}

/**
 * Décor complet : auréole au-dessus, une aile de chaque côté qui part de
 * derrière le contenu. Battement continu, pliage au survol.
 * Le parent doit porter `angelWingsHostClass` et une `position: relative`.
 */
export function AngelWingsDecor({ idPrefix, halo = true }: AngelWingsDecorProps) {
  return (
    <span className={styles.decor} aria-hidden="true">
      {halo && <AngelHalo />}
      <span className={`${styles.wing} ${styles.wingLeft}`}>
        <span className={styles.wingFold}>
          <AngelWing idPrefix={`${idPrefix}-l`} />
        </span>
      </span>
      <span className={`${styles.wing} ${styles.wingRight}`}>
        <span className={styles.wingFold}>
          <AngelWing idPrefix={`${idPrefix}-r`} />
        </span>
      </span>
    </span>
  );
}
