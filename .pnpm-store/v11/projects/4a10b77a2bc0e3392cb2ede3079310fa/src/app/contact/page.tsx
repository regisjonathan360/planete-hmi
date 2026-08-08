import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Contact", description: "Contactez l’équipe de Planète HMI." };

export default function ContactPage() {
  return <><SiteHeader /><main className="info-page"><div className="info-page__wrap">
    <p className="info-page__eyebrow">Nous écrire</p><h1>Contact</h1>
    <p className="info-page__lead">Une question, une correction à proposer, une fiche artiste à mettre à jour ou un projet de partenariat ? Écrivez à l’équipe Planète HMI.</p>
    <section className="info-page__grid" aria-label="Moyens de contacter Planète HMI">
      <article><h2>E-mail</h2><p><a href="mailto:contact@planete-hmi.com">contact@planete-hmi.com</a></p><p>Pour les demandes générales, corrections et droits.</p></article>
      <article><h2>Instagram</h2><p><a href="https://www.instagram.com/planetehmi/" target="_blank" rel="noreferrer">@planetehmi</a></p><p>Pour suivre l’actualité de la plateforme et nous envoyer un message rapide.</p></article>
    </section>
    <section className="info-page__section"><h2>Envoyer un message</h2><p>Le formulaire ouvre votre application e-mail avec les informations déjà préparées. Aucun message n’est conservé sur le site.</p><ContactForm /></section>
    <section className="info-page__callout"><h2>Avant de nous écrire</h2><p>Pour une correction, indiquez le lien de la page concernée, l’information à corriger et, si possible, une source officielle.</p></section>
  </div></main><SiteFooter /></>;
}
