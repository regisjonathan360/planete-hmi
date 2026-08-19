"use client";

import { useEffect } from "react";

/**
 * Reconnects the legacy HTML pages to the App Router lifecycle.
 *
 * The legacy main.js runs once for the whole application. On a client-side
 * navigation, however, a new static page can be inserted after that script
 * has already registered its IntersectionObserver. Its `.reveal` elements
 * would then remain at opacity 0 forever. This effect observes the freshly
 * mounted page and has a short failsafe so content is never left invisible.
 */
export function StaticPageClientEffects({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const revealables = Array.from(
      root.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"),
    );
    if (!revealables.length) return;

    const reveal = (element: HTMLElement) => element.classList.add("is-visible");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The hero is above the fold. Reveal it immediately so a route transition
    // can never present an apparently empty home page while the observer warms up.
    const animationFrame = window.requestAnimationFrame(() => {
      revealables
        .filter((element) => element.closest(".hero"))
        .forEach(reveal);
    });

    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealables.forEach(reveal);
      return () => window.cancelAnimationFrame(animationFrame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    revealables.forEach((element) => observer.observe(element));

    // IntersectionObserver is normally immediate for the hero. The fallback
    // protects visitors on a stalled transition or an unusual browser state.
    const fallback = window.setTimeout(() => revealables.forEach(reveal), 1200);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, [rootId]);

  return null;
}
