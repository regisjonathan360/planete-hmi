/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import styles from "./haiti-map.module.css";

/**
 * SVG des 10 départements d'Haïti (partie ouest de l'île Hispaniola).
 * Paths basés sur les proportions géographiques réelles.
 * ViewBox calibrée sur les coordonnées simplifiées.
 */
const DEPARTMENTS = [
  {
    code: "NORD_OUEST",
    name: "Nord-Ouest",
    // Péninsule nord-ouest (longue bande horizontale)
    path: "M 18,52 L 28,48 L 42,44 L 58,42 L 72,40 L 86,38 L 95,42 L 100,48 L 96,54 L 88,58 L 78,56 L 65,54 L 50,56 L 35,58 L 22,58 Z",
  },
  {
    code: "NORD",
    name: "Nord",
    // Centre-nord, entre Nord-Ouest et Nord-Est
    path: "M 100,48 L 112,42 L 126,38 L 140,36 L 152,38 L 158,44 L 154,52 L 145,56 L 134,58 L 120,56 L 108,54 L 96,54 L 100,48 Z",
  },
  {
    code: "NORD_EST",
    name: "Nord-Est",
    // Coin nord-est
    path: "M 158,44 L 170,40 L 184,42 L 194,48 L 196,56 L 190,64 L 180,68 L 168,66 L 158,62 L 154,52 Z",
  },
  {
    code: "ARTIBONITE",
    name: "Artibonite",
    // Grande zone centrale ouest
    path: "M 78,56 L 88,58 L 96,54 L 108,54 L 120,56 L 134,58 L 138,66 L 134,76 L 124,82 L 112,84 L 98,80 L 86,76 L 76,70 L 72,62 Z",
  },
  {
    code: "CENTRE",
    name: "Centre",
    // Zone centrale intérieure
    path: "M 134,58 L 145,56 L 154,52 L 158,62 L 168,66 L 180,68 L 182,78 L 176,88 L 164,92 L 150,90 L 138,86 L 134,76 L 138,66 Z",
  },
  {
    code: "OUEST",
    name: "Ouest",
    // Zone côtière avec Port-au-Prince (golfe de la Gonâve)
    path: "M 72,62 L 76,70 L 86,76 L 98,80 L 112,84 L 118,92 L 114,102 L 106,110 L 94,114 L 82,110 L 72,104 L 64,94 L 60,84 L 62,72 Z",
  },
  {
    code: "NIPPES",
    name: "Nippes",
    // Petite zone entre Ouest et Grand'Anse
    path: "M 60,84 L 64,94 L 72,104 L 68,112 L 58,116 L 48,112 L 42,104 L 44,94 L 50,88 Z",
  },
  {
    code: "GRAND_ANSE",
    name: "Grand'Anse",
    // Pointe de la péninsule sud (partie ouest)
    path: "M 42,104 L 48,112 L 58,116 L 54,126 L 44,134 L 32,138 L 20,134 L 14,126 L 18,116 L 28,108 L 36,104 Z",
  },
  {
    code: "SUD",
    name: "Sud",
    // Péninsule sud (côte sud)
    path: "M 58,116 L 68,112 L 72,104 L 82,110 L 94,114 L 98,122 L 92,132 L 80,138 L 66,140 L 54,136 L 44,134 L 54,126 Z",
  },
  {
    code: "SUD_EST",
    name: "Sud-Est",
    // Sud-Est (coin sud-est, Jacmel)
    path: "M 112,84 L 124,82 L 134,76 L 138,86 L 150,90 L 156,98 L 152,108 L 140,114 L 126,116 L 114,112 L 106,110 L 114,102 L 118,92 Z",
  },
];

interface HaitiMapProps {
  onDepartmentClick?: (code: string, name: string) => void;
  artistsByDepartment?: Record<string, Array<{ id: string; name: string; image_url: string | null }>>;
}

export function HaitiMapSVG({ onDepartmentClick, artistsByDepartment = {} }: HaitiMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className={styles.mapContainer}>
      <svg
        viewBox="5 30 200 120"
        className={styles.mapSvg}
        aria-label="Carte d'Haïti par département"
      >
        <defs>
          <filter id="neon-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="neon-strong">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {DEPARTMENTS.map((dept) => (
          <g key={dept.code}>
            {/* Glow layer (visible on hover) */}
            {hovered === dept.code && (
              <path
                d={dept.path}
                className={styles.glowPath}
                filter="url(#neon-strong)"
              />
            )}
            {/* Main department path */}
            <path
              d={dept.path}
              className={`${styles.deptPath} ${hovered === dept.code ? styles.deptHovered : ""}`}
              onMouseEnter={() => setHovered(dept.code)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onDepartmentClick?.(dept.code, dept.name)}
              role="button"
              aria-label={dept.name}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") onDepartmentClick?.(dept.code, dept.name); }}
            />
            {/* Department label */}
            <text
              x={getCenter(dept.path).x}
              y={getCenter(dept.path).y}
              className={styles.deptLabel}
              pointerEvents="none"
            >
              {dept.name}
            </text>
          </g>
        ))}
      </svg>

      {/* Artist preview on hover */}
      {hovered && artistsByDepartment[hovered] && artistsByDepartment[hovered].length > 0 && (
        <div className={styles.artistPreview}>
          <div className={styles.artistScroll}>
            {artistsByDepartment[hovered].map((artist) => (
              <div key={artist.id} className={styles.artistChip}>
                {artist.image_url ? (
                  <img src={artist.image_url} alt="" className={styles.artistAvatar} />
                ) : (
                  <div className={styles.artistAvatarPlaceholder}>♪</div>
                )}
                <span>{artist.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Calcule le centre approximatif d'un path SVG */
function getCenter(path: string): { x: number; y: number } {
  const coords = path.match(/\d+\.?\d*/g)?.map(Number) ?? [];
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i < coords.length; i += 2) {
    sumX += coords[i];
    sumY += coords[i + 1];
    count++;
  }
  return { x: sumX / (count || 1), y: sumY / (count || 1) };
}
