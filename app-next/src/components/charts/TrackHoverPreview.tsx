"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/**
 * Hover preview pour les musiques du classement.
 *
 * Au survol d'une carte :
 * - Affiche un bouton ▶ flottant qui mène directement vers Audiomack.
 * - Si l'iframe embed Audiomack est disponible (preload intelligent),
 *   intègre un mini-lecteur en overlay.
 *
 * Optimisations :
 * - IntersectionObserver : ne preload l'embed que quand l'élément est visible.
 * - Un seul embed chargé à la fois (mémoire contrôlée).
 * - L'iframe n'est injectée qu'au hover réel (pas au rendu initial).
 * - Dimensions minimales, pas de double-download.
 */

interface Props {
  platformUrl: string | null;
  artistSlug?: string | null;
  trackSlug?: string | null;
  children: React.ReactNode;
}

let activeEmbed: HTMLIFrameElement | null = null;

export function TrackHoverPreview({ platformUrl, artistSlug, trackSlug, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const embedRef = useRef<HTMLIFrameElement | null>(null);

  // Construire l'URL d'embed Audiomack.
  const embedSrc = artistSlug && trackSlug
    ? `https://audiomack.com/embed/song/${artistSlug}/${trackSlug}?background=1`
    : null;

  // IntersectionObserver pour preload intelligent.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleEnter = useCallback(() => setHovered(true), []);
  const handleLeave = useCallback(() => {
    setHovered(false);
    // Détruire l'embed actif pour libérer mémoire.
    if (embedRef.current) {
      embedRef.current.src = "about:blank";
      activeEmbed = null;
    }
  }, []);

  const showEmbed = hovered && visible && embedSrc;

  // Quand on affiche l'embed, couper le précédent.
  useEffect(() => {
    if (showEmbed && embedRef.current) {
      if (activeEmbed && activeEmbed !== embedRef.current) {
        activeEmbed.src = "about:blank";
      }
      activeEmbed = embedRef.current;
    }
  }, [showEmbed]);

  if (!platformUrl && !embedSrc) return <>{children}</>;

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="hover-preview"
    >
      {children}
      {hovered && (
        <div className="hover-preview__overlay">
          {showEmbed ? (
            <iframe
              ref={embedRef}
              src={embedSrc!}
              className="hover-preview__embed"
              allow="autoplay"
              loading="lazy"
              title="Audiomack preview"
            />
          ) : platformUrl ? (
            <a
              href={platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover-preview__play"
            >
              ▶ Écouter
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
