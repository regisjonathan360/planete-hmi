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

      {/* Navigation (portée du site statique) */}
      <nav className="topbar" aria-label="Navigation principale">
        <div className="topbar__inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="topbar__logo" src="/images/logo1.png" alt="" width={38} height={38} />
          <Link className="topbar__brand" href="/">
            Planète HMI
          </Link>
          <div className="topbar__nav">
            <Link href="/">Accueil</Link>
            <Link href="/artistes">Artistes</Link>
            <Link href="/charts" className="is-active">Classements</Link>
            <Link href="/actualites">Actualités</Link>
            <Link href="/evenements">Événements</Link>
          </div>
        </div>
      </nav>

      {/* Contenu de la page */}
      <div className="hmi__wrap">{children}</div>
    </div>
  );
}
