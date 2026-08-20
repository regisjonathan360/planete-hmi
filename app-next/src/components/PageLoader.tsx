"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

/**
 * Écran de chargement synchronisé avec le contenu réel de la page.
 *
 * Au lieu de se fermer après un délai arbitraire, le loader attend que :
 *   1. Le DOM ait fini de se modifier (MutationObserver stabilisé)
 *   2. Toutes les images visibles soient chargées
 *   3. Une durée minimale d'affichage soit écoulée (pour éviter un flash)
 *
 * Sans JavaScript, le CSS masque seul l'écran après quelques secondes
 * (animation de secours `page-loader-fallback`).
 */

/** Durée minimale d'affichage (éviter un flash si le chargement est instantané). */
const DUREE_MINIMALE_INITIALE = 800;
/** Durée minimale lors d'un changement de route interne. */
const DUREE_MINIMALE_NAV = 400;
/** Le DOM doit être stable (aucune mutation) pendant cette durée pour être "prêt". */
const STABILITE_DOM_MS = 300;
/** Repli absolu : si rien ne se passe, on ferme quand même après ce délai. */
const SECOURS_MS = 6000;

/**
 * Attend que toutes les images <img> visibles dans le body soient chargées.
 * On ignore les images lazy (hors viewport) et les images déjà complètes.
 */
function attendreImages(): Promise<void> {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>("body img"));
  const enAttente = images.filter((img) => {
    // Ignorer les images sans src
    if (!img.src && !img.currentSrc) return false;
    // Ignorer les images déjà complètes
    if (img.complete && img.naturalWidth > 0) return false;
    // Ignorer les images lazy hors viewport (elles ne bloquent pas la page)
    if (img.loading === "lazy") return false;
    return true;
  });

  if (enAttente.length === 0) return Promise.resolve();

  return Promise.all(
    enAttente.map(
      (img) =>
        new Promise<void>((resolve) => {
          // Résoudre que l'image charge ou échoue — on ne bloque pas
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
          // Sécurité : si l'image ne déclenche rien après 4s, on passe
          setTimeout(resolve, 4000);
        })
    )
  ).then(() => {});
}

/**
 * Attend que le DOM soit stabilisé : aucune mutation (ajout/suppression de nœuds)
 * pendant `STABILITE_DOM_MS` millisecondes consécutives.
 */
function attendreStabiliteDOM(): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;

    const observer = new MutationObserver(() => {
      // À chaque mutation, on réinitialise le compteur
      clearTimeout(timer);
      timer = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, STABILITE_DOM_MS);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Lancer le timer initial au cas où il n'y a aucune mutation
    timer = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, STABILITE_DOM_MS);
  });
}

/**
 * Logique principale : attend DOM stable + images chargées + durée minimale,
 * puis ajoute la classe `is-done` pour déclencher le fondu CSS.
 */
function attendrePagePrete(
  racine: HTMLDivElement,
  dureeMinimale: number
): () => void {
  const debut = Date.now();
  let annule = false;

  const fermer = () => {
    if (annule) return;
    const ecoule = Date.now() - debut;
    const delaiRestant = Math.max(0, dureeMinimale - ecoule);
    setTimeout(() => {
      if (!annule) racine.classList.add("is-done");
    }, delaiRestant);
  };

  // Attendre que le DOM soit stable, puis que les images soient chargées
  attendreStabiliteDOM()
    .then(() => attendreImages())
    .then(() => fermer());

  // Sécurité absolue : on ferme quand même après SECOURS_MS
  const secours = setTimeout(() => {
    if (!annule) racine.classList.add("is-done");
  }, SECOURS_MS);

  // Retourne une fonction de nettoyage
  return () => {
    annule = true;
    clearTimeout(secours);
  };
}

export function PageLoader() {
  const racineRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const routeInitiale = useRef(true);
  const cleanupRef = useRef<(() => void) | null>(null);

  // --- Chargement initial ---
  useEffect(() => {
    const racine = racineRef.current;
    if (!racine) return;

    const demarrer = () => {
      cleanupRef.current = attendrePagePrete(racine, DUREE_MINIMALE_INITIALE);
    };

    // Si la page est déjà chargée (hydratation rapide), on démarre tout de suite
    if (document.readyState === "complete") {
      demarrer();
    } else {
      // Sinon, attendre l'événement load natif AVANT de lancer notre logique
      window.addEventListener("load", demarrer, { once: true });
    }

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  // --- Changement de route (navigation interne Next.js) ---
  const handleNavigation = useCallback(() => {
    const racine = racineRef.current;
    if (!racine) return;

    // Annuler toute attente précédente
    cleanupRef.current?.();

    // Réafficher le loader
    racine.classList.remove("is-done");

    // Attendre que la nouvelle page soit prête
    cleanupRef.current = attendrePagePrete(racine, DUREE_MINIMALE_NAV);
  }, []);

  useEffect(() => {
    if (routeInitiale.current) {
      routeInitiale.current = false;
      return;
    }

    handleNavigation();

    return () => {
      cleanupRef.current?.();
    };
  }, [pathname, handleNavigation]);

  return (
    <div className="page-loader" ref={racineRef} role="status" aria-label="Chargement de Planète HMI">
      <div className="page-loader__backdrop" aria-hidden="true" />
      <div className="page-loader__veil" aria-hidden="true" />

      <div className="page-loader__inner" aria-hidden="true">
        <div className="page-loader__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="page-loader__logo" src="/brand/logo1.png" alt="" width={64} height={64} />
        </div>

        <div className="page-loader__bar">
          <i />
        </div>

        <p className="page-loader__hint">Les étoiles de la musique haïtienne {"s'allument…"}</p>
      </div>
    </div>
  );
}