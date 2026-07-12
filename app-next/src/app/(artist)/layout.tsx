import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ArtistScrollReset } from "./ArtistScrollReset";
import { FEATURES } from "@/lib/features";
import "./artist-account.css";

export default function ArtistAreaLayout({ children }: { children: ReactNode }) {
  // Si les comptes artistes sont désactivés, rediriger vers la connexion visiteur
  if (!FEATURES.ARTIST_ACCOUNTS) {
    redirect("/connexion");
  }

  return (
    <>
      <ArtistScrollReset />
      <div className="grain" aria-hidden="true" />
      <div className="cosmos artist-cosmos" aria-hidden="true" />
      <a className="skip-link" href="#contenu">
        Aller au contenu principal
      </a>
      <SiteHeader />
      <main id="contenu" className="artist-area">
        {children}
      </main>
      <footer className="site-footer artist-footer">
        <div className="wrap">
          <div className="footer-bottom">
            <p className="footer-legal-links">
              <a href="/privacy">Confidentialité</a>
              <span aria-hidden="true">/</span>
              <a href="/terms">Conditions</a>
            </p>
            <p>Planète HMI © 2026 - Tous droits réservés</p>
          </div>
        </div>
      </footer>
    </>
  );
}
