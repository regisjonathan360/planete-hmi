"use client";

import { useRef, useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Singleton: only one embed active at a time
// ---------------------------------------------------------------------------
let activeIframe: HTMLIFrameElement | null = null;
let activeCleanup: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AudiomackEmbedPreviewProps {
  artistSlug: string | null | undefined;
  trackSlug: string | null | undefined;
  trackTitle: string;
  artistName: string;
  /** Fallback URL if slugs are missing */
  platformUrl?: string | null;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AudiomackEmbedPreview — Lecteur audio embed Audiomack.
 *
 * - Desktop : popover affiché au survol avec debounce 300ms
 * - Mobile : affiché au tap/click
 * - Singleton : une seule instance active à la fois
 * - Lazy : l'iframe n'est créée qu'à l'interaction
 * - Destruction de l'iframe à la fermeture / sortie du survol
 */
export function AudiomackEmbedPreview({
  artistSlug,
  trackSlug,
  trackTitle,
  artistName,
  platformUrl,
  children,
}: AudiomackEmbedPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);

  const hasValidSlugs = Boolean(artistSlug && trackSlug);
  const embedSrc = hasValidSlugs
    ? `https://audiomack.com/embed/song/${artistSlug}/${trackSlug}`
    : null;

  // Clean up function to destroy iframe
  const destroyEmbed = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = "about:blank";
      if (activeIframe === iframeRef.current) {
        activeIframe = null;
        activeCleanup = null;
      }
    }
    setShowEmbed(false);
  }, []);

  // Desktop: hover with 300ms debounce
  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      // Kill any existing active embed (singleton)
      if (activeCleanup && activeIframe !== iframeRef.current) {
        activeCleanup();
      }
      setShowEmbed(true);
      activeCleanup = destroyEmbed;
    }, 300);
  }, [destroyEmbed]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    destroyEmbed();
  }, [destroyEmbed]);

  // Mobile: tap/click toggle
  const handleClick = useCallback(() => {
    // Only act on touch devices (coarse pointer)
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (showEmbed) {
      destroyEmbed();
    } else {
      // Kill any existing active embed (singleton)
      if (activeCleanup) {
        activeCleanup();
      }
      setShowEmbed(true);
      activeCleanup = destroyEmbed;
    }
  }, [showEmbed, destroyEmbed]);

  // Register iframe as active when shown
  useEffect(() => {
    if (showEmbed && iframeRef.current) {
      activeIframe = iframeRef.current;
      activeCleanup = destroyEmbed;
    }
  }, [showEmbed, destroyEmbed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (activeIframe === iframeRef.current) {
        activeIframe = null;
        activeCleanup = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If no slugs and no platform URL, just render children
  if (!hasValidSlugs && !platformUrl) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={hasValidSlugs ? handleMouseEnter : undefined}
      onMouseLeave={hasValidSlugs ? handleMouseLeave : undefined}
      onClick={hasValidSlugs ? handleClick : undefined}
      className="audiomack-embed-preview"
      style={{ position: "relative" }}
    >
      {children}

      {showEmbed && embedSrc && (
        <div
          className="audiomack-embed-preview__popover"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            marginBottom: "4px",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            background: "#1a1a2e",
          }}
        >
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={`${trackTitle} — ${artistName}`}
            allow="autoplay"
            style={{
              width: "100%",
              height: "110px",
              border: "none",
              display: "block",
            }}
            loading="lazy"
          />
        </div>
      )}

      {/* Fallback: if slugs are missing but platformUrl exists, show external link on hover */}
      {!hasValidSlugs && platformUrl && (
        <a
          href={platformUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="audiomack-embed-preview__fallback"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            padding: "0.2rem 0.5rem",
            fontSize: "0.7rem",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            borderRadius: "0 0 0 6px",
            textDecoration: "none",
            opacity: 0,
            transition: "opacity 0.2s",
          }}
          aria-label={`Écouter ${trackTitle} sur Audiomack`}
        >
          ▶ Audiomack ↗
        </a>
      )}
    </div>
  );
}
