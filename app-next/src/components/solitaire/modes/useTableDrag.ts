"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DragGhost {
  payload: unknown;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragSession {
  payload: unknown;
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: number;
  frameRect: DOMRect | null;
}

interface TableDragOptions {
  onDrop: (
    payload: unknown,
    zone: string | null,
    moved: number,
    element: HTMLElement | null
  ) => void;
  enabled?: boolean;
  /** Conteneur du tableau (pour calculer les coords relatives) */
  frameRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Drag souris/tactile robuste pour les modes de solitaire.
 * - Pas de setPointerCapture (peu fiable mobile)
 * - Écouteurs sur `document` pour suivre le curseur partout
 * - Ghost positionné dans le repère du cadre (supporte scale/transform)
 * - touch-action: none géré via style sur le cadre
 */
export function useTableDrag({
  onDrop,
  enabled = true,
  frameRef,
}: TableDragOptions) {
  const session = useRef<DragSession | null>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const frameRectRef = useRef<DOMRect | null>(null);

  // Met à jour le rect du cadre au resize/scroll
  useEffect(() => {
    const frame = frameRef?.current;
    if (!frame) return;
    const updateRect = () => {
      frameRectRef.current = frame.getBoundingClientRect();
    };
    updateRect();
    const ro = new ResizeObserver(updateRect);
    ro.observe(frame);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [frameRef]);

  const beginDrag = useCallback(
    (payload: unknown) => (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();

      const frameRect = frameRectRef.current ?? frameRef?.current?.getBoundingClientRect() ?? null;
      const target = event.currentTarget;
      const targetRect = target.getBoundingClientRect();

      session.current = {
        payload,
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: 0,
        frameRect,
      };

      // Position du ghost relative au viewport (sera convertie en relative au cadre dans le render)
      setGhost({
        payload,
        x: event.clientX - targetRect.width / 2,
        y: event.clientY - targetRect.height / 2,
        w: targetRect.width,
        h: targetRect.height,
      });

      // Écouteurs document-level pour suivre partout
      document.addEventListener("pointermove", handlePointerMove, { passive: false });
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerCancel);
    },
    [enabled]
  );

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const s = session.current;
    if (!s || s.id !== event.pointerId) return;
    event.preventDefault();
    s.moved += Math.abs(event.clientX - s.lastX) + Math.abs(event.clientY - s.lastY);
    s.lastX = event.clientX;
    s.lastY = event.clientY;
    setGhost((prev) =>
      prev
        ? { ...prev, x: event.clientX - prev.w / 2, y: event.clientY - prev.h / 2 }
        : prev
    );
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    const s = session.current;
    if (!s || s.id !== event.pointerId) return;
    event.preventDefault();

    // Nettoyage écouteurs
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("pointercancel", handlePointerCancel);

    // Zone de drop : élément sous le curseur (dans le cadre si possible)
    let dropEl: HTMLElement | null = null;
    if (s.frameRect) {
      // Vérifie si le curseur est dans le cadre
      const inFrame =
        event.clientX >= s.frameRect.left &&
        event.clientX <= s.frameRect.right &&
        event.clientY >= s.frameRect.top &&
        event.clientY <= s.frameRect.bottom;
      if (inFrame) {
        dropEl = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      }
    }
    if (!dropEl) {
      dropEl = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    }
    const zoneEl = dropEl?.closest?.("[data-drop]") as HTMLElement | null;
    const zone = zoneEl?.getAttribute("data-drop") ?? null;

    session.current = null;
    setGhost(null);
    onDropRef.current(s.payload, zone, s.moved, dropEl);
  }, []);

  const handlePointerCancel = useCallback(() => {
    const s = session.current;
    if (!s) return;
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("pointercancel", handlePointerCancel);
    session.current = null;
    setGhost(null);
  }, []);

  // Nettoyage si composant démonté pendant un drag
  useEffect(() => {
    return () => {
      if (session.current) {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
        session.current = null;
      }
    };
  }, [handlePointerMove, handlePointerUp, handlePointerCancel]);

  // Aide pour le render du ghost : convertit coords viewport → coords cadre
  const getGhostStyle = useCallback(() => {
    if (!ghost || !frameRef?.current) return null;
    const frameRect = frameRef.current.getBoundingClientRect();
    return {
      x: ghost.x - frameRect.left,
      y: ghost.y - frameRect.top,
      w: ghost.w,
      h: ghost.h,
    };
  }, [ghost, frameRef]);

  // État dérivé pour le ghost style (mis à jour à chaque render)
  const ghostStyle = getGhostStyle();

  return {
    ghost,
    ghostStyle,
    beginDrag,
    // moveDrag/finishDrag/cancelDrag gardés pour compat mais non utilisés (document-level)
    moveDrag: () => {},
    finishDrag: () => {},
    cancelDrag: () => {
      const s = session.current;
      if (!s) return;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      session.current = null;
      setGhost(null);
    },
  };
}