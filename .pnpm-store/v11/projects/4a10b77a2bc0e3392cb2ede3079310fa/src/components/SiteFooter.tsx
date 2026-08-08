import Link from "next/link";
import { CookieSettingsButton } from "./CookieSettingsButton";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-bottom">
          <p>Planète HMI © 2026 - Tous droits réservés</p>
          <p className="footer-legal-links">
            <Link href="/privacy">Confidentialité</Link>
            <span aria-hidden="true">/</span>
            <Link href="/cookies">Cookies</Link>
            <span aria-hidden="true">/</span>
            <CookieSettingsButton />
            <span aria-hidden="true">/</span>
            <Link href="/terms">Conditions</Link>
            <span aria-hidden="true">/</span>
            <Link href="/a-propos">À propos</Link>
            <span aria-hidden="true">/</span>
            <Link href="/methodologie">Méthodologie</Link>
            <span aria-hidden="true">/</span>
            <Link href="/contact">Contact</Link>
            <span aria-hidden="true">/</span>
            <Link href="/support">Soutenir Planète HMI</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
