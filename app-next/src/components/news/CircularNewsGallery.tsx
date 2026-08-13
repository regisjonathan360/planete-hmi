"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* Galerie circulaire 3D des actualités — portage du modèle « CircularGallery »
   (rotateY + translateZ : les cartes font un cercle qui tourne autour du
   centre). Auto-rotation quand la page est au repos, rotation pilotée par le
   défilement de la page quand on scrolle, opacité dégradée selon la distance
   angulaire à l'avant de la scène (comme la démo). */

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
/** Tours complets effectués en défilant toute la page. */
const SCROLL_TURNS = 2;

export function CircularNewsGallery({ items }: CircularNewsGalleryProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(() => Math.random() * 360);
  const [dims, setDims] = useState({ radius: 340, cardW: 260, cardH: 377 });
  const [reduced, setReduced] = useState(false);

  /* prefers-reduced-motion : on coupe l'auto-rotation (le scroll reste). */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
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

  /* Rotation : au scroll, inertie vers la rotation cible (2 tours/page) ;
     au repos, auto-rotation continue. Boucle rAF comme la démo. */
  useEffect(() => {
    let raf = 0;
    let lastY = window.scrollY;
    const tick = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      const scrollTarget = progress * 360 * SCROLL_TURNS;
      const scrolling = Math.abs(window.scrollY - lastY) > 0.5;
      setRotation((prev) => {
        if (scrolling) {
          return prev + (scrollTarget - prev) * 0.08;
        }
        return reduced ? prev : prev + AUTO_ROTATE_SPEED;
      });
      lastY = window.scrollY;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const gallery = useMemo(() => items.slice(0, MAX_ITEMS), [items]);
  if (gallery.length === 0) return null;

  const anglePerItem = 360 / gallery.length;
  const totalRotation = ((rotation % 360) + 360) % 360;

  return (
    <div
      ref={hostRef}
      className="circular-news-gallery"
      role="region"
      aria-label="Actualités en cercle — faites défiler la page pour faire tourner"
      style={{ perspective: "2000px" }}
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
    </div>
  );
}