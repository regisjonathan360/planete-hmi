import Link from "next/link";
import { HAITI_SILHOUETTE_PATHS, HAITI_VIEWBOX } from "./haiti-silhouette";
import styles from "./haiti-shape-button.module.css";

interface HaitiShapeButtonProps {
  /** Destination du bouton (par défaut la page carte). */
  href?: string;
  /** Libellé affiché sous la silhouette. */
  label?: string;
}

/**
 * Bouton en forme géographique d'Haïti.
 * La silhouette provient du GeoJSON GADM réel (aucun tracé dessiné à la main) :
 * voir scripts/gen-haiti-silhouette.mjs.
 */
export function HaitiShapeButton({
  href = "/carte",
  label = "Explorer la carte",
}: HaitiShapeButtonProps) {
  return (
    <Link href={href} className={styles.button}>
      <svg
        viewBox={HAITI_VIEWBOX}
        className={styles.shape}
        role="img"
        aria-label="Carte d'Haïti"
      >
        <defs>
          <linearGradient id="haitiFlagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1b3fa8">
              <animate
                attributeName="stop-color"
                values="#1b3fa8;#d32f2f;#1b3fa8"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="45%" stopColor="#d32f2f">
              <animate
                attributeName="stop-color"
                values="#d32f2f;#1b3fa8;#d32f2f"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#1b3fa8">
              <animate
                attributeName="stop-color"
                values="#1b3fa8;#d32f2f;#1b3fa8"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        {/* Silhouette pleine : fill + stroke du même dégradé pour souder les
            frontières départementales en une seule masse continue. */}
        <g
          fill="url(#haitiFlagGrad)"
          stroke="url(#haitiFlagGrad)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {HAITI_SILHOUETTE_PATHS.map((d, i) => (
            <path key={`fill-${i}`} d={d} />
          ))}
        </g>

        {/* Frontières internes des départements, très discrètes. */}
        <g
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.7"
          strokeLinejoin="round"
        >
          {HAITI_SILHOUETTE_PATHS.map((d, i) => (
            <path key={`line-${i}`} d={d} />
          ))}
        </g>
      </svg>
      <span className={styles.label}>{label}</span>
    </Link>
  );
}
