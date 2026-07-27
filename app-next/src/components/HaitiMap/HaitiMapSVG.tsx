/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import styles from "./haiti-map.module.css";

/**
 * SVG des 10 départements d'Haïti (partie ouest de l'île, sans la RD).
 * Paths simplifiés mais reconnaissables.
 */
const DEPARTMENTS = [
  { code: "NORD_OUEST", name: "Nord-Ouest", path: "M 62,18 L 95,12 L 110,22 L 100,38 L 78,42 L 55,35 Z" },
  { code: "NORD", name: "Nord", path: "M 110,22 L 145,15 L 170,28 L 160,48 L 130,50 L 100,38 Z" },
  { code: "NORD_EST", name: "Nord-Est", path: "M 170,28 L 210,25 L 220,45 L 195,55 L 160,48 Z" },
  { code: "ARTIBONITE", name: "Artibonite", path: "M 78,42 L 100,38 L 130,50 L 135,72 L 110,82 L 80,75 L 65,55 Z" },
  { code: "CENTRE", name: "Centre", path: "M 130,50 L 160,48 L 195,55 L 200,78 L 170,90 L 135,72 Z" },
  { code: "OUEST", name: "Ouest", path: "M 65,55 L 80,75 L 110,82 L 115,105 L 98,125 L 72,120 L 55,95 L 50,70 Z" },
  { code: "GRAND_ANSE", name: "Grand'Anse", path: "M 50,70 L 55,95 L 72,120 L 55,140 L 30,135 L 20,110 L 30,85 Z" },
  { code: "NIPPES", name: "Nippes", path: "M 72,120 L 98,125 L 105,145 L 85,155 L 55,140 Z" },
  { code: "SUD", name: "Sud", path: "M 55,140 L 85,155 L 105,145 L 115,165 L 90,178 L 50,172 L 30,155 L 30,135 Z" },
  { code: "SUD_EST", name: "Sud-Est", path: "M 98,125 L 115,105 L 135,72 L 170,90 L 175,110 L 150,130 L 120,140 L 105,145 Z" },
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
        viewBox="10 5 220 180"
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
