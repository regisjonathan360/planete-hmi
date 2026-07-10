import Link from "next/link";
import "./charts.css";

export default function ChartsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hmi">
      {/* Fond cosmique profil-background (desktop/mobile via CSS) */}
      <div className="hmi__bg" aria-hidden="true" />
      {/* Grain texture */}
      <div className="hmi__grain" aria-hidden="true" />
      {/* Scrim gradient pour la lisibilité */}
      <div className="hmi__scrim" aria-hidden="true" />

      {/* Navigation identique à la DA du site */}
      <header className="topbar">
        <div className="wrap topbar__inner">
          <Link className="brand" href="/" aria-label="Planète HMI, accueil">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo1.png" alt="Planète HMI" className="brand__logo" width={46} height={46} />
            <span className="brand__text">Planète HMI</span>
          </Link>
          <nav className="nav" aria-label="Navigation principale">
            <Link href="/">Accueil</Link>
            <Link href="/artistes">Artistes</Link>
            <Link href="/charts" className="is-active">Classements</Link>
            <Link href="/actualites">Actualités</Link>
            <Link href="/evenements">Événements</Link>
            <Link href="/boutique">Boutique</Link>
          </nav>
          <div className="topbar__actions">
            <button className="icon-btn" type="button" aria-label="Rechercher">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Contenu de la page */}
      <div className="hmi__wrap">{children}</div>
    </div>
  );
}
