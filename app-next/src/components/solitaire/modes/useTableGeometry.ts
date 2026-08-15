"use client";

import { useEffect, useRef, useState } from "react";

export interface TableGeometryValues {
  /** Largeur d'une carte en px (design-space, avant mise à l'échelle). */
  cardW: number;
  /** Hauteur d'une carte en px (ratio fixe). */
  cardH: number;
  /** Pas vertical entre les cartes d'une colonne. */
  overlap: number;
  /** Espace horizontal entre les colonnes. */
  gapX: number;
  /** Hauteur des étiquettes de suite (Spider). */
  foundationH: number;
}

export interface TableGeometryOptions {
  /** Nombre de colonnes du tableau. */
  columns: number;
  /** Nombre maximal de cartes visibles empilées (borne la hauteur). */
  maxStack: number;
  /** Hauteur minimale du bloc du haut (talon/top row) en px. */
  topBlockMin?: number;
  /** Largeur de carte maximale en px. */
  maxCardW?: number;
  /** Largeur de carte minimale en px. */
  minCardW?: number;
  /** Ratio hauteur/largeur d'une carte (0.69 standard). */
  ratio?: number;
  /** Padding horizontal de la table (2 × 14). */
  padX?: number;
  /** Réserve basse (indice) en px. */
  bottomReserve?: number;
  /** Part d'un chevauchement par rapport à la hauteur de carte. */
  overlapRatio?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const DEFAULT_VALUES: TableGeometryValues = {
  cardW: 96,
  cardH: 139,
  overlap: 24,
  gapX: 10,
  foundationH: 44,
};

/**
 * Calcule la géométrie du tableau (tailles de cartes, pas entre cartes et
 * colonnes) d'après la taille RÉELLE de la table, mesurée en continu.
 *
 * Pourquoi pas du CSS pur ? `clamp(46px, calc((100% - 120px) / 10), 96px)`
 * vu via `var(--card-w)` est résolu au point d'utilisation de la variable
 * (la carte), où `100%` ne vaut plus la largeur de la table → la valeur
 * tombait toujours sur la borne minimale. Le calcul en JS renvoie des px
 * absolus qui s'adaptent à l'écran ET au ratio du cadre.
 */
export function useTableGeometry(options: TableGeometryOptions) {
  const {
    columns,
    maxStack,
    topBlockMin = 110,
    maxCardW = 104,
    minCardW = 24,
    ratio = 0.69,
    padX = 28,
    bottomReserve = 36,
    overlapRatio = 0.18,
  } = options;

  const tableRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<TableGeometryValues>(DEFAULT_VALUES);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 60) return;

      // Clamp to viewport size to prevent overflow in fullscreen
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const width = Math.min(rect.width, viewportW);
      const height = Math.min(rect.height, viewportH);

      const topBlock = clamp(topBlockMin, Math.round(height * 0.16), 150);
      const availableH = height - 20 - topBlock - bottomReserve;
      const denominator = 1 + Math.max(0, maxStack - 1) * overlapRatio;

      let cardW = maxCardW;
      let gapX = 10;
      for (let i = 0; i < 3; i++) {
        const cardH = Math.min(
          cardW / ratio,
          availableH / denominator
        );
        const cardWByWidth = (width - padX - gapX * (columns - 1)) / columns;
        cardW = Math.max(
          Math.min(cardWByWidth, cardH * ratio, maxCardW),
          minCardW
        );
        gapX = clamp(6, Math.round(cardW * 0.11), 12);
      }

      const cardH = cardW / ratio;
      const overlap = clamp(8, Math.round(cardH * 0.18), 26);
      const foundationH = clamp(30, Math.round(cardH * 0.42), 46);

      setValues({
        cardW: Math.round(cardW),
        cardH: Math.round(cardH),
        overlap,
        gapX,
        foundationH,
      });
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    window.addEventListener("resize", compute);

    // Recompute on fullscreen change (enter/exit) to avoid overflow
    const onFullscreenChange = () => {
      // Small delay to let browser finish fullscreen transition
      requestAnimationFrame(() => {
        requestAnimationFrame(compute);
      });
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", compute);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [
    columns,
    maxStack,
    topBlockMin,
    maxCardW,
    minCardW,
    ratio,
    padX,
    bottomReserve,
    overlapRatio,
  ]);

  const style = {
    "--card-w": `${values.cardW}px`,
    "--card-h": `${values.cardH}px`,
    "--overlap": `${values.overlap}px`,
    "--gap-x": `${values.gapX}px`,
    "--found-h": `${values.foundationH}px`,
  } as React.CSSProperties;

  return { tableRef, style, ...values };
}