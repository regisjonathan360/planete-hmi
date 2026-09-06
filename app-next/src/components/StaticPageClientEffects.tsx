"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    tiktok?: { embed?: () => void };
  }
}

const TIKTOK_EMBED_SRC = "https://www.tiktok.com/embed.js";

function loadTiktokEmbeds(root: HTMLElement) {
  const blockquotes = root.querySelectorAll("blockquote.tiktok-embed");
  if (!blockquotes.length) return;

  if (!document.querySelector(`script[src="${TIKTOK_EMBED_SRC}"]`)) {
    const script = document.createElement("script");
    script.src = TIKTOK_EMBED_SRC;
    script.async = true;
    document.body.appendChild(script);
  }

  const tryEmbed = () => {
    if (window.tiktok?.embed) {
      window.tiktok.embed();
    }
  };

  setTimeout(tryEmbed, 300);
  setTimeout(tryEmbed, 800);
  setTimeout(tryEmbed, 1500);
}

export function StaticPageClientEffects({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    loadTiktokEmbeds(root);

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
