"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RiArrowRightLine, RiCloseLine, RiHeart3Line } from "react-icons/ri";
import styles from "./DonationPrompt.module.css";

const STORAGE_KEY = "planete-hmi-donation-prompt-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function DonationPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  const excludedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/connexion") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/soutenir");

  useEffect(() => {
    if (excludedRoute) return;

    const frame = window.requestAnimationFrame(() => {
      try {
        const dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY));
        setVisible(
          !Number.isFinite(dismissedAt) ||
            Date.now() - dismissedAt > DISMISS_DURATION_MS
        );
      } catch {
        setVisible(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [excludedRoute]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Le panneau reste simplement masqué pour cette visite.
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
        onClick={dismiss}
        aria-label="Masquer l’appel au soutien"
      >
        <RiCloseLine aria-hidden="true" />
      </button>

      <span className={styles.icon} aria-hidden="true">
        <RiHeart3Line />
      </span>

      <div className={styles.content}>
        <p className={styles.eyebrow}>Projet indépendant</p>
        <h2 id="donation-prompt-title">Aidez Planète HMI à grandir</h2>
        <p>
          Votre soutien finance les données, l’hébergement et les outils
          dédiés à la musique haïtienne.
        </p>
        <Link className={styles.cta} href="/soutenir">
          Soutenir le projet
          <RiArrowRightLine aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
