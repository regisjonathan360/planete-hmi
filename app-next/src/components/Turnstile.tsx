"use client";

import { useEffect, useRef } from "react";

/**
 * Widget Cloudflare Turnstile, conditionnel : ne s'affiche que si
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY est défini (sinon rendu null).
 * La vérification côté Supabase se fait via le secret configuré au dashboard.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetIdRef = useRef<any>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    function renderWidget() {
      if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey!,
        theme: "dark",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      const script = existing ?? document.createElement("script");
      if (!existing) {
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
      return () => {
        cancelled = true;
        script.removeEventListener("load", renderWidget);
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} style={{ minHeight: 65 }} />;
}
