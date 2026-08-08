/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { artistAvatarSrc } from "@/lib/artists/avatar";
import styles from "./haiti-map.module.css";

interface GeoFeature {
  type: string;
  properties: { NAME_1: string; HASC_1: string; [key: string]: unknown };
  geometry: { type: string; coordinates: number[][][][] | number[][][] };
}

interface GeoJSON {
  features: GeoFeature[];
}

// Map HASC codes to our internal department codes
const HASC_TO_CODE: Record<string, string> = {
  "HT.AR": "ARTIBONITE",
  "HT.CE": "CENTRE",
  "HT.GA": "GRAND_ANSE",
  "HT.NI": "NIPPES",
  "HT.ND": "NORD",
  "HT.NE": "NORD_EST",
  "HT.NO": "NORD_OUEST",
  "HT.OU": "OUEST",
  "HT.SD": "SUD",
  "HT.SE": "SUD_EST",
};

interface HaitiMapProps {
  onDepartmentClick?: (code: string, name: string) => void;
  artistsByDepartment?: Record<
    string,
    Array<{ id: string; name: string; imageUrl: string | null }>
  >;
}

export function HaitiMapSVG({ onDepartmentClick, artistsByDepartment = {} }: HaitiMapProps) {
  const [geojson, setGeojson] = useState<GeoJSON | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/haiti-departments.geojson")
      .then((r) => r.json())
      .then((data) => setGeojson(data))
      .catch(() => {});
  }, []);

  if (!geojson) {
    return <div className={styles.mapContainer} style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a9ac0" }}>Chargement de la carte...</div>;
  }

  // Compute bounding box to set viewBox (only Haiti, no DR)
  const allCoords: [number, number][] = [];
  for (const feature of geojson.features) {
    const coords = feature.geometry.type === "MultiPolygon"
      ? (feature.geometry.coordinates as number[][][][]).flat(2)
      : (feature.geometry.coordinates as number[][][]).flat(1);
    for (const c of coords) allCoords.push([c[0], c[1]]);
  }
  const minX = Math.min(...allCoords.map(c => c[0]));
  const maxX = Math.max(...allCoords.map(c => c[0]));
  const minY = Math.min(...allCoords.map(c => c[1]));
  const maxY = Math.max(...allCoords.map(c => c[1]));

  const padding = 0.05;
  const vbX = minX - padding;
  const vbY = -(maxY + padding); // Flip Y for SVG
  const vbW = (maxX - minX) + 2 * padding;
  const vbH = (maxY - minY) + 2 * padding;

  return (
    <div className={styles.mapContainer}>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className={styles.mapSvg}
        aria-label="Carte d'Haïti par département"
      >
        <defs>
          <filter id="neon-strong">
            <feGaussianBlur stdDeviation="0.015" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {geojson.features.map((feature) => {
          const code = HASC_TO_CODE[feature.properties.HASC_1] ?? feature.properties.NAME_1;
          const name = feature.properties.NAME_1;
          const isHovered = hovered === code;

          // Convert GeoJSON coordinates to SVG path (flip Y axis)
          const pathD = geoToSvgPath(feature.geometry);

          return (
            <g key={code}>
              {isHovered && (
                <path d={pathD} className={styles.glowPath} filter="url(#neon-strong)" />
              )}
              <path
                d={pathD}
                className={`${styles.deptPath} ${isHovered ? styles.deptHovered : ""}`}
                onMouseEnter={() => setHovered(code)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onDepartmentClick?.(code, name)}
                role="button"
                aria-label={name}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onDepartmentClick?.(code, name); }}
              />
              <text
                x={getCentroid(feature.geometry)[0]}
                y={-getCentroid(feature.geometry)[1]}
                className={styles.deptLabel}
                pointerEvents="none"
              >
                {name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Artist preview on hover */}
      {hovered && artistsByDepartment[hovered] && artistsByDepartment[hovered].length > 0 && (
        <div className={styles.artistPreview}>
          <div className={styles.artistScroll}>
            {artistsByDepartment[hovered].map((artist) => (
              <div key={artist.id} className={styles.artistChip}>
                <img
                  src={artistAvatarSrc(artist.imageUrl)}
                  alt=""
                  className={styles.artistAvatar}
                />
                <span>{artist.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Convert GeoJSON geometry to SVG path string (Y-axis flipped) */
function geoToSvgPath(geometry: { type: string; coordinates: number[][][][] | number[][][] }): string {
  const polygons = geometry.type === "MultiPolygon"
    ? (geometry.coordinates as number[][][][])
    : [geometry.coordinates as number[][][]];

  let d = "";
  for (const polygon of polygons) {
    for (const ring of polygon) {
      d += ring.map((coord, i) => {
        const x = coord[0];
        const y = -coord[1]; // Flip Y for SVG coordinate system
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      }).join(" ") + " Z ";
    }
  }
  return d.trim();
}

/** Compute centroid of a GeoJSON geometry */
function getCentroid(geometry: { type: string; coordinates: number[][][][] | number[][][] }): [number, number] {
  const polygons = geometry.type === "MultiPolygon"
    ? (geometry.coordinates as number[][][][])
    : [geometry.coordinates as number[][][]];

  let sumX = 0, sumY = 0, count = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const coord of ring) {
        sumX += coord[0];
        sumY += coord[1];
        count++;
      }
    }
  }
  return [sumX / (count || 1), sumY / (count || 1)];
}
