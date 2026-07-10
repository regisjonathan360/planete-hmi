import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
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

      {/* Navigation avec hamburger mobile */}
      <SiteHeader />

      {/* Contenu de la page */}
      <div className="hmi__wrap">{children}</div>
    </div>
  );
}
