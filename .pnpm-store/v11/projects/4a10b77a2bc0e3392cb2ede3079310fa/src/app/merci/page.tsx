import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiHeart3Line,
  RiMusic2Line,
} from "react-icons/ri";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "./merci.module.css";

export const metadata: Metadata = {
  title: "Merci pour votre soutien",
  description:
    "Merci de soutenir Planète HMI et son travail au service de la musique haïtienne.",
  alternates: { canonical: "/merci" },
  robots: { index: false, follow: true },
};

export default function ThankYouPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="merci-title">
          <div className={styles.copy}>
            <div className={styles.confirmation}>
              <RiCheckboxCircleFill aria-hidden="true" />
              <span>Merci pour votre soutien</span>
            </div>
            <h1 id="merci-title">
              Votre geste fait avancer la musique haïtienne.
            </h1>
            <p className={styles.lead}>
              Chaque contribution aide Planète HMI à documenter, valoriser et faire
              rayonner les artistes haïtiens avec indépendance.
            </p>
            <div className={styles.actions}>
              <Link href="/" className={styles.primaryAction}>
                Retour à l’accueil <RiArrowRightLine aria-hidden="true" />
              </Link>
              <Link href="/charts" className={styles.secondaryAction}>
                Voir les classements
              </Link>
            </div>
          </div>

          <div className={styles.artwork} aria-hidden="true">
            <div className={styles.halo} />
            <div className={styles.planet}>
              <Image
                src="/brand/planet-hmi-icon-dark.png.png"
                alt=""
                width={220}
                height={220}
                priority
              />
            </div>
            <span className={styles.note}><RiMusic2Line /></span>
            <span className={styles.heart}><RiHeart3Line /></span>
          </div>
        </section>

        <section className={styles.impact} aria-label="Impact de votre contribution">
          <p>Votre contribution participe directement à ces trois missions.</p>
          <div className={styles.impactList}>
            <article>
              <strong>Documenter</strong>
              <span>Des profils et des crédits musicaux plus complets.</span>
            </article>
            <article>
              <strong>Mesurer</strong>
              <span>Des classements transparents et mieux documentés.</span>
            </article>
            <article>
              <strong>Faire rayonner</strong>
              <span>Une vitrine mondiale pour la musique haïtienne.</span>
            </article>
          </div>
        </section>

        <p className={styles.receiptNote}>
          Votre reçu et les détails de la transaction sont fournis directement par PayPal.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
