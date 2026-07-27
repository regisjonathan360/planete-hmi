"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/boutique/boutique-development.module.css";

type OrientationPermission = "not-needed" | "needed" | "granted" | "denied";

type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const TAPE_TEXT =
  "BOUTIQUE EN PRÉPARATION  •  OUVERTURE PROCHAINE  •  PLANÈTE HMI  •  ";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function BoutiqueDevelopmentOverlay() {
  const overlayRef = useRef<HTMLElement>(null);
  const [orientationPermission, setOrientationPermission] =
    useState<OrientationPermission>("not-needed");

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) return;

    const orientationConstructor = window
      .DeviceOrientationEvent as DeviceOrientationConstructor | undefined;
    const needsPermission =
      typeof orientationConstructor?.requestPermission === "function";

    if (needsPermission) {
      window.setTimeout(() => {
        setOrientationPermission((current) =>
          current === "granted" || current === "denied" ? current : "needed"
        );
      }, 0);
    }

    let frameId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handlePointerMove = (event: PointerEvent) => {
      targetX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      targetY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null && event.beta == null) return;
      targetX = clamp((event.gamma ?? 0) / 35, -1, 1);
      targetY = clamp(((event.beta ?? 45) - 45) / 35, -1, 1);
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      overlay.style.setProperty("--wind-x", `${currentX * 18}px`);
      overlay.style.setProperty("--wind-y", `${currentY * 10}px`);
      overlay.style.setProperty("--wind-tilt", `${currentX * 3.8}deg`);
      overlay.style.setProperty("--wind-fold", `${currentY * 5}deg`);
      overlay.style.setProperty("--wind-x-reverse", `${currentX * -12}px`);
      overlay.style.setProperty("--wind-y-soft", `${currentY * 4.5}px`);
      overlay.style.setProperty("--wind-y-reverse", `${currentY * -6.5}px`);
      overlay.style.setProperty("--wind-tilt-reverse", `${currentX * -2.7}deg`);
      overlay.style.setProperty("--wind-tilt-soft", `${currentX * 2.1}deg`);
      overlay.style.setProperty("--wind-fold-reverse", `${currentY * -3}deg`);
      overlay.style.setProperty("--wind-fold-soft", `${currentY * 2.5}deg`);
      frameId = window.requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    if (!needsPermission || orientationPermission === "granted") {
      window.addEventListener("deviceorientation", handleOrientation, {
        passive: true,
      });
    }
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [orientationPermission]);

  async function enableOrientation() {
    const orientationConstructor = window
      .DeviceOrientationEvent as DeviceOrientationConstructor | undefined;
    if (typeof orientationConstructor?.requestPermission !== "function") {
      setOrientationPermission("not-needed");
      return;
    }

    try {
      const permission = await orientationConstructor.requestPermission();
      setOrientationPermission(permission === "granted" ? "granted" : "denied");
    } catch {
      setOrientationPermission("denied");
    }
  }

  return (
    <section
      ref={overlayRef}
      className={styles.overlay}
      aria-labelledby="boutique-development-title"
    >
      <div className={`${styles.tapeFrame} ${styles.tapeTop}`} aria-hidden="true">
        <div className={styles.tape}>
          <span>{TAPE_TEXT.repeat(3)}</span>
        </div>
      </div>
      <div className={`${styles.tapeFrame} ${styles.tapeMiddle}`} aria-hidden="true">
        <div className={styles.tape}>
          <span>{TAPE_TEXT.repeat(3)}</span>
        </div>
      </div>
      <div className={`${styles.tapeFrame} ${styles.tapeBottom}`} aria-hidden="true">
        <div className={styles.tape}>
          <span>{TAPE_TEXT.repeat(3)}</span>
        </div>
      </div>

      <div className={styles.notice}>
        <p className={styles.kicker}>Collection en préparation</p>
        <h1 id="boutique-development-title">La boutique arrive bientôt</h1>
        <p>
          Nous préparons les premières pièces Planète HMI. La boutique ouvrira
          lorsque les produits et le paiement seront prêts.
        </p>
        <div className={styles.actions}>
          <a href="/" className={styles.backLink}>Retour � l'accueil</a>
          {orientationPermission === "needed" ? (
            <button
              type="button"
              className={styles.motionButton}
              onClick={enableOrientation}
            >
              Activer le mouvement
            </button>
          ) : null}
        </div>
        {orientationPermission === "denied" ? (
          <small className={styles.permissionNote}>
            Le mouvement du téléphone reste désactivé. Les rubans demeurent
            visibles sans animation.
          </small>
        ) : null}
      </div>
    </section>
  );
}
