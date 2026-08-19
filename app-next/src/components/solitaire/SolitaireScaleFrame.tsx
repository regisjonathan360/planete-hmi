"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./solitaire-scale-frame.module.css";

interface FrameTransform {
  scale: number;
  width: number;
  height: number;
}

interface SolitaireFullscreenValue {
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: boolean;
  /** Facteur d'échelle appliqué à la table (1 = pleine taille). */
  scale: number;
  /**
   * Élément du cadre du jeu. Les calques de drag (fantômes de cartes, de
   * fenêtres) doivent s'y portaliser en plein écran : le contenu rendu
   * dans document.body passe derrière l'élément en plein écran (top layer
   * du navigateur) et devient invisible.
   */
  frameHost: HTMLElement | null;
}

/** Taille de design du Solitaire : plateau 1020×775 + barres (30+30+30). */
const DESIGN_WIDTH = 1020;
const DESIGN_HEIGHT = 865;

const SolitaireFullscreenContext = createContext<SolitaireFullscreenValue>({
  enterFullscreen: () => {},
  exitFullscreen: () => {},
  isFullscreen: false,
  scale: 1,
  frameHost: null,
});

export function useSolitaireFullscreen() {
  return useContext(SolitaireFullscreenContext);
}

/**
 * Encadre le Solitaire (taillé en dur 1020 px de large + barres) et le met
 * à l'échelle pour que toutes les parties du jeu tiennent à l'écran, sans
 * barre de défilement (« slider »). La mise à l'échelle est mesurée sur la
 * taille naturelle du contenu, recentrée, et recalibrée au resize + au fil
 * de l'eau (fenêtres du jeu qui s'ouvrent/se ferment).
 *
 * Mode `fluid` : pas de maquette 1020 px — le contenu (les modes Spider,
 * FreeCell, Pyramid) remplit 100 % du cadre et se dimensionne lui-même
 * (useTableGeometry). Expose aussi le plein écran : le cadre entier passe
 * en plein écran au clic sur « Jouer », et un bouton de sortie (style
 * fenêtre Windows 95) apparaît alors en haut à droite.
 */
export function SolitaireScaleFrame({
  children,
  fluid = false,
}: {
  children: React.ReactNode;
  fluid?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [frameHost, setFrameHost] = useState<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<FrameTransform | null>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  const measurePendingRef = useRef(false);

  const setOuterNode = useCallback((node: HTMLDivElement | null) => {
    outerRef.current = node;
    setFrameHost(node);
  }, []);

  const measure = useCallback(() => {
    if (measurePendingRef.current) return;
    measurePendingRef.current = true;

    const outer = outerRef.current;
    if (!outer) {
      measurePendingRef.current = false;
      return;
    }

    const availableWidth = outer.clientWidth;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const rect = outer.getBoundingClientRect();
    const availableHeightPx = isFullscreenRef.current
      ? window.innerHeight
      : window.innerHeight - Math.max(rect.top, 0) - 14;
    const availableHeight = Math.max(0, availableHeightPx);

    if (!availableWidth || !availableHeight) {
      measurePendingRef.current = false;
      return;
    }

    if (!fluid) {
      // Taille de design FIXE : le jeu est conçu en 1020×775 (+ barres).
      // En plein écran, on clamp au viewport pour éviter tout débordement.
      const maxScale = isFullscreenRef.current
        ? Math.min(viewportW / DESIGN_WIDTH, viewportH / DESIGN_HEIGHT)
        : 1.35;
      const scale = Math.min(
        availableWidth / DESIGN_WIDTH,
        availableHeight / DESIGN_HEIGHT,
        maxScale
      );
      setTransform((prev) => {
        if (prev && Math.abs(prev.scale - scale) < 0.001) {
          return prev;
        }
        return {
          scale,
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
        };
      });
    }

    // Hauteur du cadre : en plein écran = viewport, sinon espace sous header.
    setFrameHeight((prev) =>
      prev !== null && Math.abs(prev - availableHeightPx) < 2
        ? prev
        : Math.max(360, Math.round(availableHeightPx))
    );

    measurePendingRef.current = false;
  }, [fluid]);

  useEffect(() => {
    measure();
    const outer = outerRef.current;
    if (!outer) return;

    // Le cadre peut être positionné après le premier rendu (header, police,
    // sidebar responsive). Reprendre la mesure sur deux frames évite de
    // conserver la hauteur minimale de 360 px alors que davantage d'espace
    // est déjà disponible.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      measure();
      secondFrame = window.requestAnimationFrame(measure);
    });

    const outerObserver = new ResizeObserver(() => measure());
    outerObserver.observe(outer);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      outerObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [measure]);

  const getFullscreenElement = useCallback(() => {
    const webkitDocument = document as Document & {
      webkitFullscreenElement?: Element | null;
    };
    return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
  }, []);

  const enterFullscreen = useCallback(() => {
    const outer = outerRef.current;
    if (!outer || getFullscreenElement()) return;
    if (outer.requestFullscreen) {
      const promise = outer.requestFullscreen();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    } else {
      const webkitOuter = outer as HTMLDivElement & {
        webkitRequestFullscreen?: () => void;
      };
      webkitOuter.webkitRequestFullscreen?.();
    }
  }, [getFullscreenElement]);

  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen) {
      const promise = document.exitFullscreen();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    } else {
      const webkitDocument = document as Document & {
        webkitExitFullscreen?: () => void;
      };
      webkitDocument.webkitExitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const nowFullscreen = getFullscreenElement() === outerRef.current;
      isFullscreenRef.current = nowFullscreen;
      setIsFullscreen(nowFullscreen);
      // Recalcule après que le navigateur a appliqué le fullscreen
      requestAnimationFrame(() => {
        requestAnimationFrame(() => measure());
      });
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as EventListener);
    };
  }, [getFullscreenElement, measure]);

  const scale = transform?.scale ?? 1;
  const width = !fluid && transform ? transform.width : "100%";
  const height = !fluid && transform ? transform.height : "100%";
  const marginLeft = !fluid && transform ? (-transform.width * scale) / 2 : 0;
  const marginTop = !fluid && transform ? (-transform.height * scale) / 2 : 0;
  const centered = !fluid && transform;

  return (
    <SolitaireFullscreenContext.Provider
      value={{
        enterFullscreen,
        exitFullscreen,
        isFullscreen,
        scale,
        frameHost,
      }}
    >
      <div
        ref={setOuterNode}
        className={styles.frame}
        // En plein écran, on laisse la règle .frame:fullscreen (100 % du
        // viewport) s'appliquer : une hauteur inline écraserait la règle.
        style={isFullscreen ? undefined : { height: frameHeight ? `${frameHeight}px` : undefined }}
      >
        <div
          ref={innerRef}
          className={styles.frame__inner}
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            marginLeft,
            marginTop,
            left: centered ? "50%" : 0,
            top: centered ? "50%" : 0,
          }}
        >
          {children}
        </div>
      </div>
    </SolitaireFullscreenContext.Provider>
  );
}
