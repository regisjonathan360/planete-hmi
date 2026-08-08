"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RiArrowRightLine, RiCloseLine, RiHeart3Line } from "react-icons/ri";
import styles from "./DonationPrompt.module.css";

const LEGACY_STORAGE_KEY = "planete-hmi-donation-prompt-dismissed-at";
const OPT_OUT_STORAGE_KEY = "planete-hmi-donation-prompt-opt-out";
const INITIAL_DELAY_MS = 20_000;  // Temps avant la première affichage
const REAPPEAR_DELAY_MS = 10_000; // Temps avant réapparition après fermeture temporaire

export function DonationPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const initialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const excludedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/connexion") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/soutenir") ||
    pathname.startsWith("/support");

  useEffect(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    if (initialTimer.current) clearTimeout(initialTimer.current);

    const frame = window.requestAnimationFrame(() => {
      if (excludedRoute) {
        setVisible(false);
        return;
      }
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        const hasOptedOut = window.localStorage.getItem(OPT_OUT_STORAGE_KEY) === "true";
        if (hasOptedOut) {
          setVisible(false);
        } else {
          // Premier affichage après 20 secondes
          initialTimer.current = setTimeout(() => setVisible(true), INITIAL_DELAY_MS);
        }
      } catch {
        setVisible(true);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (returnTimer.current) clearTimeout(returnTimer.current);
      if (initialTimer.current) clearTimeout(initialTimer.current);
    };
  }, [excludedRoute]);

  function dismissTemporarily() {
    setVisible(false);
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = setTimeout(() => setVisible(true), REAPPEAR_DELAY_MS);
  }

  function optOut() {
    setVisible(false);
    if (returnTimer.current) clearTimeout(returnTimer.current);
    if (initialTimer.current) clearTimeout(initialTimer.current);
    try {
      window.localStorage.setItem(OPT_OUT_STORAGE_KEY, "true");
    } catch {
      // Le panneau reste masqué pour cette visite si le stockage est indisponible.
    }
  }

  if (!visible || excludedRoute) return null;

  return (
    <aside
      className={styles.prompt}
      aria-labelledby="donation-prompt-title"
    >
      <button
        className={styles.close}
        type="button"
        onClick={dismissTemporarily}
        aria-label="Fermer, l’appel au soutien réapparaîtra dans 20 secondes"
      >
        <RiCloseLine aria-hidden="true" />
      </button>

      <span className={styles.icon} aria-hidden="true">
        <span className={styles.heart}>
          <RiHeart3Line />
        </span>
      </span>

      <div className={styles.content}>
        <p className={styles.eyebrow}>Projet indépendant</p>
        <h2 id="donation-prompt-title">Aidez Planète HMI à grandir</h2>
        <p>
          Votre soutien finance les données, l’hébergement et les outils
          dédiés à la musique haïtienne.
        </p>
        <div className={styles.actions}>
          <Link className={styles.cta} href="/support">
            Soutenir le projet
            <RiArrowRightLine aria-hidden="true" />
          </Link>
          <button className={styles.optOut} type="button" onClick={optOut}>
            Ne plus afficher
          </button>
        </div>
      </div>
    </aside>
  );
}
