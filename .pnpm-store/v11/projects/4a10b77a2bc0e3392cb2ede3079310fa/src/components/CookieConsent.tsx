"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RiCloseLine, RiShieldCheckLine } from "react-icons/ri";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  OPEN_COOKIE_SETTINGS_EVENT,
  type ConsentChoice,
  createConsentChoice,
  parseConsentChoice,
} from "@/lib/privacy/consent";
import styles from "./CookieConsent.module.css";

const PRIVATE_ANALYTICS_ROUTES = [
  "/admin",
  "/auth",
  "/compte",
  "/connexion",
  "/espace-artiste",
  "/support/status",
];

function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url, window.location.origin);
    if (PRIVATE_ANALYTICS_ROUTES.some((route) => url.pathname.startsWith(route))) {
      return null;
    }
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null | undefined>(undefined);
  const [panelOpen, setPanelOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let storedChoice: ConsentChoice | null = null;
      try {
        storedChoice = parseConsentChoice(window.localStorage.getItem(CONSENT_STORAGE_KEY));
        if (!storedChoice) window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      } catch {
        storedChoice = null;
      }

      const globalPrivacyControl = (
        window.navigator as Navigator & { globalPrivacyControl?: boolean }
      ).globalPrivacyControl === true;
      setChoice(storedChoice);
      setAnalyticsEnabled(storedChoice?.analytics ?? !globalPrivacyControl);
      setPanelOpen(!storedChoice);
    });

    function openSettings() {
      let currentChoice: ConsentChoice | null = null;
      try {
        currentChoice = parseConsentChoice(
          window.localStorage.getItem(CONSENT_STORAGE_KEY),
        );
      } catch {
        currentChoice = null;
      }
      setAnalyticsEnabled(currentChoice?.analytics ?? false);
      setCustomizing(true);
      setPanelOpen(true);
    }

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cookie-consent-open", panelOpen);
    return () => document.body.classList.remove("cookie-consent-open");
  }, [panelOpen]);

  function saveChoice(analytics: boolean) {
    const nextChoice = createConsentChoice(analytics);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(nextChoice));
    } catch {
      // Le choix reste appliqué pendant la visite si le stockage est indisponible.
    }
    setChoice(nextChoice);
    setAnalyticsEnabled(analytics);
    if (!analytics) {
      window.va?.("beforeSend", () => null);
    }
    setPanelOpen(false);
    setCustomizing(false);
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED_EVENT, { detail: nextChoice }),
    );
  }

  function closePanel() {
    if (choice) {
      setPanelOpen(false);
      setCustomizing(false);
      return;
    }
    saveChoice(false);
  }

  return (
    <>
      {choice?.analytics ? (
        <Analytics beforeSend={sanitizeAnalyticsEvent} />
      ) : null}

      {choice !== undefined && panelOpen ? (
        <section
          className={styles.panel}
          role="dialog"
          aria-modal={customizing ? "true" : "false"}
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-description"
        >
          <button
            type="button"
            className={styles.close}
            onClick={closePanel}
            aria-label={choice ? "Fermer les préférences" : "Continuer sans mesure d’audience"}
          >
            <RiCloseLine aria-hidden="true" />
          </button>

          <div className={styles.intro}>
            <span className={styles.icon} aria-hidden="true">
              <RiShieldCheckLine />
            </span>
            <div>
              <h2 id="cookie-consent-title">Votre vie privée, votre choix</h2>
              <p id="cookie-consent-description">
                Les traceurs essentiels assurent la connexion et vos préférences.
                Avec votre accord, une mesure d’audience Vercel sans cookie nous aide à
                améliorer le site.
              </p>
            </div>
          </div>

          {customizing ? (
            <div className={styles.preferences}>
              <div className={styles.preferenceRow}>
                <div>
                  <strong>Fonctionnement essentiel</strong>
                  <span>Connexion, sécurité, panier de préférences et mémorisation de vos choix.</span>
                </div>
                <span className={styles.alwaysOn}>Toujours actif</span>
              </div>
              <label className={styles.preferenceRow}>
                <div>
                  <strong>Mesure d’audience anonyme</strong>
                  <span>Pages consultées, appareil et pays, sans cookie publicitaire ni suivi entre sites.</span>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                />
              </label>
              <button
                type="button"
                className={styles.save}
                onClick={() => saveChoice(analyticsEnabled)}
              >
                Enregistrer mes choix
              </button>
            </div>
          ) : (
            <div className={styles.actions}>
              <button type="button" onClick={() => saveChoice(true)}>
                Tout accepter
              </button>
              <button type="button" onClick={() => saveChoice(false)}>
                Tout refuser
              </button>
              <button type="button" className={styles.customize} onClick={() => setCustomizing(true)}>
                Personnaliser
              </button>
            </div>
          )}

          <p className={styles.moreInfo}>
            Votre choix est conservé six mois et peut être modifié à tout moment. {" "}
            <Link href="/cookies">Voir la politique des cookies</Link>
          </p>
        </section>
      ) : null}
    </>
  );
}
