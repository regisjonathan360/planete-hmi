"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DragGhost {
  /** Charge utile du drag (pile, stock…) — définie par chaque moteur. */
  payload: unknown;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragSession {
  payload: unknown;
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  moved: number;
}

interface TableDragOptions {
  /**
   * Zone de dépôt : valeur de data-drop sous le pointeur (null si nulle part).
   * moved = distance parcourue pour distinguer clic/drag.
   * element = élément sous le pointeur (lecture data-position, etc.).
   */
  onDrop: (
    payload: unknown,
    zone: string | null,
    moved: number,
    element: HTMLElement | null
  ) => void;
  /** Désactivé ? */
  enabled?: boolean;
}

/**
 * Drag souris/tactile générique pour les modes de solitaire :
 * pointeur pressé sur une carte → fantôme qui suit le curseur, relâché
 * sur une zone marquée data-drop → onDrop. Sélection au clic ensuite
 * gérée par les moteurs (moved ≤ seuil = clic).
 */
export function useTableDrag({ onDrop, enabled = true }: TableDragOptions) {
  const session = useRef<DragSession | null>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  });
  const [ghost, setGhost] = useState<DragGhost | null>(null);

  const beginDrag = useCallback(
    (payload: unknown) => (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      // Capture du pointeur : les événements suivants (même hors du cadre)
      // remontent au tableau via le bubbling → le fantôme suit le curseur
      // partout et le relâchement est toujours détecté.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture indisponible (souris) : le bubbling du tableau suffit */
      }
      const rect = event.currentTarget.getBoundingClientRect();
      session.current = {
        payload,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: 0,
      };
      setGhost({
        payload,
        x: event.clientX - rect.width / 2,
        y: event.clientY - rect.height / 2,
        w: rect.width,
        h: rect.height,
      });
    },
    [enabled]
  );

  const moveDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const s = session.current;
    if (!s || s.id !== event.pointerId) return;
    s.moved += Math.abs(event.clientX - s.lastX) + Math.abs(event.clientY - s.lastY);
    s.lastX = event.clientX;
    s.lastY = event.clientY;
    setGhost((prev) =>
      prev
        ? { ...prev, x: event.clientX - prev.w / 2, y: event.clientY - prev.h / 2 }
        : prev
    );
  }, []);

  const finishDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const s = session.current;
    if (!s || s.id !== event.pointerId) return;
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const zoneEl = el?.closest?.("[data-drop]") as HTMLElement | null;
    const zone = zoneEl?.getAttribute("data-drop") ?? null;
    session.current = null;
    setGhost(null);
    onDropRef.current(s.payload, zone, s.moved, el);
  }, []);

  const cancelDrag = useCallback(() => {
    session.current = null;
    setGhost(null);
  }, []);

  return {
    ghost,
    beginDrag,
    moveDrag,
    finishDrag,
    cancelDrag,
  };
}