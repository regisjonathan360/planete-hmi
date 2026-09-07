"use client";

import { useEffect } from "react";

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

    const fallback = window.setTimeout(() => revealables.forEach(reveal), 1200);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, [rootId]);

  return null;
}
