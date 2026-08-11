"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Ecran de chargement facon YouTube : un voile flou de l'image du header
 * (hero-head), le logo Planete HMI, une barre de progression indeterminee et
 * des cartes "squelette" (shimmer) qui s'affichent pendant que la page se
 * charge, avant que le contenu reel prenne leur place.
 *
 * Sans JavaScript, le CSS masque seul l'ecran apres quelques secondes
 * (animation de secours). Avec JavaScript, il disparait des que la page est
 * prete (evenement `load` + duree minimale d'affichage), et refait une breve
 * apparition a chaque changement de route pour rendre la navigation fluide.
 */

/** Duree minimale d'affichage au premier chargement. */
const DUREE_MINIMALE = 900;
/** Duree d'affichage lors d'un changement de route. */
const DUREE_NAVIGATION = 600;
/** Repli : si `load` tarde, l'ecran se ferme quand meme. */
const SECOURS_MS = 2600;

export function PageLoader() {
  const racineRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const routeInitiale = useRef(true);

  useEffect(() => {
    const racine = racineRef.current;
    if (!racine) return;

    const fermentClock = Date.now();
    const fermer = () => {
      const ecoule = Date.now() - fermentClock;
      window.setTimeout(() => racine.classList.add("is-done"), Math.max(0, DUREE_MINIMALE - ecoule));
    };

    if (document.readyState === "complete") {
      fermer();
    } else {
      window.addEventListener("load", fermer, { once: true });
    }

    const secours = window.setTimeout(() => racine.classList.add("is-done"), SECOURS_MS);
    return () => window.clearTimeout(secours);
  }, []);

  useEffect(() => {
    if (routeInitiale.current) {
      routeInitiale.current = false;
      return;
    }

    const racine = racineRef.current;
    if (!racine) return;

    racine.classList.remove("is-done");
    const fermeture = window.setTimeout(() => racine.classList.add("is-done"), DUREE_NAVIGATION);
    return () => window.clearTimeout(fermeture);
  }, [pathname]);

  return (
    <div className="page-loader" ref={racineRef} role="status" aria-label="Chargement de Planète HMI">
      <div className="page-loader__backdrop" aria-hidden="true" />
      <div className="page-loader__veil" aria-hidden="true" />

      <div className="page-loader__inner" aria-hidden="true">
        <div className="page-loader__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="page-loader__logo" src="/brand/logo1.png" alt="" width={64} height={64} />
          <span className="page-loader__title">
            Planète <em>HMI</em>
          </span>
        </div>

        <div className="page-loader__bar">
          <i />
        </div>

        <div className="page-loader__grid">
          <div className="page-loader__row">
            <span className="page-loader__card"><i /><i /><i /></span>
            <span className="page-loader__card"><i /><i /><i /></span>
            <span className="page-loader__card"><i /><i /><i /></span>
          </div>
          <div className="page-loader__row page-loader__row--wide">
            <span className="page-loader__card"><i /><i /><i /></span>
            <span className="page-loader__card"><i /><i /><i /></span>
          </div>
        </div>

        <p className="page-loader__hint">Les étoiles de la musique haïtienne {"s'allument…"}</p>
      </div>
    </div>
  );
}