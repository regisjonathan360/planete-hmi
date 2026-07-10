import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-bottom">
          <p>Planète HMI © 2026 - Tous droits réservés</p>
          <p className="footer-legal-links">
            <Link href="/privacy">Confidentialité</Link>
            <span aria-hidden="true">/</span>
            <Link href="/terms">Conditions</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
