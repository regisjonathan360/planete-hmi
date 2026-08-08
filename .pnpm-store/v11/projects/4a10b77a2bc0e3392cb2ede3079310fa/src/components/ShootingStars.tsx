"use client";

import { useEffect, useRef } from "react";
import styles from "./ShootingStars.module.css";

/**
 * Étoiles filantes sur le fond de page.
 *
 * Volontairement piloté en JS et non en CSS pur : une animation CSS avec des
 * `animation-delay` fixes se répète à l'identique, ce qui se remarque tout de
 * suite. Ici chaque étoile est créée à la volée avec sa propre taille, sa
 * trajectoire et sa vitesse, et l'attente avant la suivante suit une loi à
 * queue lourde (rafales courtes + longues accalmies).
 */

/** Au-delà, on n'ajoute plus d'étoile : garde-fou contre l'emballement. */
const MAX_SIMULTANEES = 6;

const alea = (min: number, max: number) => min + Math.random() * (max - min);

/** Teintes : blanc froid la plupart du temps, ambré de temps en temps. */
const TEINTES = [
  "255, 255, 255",
  "255, 255, 255",
  "223, 241, 255",
  "205, 232, 255",
  "255, 233, 196",
];

/**
 * Délai avant la prochaine étoile. Trois régimes pour que le rythme ne soit
 * jamais prévisible : rafale, cadence normale, longue accalmie.
 */
function prochainDelai(): number {
  const tirage = Math.random();
  if (tirage < 0.2) return alea(110, 480); // rafale
  if (tirage < 0.75) return alea(700, 3400); // cadence normale
  return alea(3400, 11000); // accalmie
}

export function ShootingStars() {
  const calqueRef = useRef<HTMLDivElement | null>(null);

  /**
   * Découpe un trou dans le calque à l'emplacement réel de la planète
   * (`.cosmos__planet`), pour qu'aucune étoile ne soit jamais dessinée
   * devant elle. La planète n'existe que sur la page d'accueil : sur les
   * autres pages, le trou reste hors-écran et n'a aucun effet.
   *
   * On mesure le DOM (`getBoundingClientRect`) plutôt que de recalculer la
   * position en CSS : la planète a sa propre parallaxe au défilement
   * (translateY piloté par `--py`) et une taille responsive
   * (`min(640px, 56vw)`), la mesure réelle suit ça sans dupliquer la formule.
   */
  useEffect(() => {
    const calque = calqueRef.current;
    if (!calque) return;

    let raf = 0;

    const maj = () => {
      raf = 0;
      const planete = document.querySelector<HTMLElement>(".cosmos__planet");
      if (!planete || !planete.isConnected) {
        calque.style.setProperty("--mask-r", "0px");
        return;
      }
      const r = planete.getBoundingClientRect();
      calque.style.setProperty("--mask-cx", `${(r.left + r.width / 2).toFixed(1)}px`);
      calque.style.setProperty("--mask-cy", `${(r.top + r.height / 2).toFixed(1)}px`);
      calque.style.setProperty("--mask-r", `${(r.width / 2).toFixed(1)}px`);
    };

    const planifierMaj = () => {
      if (raf) return;
      raf = requestAnimationFrame(maj);
    };

    // Au montage, la transform CSS de la planète (translateY parallaxe) peut
    // ne pas être encore appliquée au premier paint — mesuré : jusqu'à ~300ms
    // de décalage sur ce site. Sans rattrapage, le trou resterait mal placé
    // jusqu'au premier scroll ou resize de l'utilisateur. On remesure donc
    // sur quelques frames après le montage, puis on s'arrête et on ne suit
    // plus que le scroll/resize.
    let rattrapages = 15;
    const bouclerRattrapage = () => {
      maj();
      if (--rattrapages > 0) raf = requestAnimationFrame(bouclerRattrapage);
      else raf = 0;
    };
    raf = requestAnimationFrame(bouclerRattrapage);

    window.addEventListener("scroll", planifierMaj, { passive: true });
    window.addEventListener("resize", planifierMaj);

    return () => {
      window.removeEventListener("scroll", planifierMaj);
      window.removeEventListener("resize", planifierMaj);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const calque = calqueRef.current;
    if (!calque) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Désactiver les étoiles filantes sur mobile (< 768px)
    if (window.innerWidth < 768) return;

    // Étoiles filantes uniquement sur la page d'accueil et la carte
    const path = window.location.pathname;
    if (path !== "/" && path !== "/carte") return;

    let timer = 0;
    let vivantes = 0;
    let arrete = false;

    // Fonctions fléchées, et non `function` : une déclaration hoistée perdrait
    // le narrowing de `calque` (TypeScript la suppose appelable avant la garde).
    const lancer = () => {
      if (arrete || vivantes >= MAX_SIMULTANEES) return;

      const etoile = document.createElement("span");
      etoile.className = styles.star;

      const trainee = document.createElement("i");
      trainee.className = styles.trail;

      // Descend vers la droite, ou vers la gauche une fois sur trois.
      const versLaGauche = Math.random() < 0.34;
      const angle = versLaGauche ? alea(146, 168) : alea(12, 34);

      etoile.style.setProperty("--x", `${alea(-6, 100).toFixed(2)}vw`);
      etoile.style.setProperty("--y", `${alea(-4, 62).toFixed(2)}vh`);
      etoile.style.setProperty("--angle", `${angle.toFixed(1)}deg`);

      // Très petites : la traînée ne dépasse pas 130 px.
      trainee.style.setProperty("--len", `${alea(40, 130).toFixed(0)}px`);
      trainee.style.setProperty("--thick", `${alea(1, 2.4).toFixed(2)}px`);
      trainee.style.setProperty("--teinte", TEINTES[Math.floor(Math.random() * TEINTES.length)]);
      // Très rapides : 300 à 660 px avalés en 260 à 560 ms, soit environ
      // 550 à 2500 px/s. En dessous, ça ressemble à une bulle qui dérive.
      trainee.style.setProperty("--dist", `${alea(300, 660).toFixed(0)}px`);
      trainee.style.setProperty("--dur", `${alea(260, 560).toFixed(0)}ms`);

      etoile.appendChild(trainee);
      vivantes++;

      trainee.addEventListener(
        "animationend",
        () => {
          vivantes--;
          etoile.remove();
        },
        { once: true },
      );

      calque.appendChild(etoile);
    };

    const planifier = () => {
      timer = window.setTimeout(() => {
        // Onglet en arrière-plan : on ne dessine rien, on se recale.
        if (!document.hidden) lancer();
        planifier();
      }, prochainDelai());
    };

    planifier();

    return () => {
      arrete = true;
      window.clearTimeout(timer);
      calque.replaceChildren();
    };
  }, []);

  return <div ref={calqueRef} className={styles.layer} aria-hidden="true" />;
}
