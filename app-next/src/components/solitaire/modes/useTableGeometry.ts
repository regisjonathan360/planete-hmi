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

/**
 * Calcule la géométrie du tableau (tailles de cartes, pas entre cartes et
 * colonnes) d'après la taille RÉELLE de la table, mesurée en continu.
 *
 * Objectifs :
 * - Cartes aussi grandes que possible
 * - Espacement horizontal correct entre les colonnes (gapX)
 * - Chevauchement vertical correct (overlap)
 * - Pas de débordement en plein écran
 * - Respect du ratio d'aspect des cartes (0.69)
 */
export function useTableGeometry(options: TableGeometryOptions) {
  const {
    columns,
    maxStack,
    topBlockMin = 110,
    maxCardW = 130,
    minCardW = 28,
    ratio = 0.69,
    padX = 32,
    bottomReserve = 40,
    overlapRatio = 0.15,
  } = options;

  const tableRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState({
    cardW: 96,
    cardH: 139,
    overlap: 24,
    gapX: 10,
    foundationH: 44,
  });

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    const compute = () => {
      const rect = tableRef.current?.getBoundingClientRect();
      if (!rect || rect.width < 60 || rect.height < 60) return;

      // Clamp to viewport size to prevent overflow in fullscreen
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const width = Math.min(rect.width, viewportW);
      const height = Math.min(rect.height, viewportH);

      // Itératif : converger vers la taille optimale de carte
      let cardW = 120;

      for (let iter = 0; iter < 5; iter++) {
        const cardH = cardW / 0.69;

        // Contrainte hauteur : la pile la plus haute doit tenir
        const neededH = cardH + (maxStack - 1) * Math.max(8, Math.round(cardW / 0.69 * 0.15));
        if (neededH > height * 0.85) {
          cardW = Math.round(cardW * 0.95);
          continue;
        }

        // Gap horizontal proportionnel à la largeur de carte (~10%)
        const gapXCalc = Math.min(14, Math.max(8, Math.round(cardW * 0.1)));

        // Largeur max possible avec les gaps
        const maxWByWidth = (width - 32 - gapXCalc * (columns - 1)) / columns;

        // Ajuster cardW selon la largeur dispo
        cardW = Math.min(cardW, maxWByWidth);

        // Bornes dures
        cardW = Math.min(Math.max(cardW, 28), 130);
      }

      const cardH = Math.round(cardW / 0.69);
      const overlap = Math.min(24, Math.max(6, Math.round(cardW / 0.69 * 0.18)));
      const gapX = Math.min(14, Math.max(8, Math.round(cardW * 0.1)));
      const foundationH = Math.min(46, Math.max(30, Math.round(cardW / 0.69 * 0.35)));

      setValues({
        cardW: Math.round(cardW),
        cardH,
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