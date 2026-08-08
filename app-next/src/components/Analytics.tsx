"use client";

import Script from "next/script";
import { useEffect } from "react";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

interface CookieConsentDetail {
  analytics?: boolean;
}

/**
 * Composant Analytics pour Google Analytics 4
 * Respecte le consentement RGPD via le composant CookieConsent
 */
export function Analytics() {
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    // Écoute les changements de consentement
    function handleConsentChange(event: Event) {
      const customEvent = event as CustomEvent<CookieConsentDetail>;
      const consent = customEvent.detail;
      
      if (window.gtag) {
        window.gtag("consent", "update", {
          analytics_storage: consent?.analytics ? "granted" : "denied",
        });
      }
    }

    window.addEventListener("planete-hmi:consent-changed", handleConsentChange);

    return () => {
      window.removeEventListener("planete-hmi:consent-changed", handleConsentChange);
    };
  }, []);

  // N'affiche rien si pas de GA_MEASUREMENT_ID
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            // Respect du consentement RGPD par défaut
            gtag('consent', 'default', {
              'analytics_storage': 'denied',
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'wait_for_update': 500
            });

            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              cookie_flags: 'SameSite=None;Secure'
            });

            // Track navigation changes
            window.addEventListener('popstate', function() {
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname
              });
            });
          `,
        }}
      />
    </>
  );
}

// Étend le type Window pour TypeScript
declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string | "default" | "update",
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}
