"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* Galerie circulaire 3D des actualités — portage du modèle « CircularGallery »
   (rotateY + translateZ : les cartes font un cercle qui tourne autour du
   centre). Auto-rotation discrète au repos, rotation à la main en faisant
   glisser la souris/le doigt (comme la démo), et petite rotation au
   gyroscope du téléphone (même principe que le globe de la carte d'Haïti).
   Opacité dégradée selon la distance angulaire à l'avant de la scène. */

export interface CircularNewsItem {
  id: string;
  title: string;
  image: string;
  url: string;
  tag?: string;
  date?: string | null;
  /** Cadrage de l'image (object-position), ex. "47% 35%" — comme le modèle. */
  pos?: string;
}

interface CircularNewsGalleryProps {
  items: CircularNewsItem[];
}

/** Vitesse d'auto-rotation en degrés par frame (au repos). */
const AUTO_ROTATE_SPEED = 0.04;
/** Nombre de cartes max dans le cercle (lisibilité + perf). */
const MAX_ITEMS = 20;
/** Sensibilité du drag : degrés de rotation par pixel déplacé. */
const DRAG_SENSITIVITY = 0.35;
/** Délai après un drag avant que l'auto-rotation ne reprenne. */
const DRAG_RESUME_MS = 500;
/** Distance de drag au-delà de laquelle on annule le clic sur une carte. */
const CLICK_TOLERANCE = 6;

/** Clamp des deltas gyroscope (degrés), comme le globe d'Haïti. */
const GYRO_MAX = 26;

export function CircularNewsGallery({ items }: CircularNewsGalleryProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(() => Math.random() * 360);
  const [dims, setDims] = useState({ radius: 340, cardW: 260, cardH: 377 });
  const [reduced, setReduced] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({ active: false, id: -1, lastX: 0, lastY: 0, moved: 0, lastMoveAt: 0 });
  const gyroOrigin = useRef<{ beta: number; gamma: number } | null>(null);
  const gyroTarget = useRef({ beta: 0, gamma: 0, applied: 0 });

  /* prefers-reduced-motion : on coupe l'auto-rotation (le drag reste). */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /* Détection gyroscope disponible (après montage, comme le globe). */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGyroAvailable("DeviceOrientationEvent" in window);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  /* Taille réactive : rayon du cercle + dimensions des cartes selon l'écran.
     La largeur du conteneur pilote le rayon (comme la démo) et la hauteur
     disponible borne la taille des cartes — cartes volontairement grandes. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      const cardW = Math.round(Math.min(w * 0.38, h * 0.5, 380));
      const cardH = Math.round(cardW * 1.45);
      const radius = Math.max(
        200,
        Math.round(Math.min((w - cardW) / 2 - 14, 800))
      );
      setDims((prev) =>
        Math.abs(prev.radius - radius) < 2 && Math.abs(prev.cardW - cardW) < 2
          ? prev
          : { radius, cardW, cardH }
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /* Gyroscope (mobile) : origine capturée au premier événement, deltas beta/
     gamma clampés en degrés — même mécanique que HaitiInteractiveGlobe. */
  useEffect(() => {
    if (!gyroEnabled) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      gyroOrigin.current ??= { beta: event.beta, gamma: event.gamma };
      const origin = gyroOrigin.current;
      gyroTarget.current = {
        beta: Math.max(-GYRO_MAX, Math.min(GYRO_MAX, (event.beta - origin.beta) * 0.6)),
        gamma: Math.max(-GYRO_MAX, Math.min(GYRO_MAX, (event.gamma - origin.gamma) * 0.6)),
        applied: gyroTarget.current.applied,
      };
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, [gyroEnabled]);

  const enableGyroscope = useCallback(async () => {
    type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const orientation = DeviceOrientationEvent as DeviceOrientationWithPermission;
    if (orientation.requestPermission) {
      const permission = await orientation.requestPermission();
      if (permission !== "granted") return;
    }
    gyroOrigin.current = null;
    setGyroEnabled(true);
    dragState.current.active = false;
    setDragging(false);
  }, []);

  /* Rotation : l'auto-rotation tourne au repos, le drag (souris ou doigt)
     fait tourner le cercle à la main, le gyroscope ajoute un léger
     déplacement. Boucle rAF unique comme la démo. */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const drag = dragState.current;
      const now = performance.now();
      const recentlyDragged = now - drag.lastMoveAt < DRAG_RESUME_MS;
      setRotation((prev) => {
        if (drag.active || recentlyDragged) return prev;
        if (gyroEnabled) {
          const target = gyroTarget.current;
          const delta = target.beta + target.gamma - target.applied;
          target.applied = target.beta + target.gamma;
          if (delta !== 0) return prev + delta;
        }
        return reduced ? prev : prev + AUTO_ROTATE_SPEED;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, gyroEnabled]);

  /* Drag souris/tactile : la rotation suit le mouvement horizontal. */
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const drag = dragState.current;
    drag.active = true;
    drag.id = event.pointerId;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.moved = 0;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag.active || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.lastMoveAt = performance.now();
    setRotation((prev) => prev + dx * DRAG_SENSITIVITY);
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (event.pointerId !== drag.id) return;
    drag.active = false;
    drag.id = -1;
    drag.lastMoveAt = performance.now();
    setDragging(false);
  }, []);

  /* Après un vrai drag, on neutralise le clic déclenché sur une carte. */
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (drag.moved > CLICK_TOLERANCE) {
      event.preventDefault();
    }
    endDrag(event);
  }, [endDrag]);

  const onClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (drag.moved > CLICK_TOLERANCE) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  const gallery = useMemo(() => items.slice(0, MAX_ITEMS), [items]);
  if (gallery.length === 0) return null;

  const anglePerItem = 360 / gallery.length;
  const totalRotation = ((rotation % 360) + 360) % 360;

  return (
    <div
      ref={hostRef}
      className={`circular-news-gallery${dragging ? " circular-news-gallery--dragging" : ""}`}
      role="region"
      aria-label="Actualités en cercle — glissez avec la souris pour faire tourner"
      style={{ perspective: "2000px", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
      onClick={onClick}
    >
      <div
        className="circular-news-gallery__rotator"
        style={{
          transform: `rotateY(${rotation}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {gallery.map((item, i) => {
          const itemAngle = i * anglePerItem;
          const relativeAngle = (itemAngle + totalRotation + 360) % 360;
          const normalized = Math.abs(
            relativeAngle > 180 ? 360 - relativeAngle : relativeAngle
          );
          const opacity = Math.max(0.35, 1 - normalized / 180);

          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              role="group"
              aria-label={`Lire « ${item.title} »`}
              className="circular-news-gallery__card"
              style={{
                transform: `rotateY(${itemAngle}deg) translateZ(${dims.radius}px)`,
                width: dims.cardW,
                height: dims.cardH,
                marginLeft: -dims.cardW / 2,
                marginTop: -dims.cardH / 2,
                opacity,
                transition: "opacity 0.3s linear",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt=""
                loading="lazy"
                style={item.pos ? { objectPosition: item.pos } : undefined}
              />
              {item.tag && (
                <span className="circular-news-gallery__tag">{item.tag}</span>
              )}
              <span className="circular-news-gallery__caption">
                <strong>{item.title}</strong>
                {item.date && <time>{item.date}</time>}
              </span>
            </a>
          );
        })}
      </div>

      {gyroAvailable && !gyroEnabled ? (
        <button
          type="button"
          className="circular-news-gallery__gyro"
          onClick={enableGyroscope}
        >
          Activer le mouvement du téléphone
        </button>
      ) : null}
    </div>
  );
}