"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * En-tête du site avec navigation et menu hamburger mobile.
 * Utilisé sur les pages Next.js dynamiques (charts, artistes, privacy, terms).
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar" id="haut">
      <div className="wrap topbar__inner">
        <Link className="brand" href="/" aria-label="Planète HMI, accueil">
          <img
            src="/brand/logo1.png"
            alt="Planète HMI — Haitian Music Index"
            className="brand__logo"
            width={46}
            height={46}
          />
        </Link>

        <nav className="nav" aria-label="Navigation principale">
          <Link href="/">Accueil</Link>
          <Link href="/artistes">Artistes</Link>
          <Link href="/charts">Classements</Link>
          <Link href="/actualites">Actualités</Link>
          <Link href="/evenements">Événements</Link>
          <Link href="/boutique">Boutique</Link>
        </nav>

        <div className="topbar__actions">
          <Link className="btn btn-ghost" href="/#connexion">
            Connexion
          </Link>
          <button
            className="nav-toggle"
            type="button"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen ? "true" : "false"}
            aria-controls="menu-mobile-next"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      <nav
        className="menu-mobile"
        id="menu-mobile-next"
        aria-label="Navigation mobile"
        hidden={!menuOpen}
      >
        <Link href="/" onClick={() => setMenuOpen(false)}>Accueil</Link>
        <Link href="/artistes" onClick={() => setMenuOpen(false)}>Artistes</Link>
        <Link href="/charts" onClick={() => setMenuOpen(false)}>Classements</Link>
        <Link href="/actualites" onClick={() => setMenuOpen(false)}>Actualités</Link>
        <Link href="/evenements" onClick={() => setMenuOpen(false)}>Événements</Link>
        <Link href="/boutique" onClick={() => setMenuOpen(false)}>Boutique</Link>
        <Link className="btn btn-primary" href="/#connexion" onClick={() => setMenuOpen(false)}>
          Connexion
        </Link>
      </nav>
    </header>
  );
}
