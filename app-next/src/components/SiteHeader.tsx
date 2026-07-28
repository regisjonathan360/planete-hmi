"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * En-tête du site avec navigation et menu hamburger mobile.
 * Affiche un mini-profil si l'utilisateur est connecté,
 * sinon le bouton "Connexion".
 */
interface HeaderUser {
  email: string | null;
  initial: string;
}

export function SiteHeader({ initialUser }: { initialUser?: HeaderUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<HeaderUser | null>(initialUser ?? null);
  const [authReady, setAuthReady] = useState(initialUser !== undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const email = data.user.email ?? null;
        const initial = (email ?? "U").charAt(0).toUpperCase();
        setUser({ email, initial });
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email ?? null;
      setUser(session?.user ? { email, initial: (email ?? "U").charAt(0).toUpperCase() } : null);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="topbar" id="haut">
      <div className="wrap topbar__inner">
        <Link className="brand" href="/" aria-label="Planète HMI, accueil">
          <Image
            src="/brand/logo1.png"
            alt="Planète HMI — Haitian Music Index"
            className="brand__logo"
            width={46}
            height={46}
          />
        </Link>

        <nav className="nav" aria-label="Navigation principale">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire */}
          <a href="/">Accueil</a>
          <Link href="/artistes">Artistes</Link>
          <Link href="/charts">Classements</Link>
          <Link href="/actualites">Actualités</Link>
          <Link href="/evenements">Événements</Link>
          <Link href="/labels">Labels</Link>
          <Link href="/boutique">Boutique</Link>
        </nav>

        <div className="topbar__actions">
          <button className="icon-btn" type="button" aria-label="Rechercher">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          {!authReady ? (
            <span className="topbar__auth-placeholder" aria-hidden="true" />
          ) : (
            user ? (
              <UserBadge email={user.email} initial={user.initial} onLogout={handleLogout} />
            ) : (
              <Link className="btn btn-ghost" href="/connexion">
                Connexion
              </Link>
            )
          )}
          <button
            className={`nav-toggle${menuOpen ? " is-open" : ""}`}
            type="button"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile-next"
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <nav
        className="menu-mobile"
        id="menu-mobile-next"
        aria-label="Navigation mobile"
        hidden={!menuOpen}
      >
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire */}
        <a href="/" onClick={() => setMenuOpen(false)}>Accueil</a>
        <Link href="/artistes" onClick={() => setMenuOpen(false)}>Artistes</Link>
        <Link href="/charts" onClick={() => setMenuOpen(false)}>Classements</Link>
        <Link href="/actualites" onClick={() => setMenuOpen(false)}>Actualités</Link>
        <Link href="/evenements" onClick={() => setMenuOpen(false)}>Événements</Link>
        <Link href="/labels" onClick={() => setMenuOpen(false)}>Labels</Link>
        <Link href="/boutique" onClick={() => setMenuOpen(false)}>Boutique</Link>
        {authReady ? (
          user ? (
            <>
              <Link href="/compte" onClick={() => setMenuOpen(false)}>Mon espace</Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                style={{ textAlign: "left" }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link className="btn btn-primary" href="/connexion" onClick={() => setMenuOpen(false)}>
              Connexion
            </Link>
          )
        ) : null}
      </nav>
    </header>
  );
}

/** Mini-profil dans le header quand l'utilisateur est connecté */
function UserBadge({
  email,
  initial,
  onLogout,
}: {
  email: string | null;
  initial: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="user-badge" style={{ position: "relative" }}>
      <button
        type="button"
        className="user-badge__trigger"
        onClick={() => setOpen(!open)}
        aria-label="Menu compte"
        aria-expanded={open}
      >
        <span className="user-badge__avatar">{initial}</span>
      </button>

      {open && (
        <div className="user-badge__dropdown">
          <p className="user-badge__email">{email ?? "Visiteur"}</p>
          <Link href="/compte" className="user-badge__link" onClick={() => setOpen(false)}>
            Mon espace
          </Link>
          <Link href="/compte/favoris" className="user-badge__link" onClick={() => setOpen(false)}>
            Mes favoris
          </Link>
          <button type="button" className="user-badge__link user-badge__logout" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
