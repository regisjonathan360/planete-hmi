import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "À propos", description: "La mission et les principes de Planète HMI." };

export default function AboutPage() {
  return <><SiteHeader /><main className="info-page"><div className="info-page__wrap">
    <p className="info-page__eyebrow">Planète HMI</p><h1>La planète de la musique haïtienne</h1>
    <p className="info-page__lead">Planète HMI documente les artistes, les sorties, les classements et les tendances qui font vivre la musique haïtienne, en Haïti comme dans la diaspora.</p>
    <section className="info-page__section"><h2>Notre mission</h2><p>Rendre la musique haïtienne plus visible, mieux documentée et plus facile à découvrir. La plateforme rassemble des repères clairs pour le public, les artistes, les médias et les professionnels du secteur.</p></section>
    <section className="info-page__grid" aria-label="Ce que propose Planète HMI">
      <article><h2>Artistes</h2><p>Des fiches publiques, des liens officiels et des outils de revendication pour garder les informations à jour.</p></article>
      <article><h2>Classements</h2><p>Des palmarès construits à partir de sources identifiées, de périodes précises et de règles éditoriales visibles.</p></article>
      <article><h2>Découverte</h2><p>Actualités, événements, vidéos et tendances pour faciliter la rencontre entre les œuvres et leur public.</p></article>
    </section>
    <section className="info-page__section"><h2>Nos principes</h2><ul><li>Ne pas présenter une estimation comme une donnée officielle.</li><li>Indiquer la plateforme, le territoire et la période de chaque classement.</li><li>Vérifier l’éligibilité éditoriale des artistes et corriger les erreurs signalées.</li><li>Respecter les droits des artistes, des ayants droit et des plateformes sources.</li></ul></section>
    <section className="info-page__callout"><h2>Une information à corriger ?</h2><p>Vous pouvez nous écrire pour signaler une erreur, demander une mise à jour ou proposer une collaboration.</p><Link className="btn btn-primary" href="/contact">Contacter Planète HMI</Link></section>
  </div></main><SiteFooter /></>;
}
