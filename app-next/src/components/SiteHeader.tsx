"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * En-tête du site avec navigation et menu hamburger mobile.
 * Utilisé sur les pages Next.js dynamiques (charts, artistes, privacy, terms).
 *
 * Les pages statiques (accueil, actualités, événements, boutique) utilisent
 * dangerouslySetInnerHTML + scripts vanilla. Un <Link> Next.js vers ces pages
 * ferait une navigation client-side qui ne ré-exécute pas les scripts.
 * On utilise donc <a> classique pour forcer un rechargement complet.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar" id="haut">
      <div className="wrap topbar__inner">
        <a className="brand" href="/" aria-label="Planète HMI, accueil">
          <img
            src="/brand/logo1.png"
            alt="Planète HMI — Haitian Music Index"
            className="brand__logo"
            width={46}
            height={46}
          />
        </a>

        <nav className="nav" aria-label="Navigation principale">
          <a href="/">Accueil</a>
          <Link href="/artistes">Artistes</Link>
          <Link href="/charts">Classements</Link>
          <a href="/actualites">Actualités</a>
          <a href="/evenements">Événements</a>
          <a href="/boutique">Boutique</a>
        </nav>

        <div className="topbar__actions">
          <Link className="btn btn-ghost" href="/connexion">
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
        <a href="/" onClick={() => setMenuOpen(false)}>Accueil</a>
        <Link href="/artistes" onClick={() => setMenuOpen(false)}>Artistes</Link>
        <Link href="/charts" onClick={() => setMenuOpen(false)}>Classements</Link>
        <a href="/actualites" onClick={() => setMenuOpen(false)}>Actualités</a>
        <a href="/evenements" onClick={() => setMenuOpen(false)}>Événements</a>
        <a href="/boutique" onClick={() => setMenuOpen(false)}>Boutique</a>
        <Link className="btn btn-primary" href="/connexion" onClick={() => setMenuOpen(false)}>
          Connexion
        </Link>
      </nav>
    </header>
  );
}
