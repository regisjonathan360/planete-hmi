"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * En-tête du site avec navigation et menu hamburger mobile.
 * Affiche un mini-profil si l'utilisateur est connecté,
 * sinon le bouton "Connexion".
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ email: string | null; initial: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const email = data.user.email ?? null;
        const initial = (email ?? "U").charAt(0).toUpperCase();
        setUser({ email, initial });
      }
      setLoading(false);
    });
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
          {!loading && (
            user ? (
              <UserBadge email={user.email} initial={user.initial} onLogout={handleLogout} />
            ) : (
              <Link className="btn btn-ghost" href="/connexion">
                Connexion
              </Link>
            )
          )}
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
        {!loading && (
          user ? (
            <>
              <Link href="/espace-artiste" onClick={() => setMenuOpen(false)}>Mon espace</Link>
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
        )}
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
          <p className="user-badge__email">{email ?? "Artiste"}</p>
          <Link href="/espace-artiste" className="user-badge__link" onClick={() => setOpen(false)}>
            Mon espace
          </Link>
          <Link href="/espace-artiste/profil" className="user-badge__link" onClick={() => setOpen(false)}>
            Personnaliser le profil
          </Link>
          <button type="button" className="user-badge__link user-badge__logout" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
