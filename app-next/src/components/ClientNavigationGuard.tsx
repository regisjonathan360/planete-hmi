"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps ordinary same-origin anchors inside the App Router. A full document
 * reload destroys the Audio element, so the global radio must stay in the
 * same client application while visitors move around the site.
 */
export function ClientNavigationGuard() {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin || url.protocol !== window.location.protocol) return;
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
      if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return;
      }

      event.preventDefault();
      router.push(`${url.pathname}${url.search}${url.hash}`);
    };

    // Capture before legacy scripts or native anchors can trigger a reload.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return null;
}
