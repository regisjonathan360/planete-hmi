import type { Metadata } from "next";
import Link from "next/link";
import { RiArrowLeftLine, RiHeart3Fill, RiShieldCheckLine } from "react-icons/ri";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "./soutenir.module.css";

export const metadata: Metadata = {
  title: "Soutenir le projet",
  description:
    "Soutenez le développement de Planète HMI et ses outils dédiés à la musique haïtienne.",
};

export default function SoutenirPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="support-title">
          <div className={styles.glow} aria-hidden="true" />
          <span className={styles.icon} aria-hidden="true">
            <RiHeart3Fill />
          </span>
          <p className={styles.eyebrow}>Construisons la suite ensemble</p>
          <h1 id="support-title">Soutenir Planète HMI</h1>
          <p className={styles.intro}>
            Planète HMI développe des classements fiables, des profils
            d’artistes et des outils de découverte pour mieux faire rayonner la
            musique haïtienne.
          </p>

          <div className={styles.status}>
            <RiShieldCheckLine aria-hidden="true" />
            <div>
              <strong>Portail de paiement en préparation</strong>
              <span>
                Le paiement sécurisé sera disponible ici prochainement. Aucun
                paiement n’est encore collecté.
              </span>
            </div>
          </div>

          <button className={styles.disabledCta} type="button" disabled>
            Paiement bientôt disponible
          </button>

          <Link className={styles.back} href="/">
            <RiArrowLeftLine aria-hidden="true" />
            Retour à l’accueil
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
